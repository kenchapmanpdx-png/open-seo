import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { BotFetchData } from "@/server/features/handbook/contracts/collectors";
import { createResult, siteUrl } from "./support";

/**
 * AI-bot policy map (FULL-READ §3.9, handbook §16/§18; bluetree F27): per
 * crawler token, robots.txt's verdict for `/` ("stated") vs what the home
 * page serves that UA ("served"). A token robots.txt allows but the server
 * answers 401/403/429/503 or a challenge page is a policy split: blocking a
 * training bot can be a fine decision, the defect is that robots.txt does
 * not state it (P9-01, S4). P9-04 (decisions recorded) needs the owner, so
 * it is BLOCKED with the per-token decisions to record.
 */
const ITEMS = ["P9-01", "P9-04"];

type Row = NonNullable<BotFetchData["policyMap"]>[number];

const BLOCK_STATUS = new Set([401, 403, 429, 503]);

const served = (r: Row) =>
  r.blockedReason?.startsWith("interstitial:")
    ? r.blockedReason
    : BLOCK_STATUS.has(r.status)
      ? `HTTP ${r.status}`
      : null;

const list = (picked: Row[]) => picked.map((r) => r.token).join(", ") || "—";

export const aiBotPolicyCheck: HandbookCheck = {
  id: "botfetch.ai-bot-policy",
  itemIds: ITEMS,
  class: "BOTFETCH",
  requires: ["botFetch"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { botFetch } = ctx.collected;
    const rows = botFetch.status === "ok" ? (botFetch.policyMap ?? []) : [];
    if (rows.length === 0) return out.build();
    const home = siteUrl(ctx.origin);
    const table = rows
      .map(
        (r) =>
          `${r.token}: robots ${r.robotsAllowed ? "allows" : "disallows"} /, served HTTP ${r.status}${r.blockedReason ? ` (${r.blockedReason})` : ""}`,
      )
      .join("\n");
    const ref = out.evidence("botFetch", home, table);
    const splits = rows.filter((r) => r.robotsAllowed && served(r));
    out.blocked(
      "P9-04",
      `Owner to record the AI-bot decisions: allowed ${list(rows.filter((r) => r.robotsAllowed && !served(r)))}; robots.txt disallows ${list(rows.filter((r) => !r.robotsAllowed))}; server blocks while robots.txt allows ${list(splits)}`,
    );
    if (splits.length === 0) return out.build();
    out.finding({
      itemIds: ["P9-01"],
      severity: "S4",
      severityReason:
        "policy split: a deliberate block is allowed; the defect is that robots.txt does not state it",
      title:
        "AI-bot policy split: robots.txt allows crawlers the server blocks",
      detail: splits.map((r) => `${r.token}: ${served(r)}`).join("\n"),
      fix: "Decide per crawler. To block, add a Disallow group for the token in robots.txt so the stated policy matches the server; to allow, remove the UA rule from the server/WAF. Record the decision (P9-04).",
      fixability: "FIXABLE",
      effort: "S",
      urls: [home],
      evidenceRefs: [ref],
    });
    return out.build();
  },
};
