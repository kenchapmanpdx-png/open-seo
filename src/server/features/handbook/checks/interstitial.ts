import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { BotFetchData } from "@/server/features/handbook/contracts/collectors";
import { createResult } from "./support";

/**
 * SUPP-07 (ADR-020/021): a bot-check / interstitial page answered with HTTP
 * 200 is indexed or quoted as the page's content. Reads the `blockedReason`
 * the bot-fetch collector sets (`interstitial:<vendor|generic|hash>`).
 * P9-01 is owned only so the check runs on sites where SUPP rules apply;
 * its verdict stays with `botfetch.parity`, which already opens P9-01 for
 * any bot/browser mismatch. Not scored (Additional findings).
 */
const ITEMS = ["P9-01", "SUPP-07"];

type Fetch = BotFetchData["fetches"][number];

const isChallenge = (f: Fetch) =>
  f.status === 200 && (f.blockedReason?.startsWith("interstitial:") ?? false);

/** Evidence rows kept per finding (each challenged fetch is one row). */
const MAX_EVIDENCE = 10;

export const interstitialCheck: HandbookCheck = {
  id: "botfetch.interstitial",
  itemIds: ITEMS,
  class: "BOTFETCH",
  requires: ["botFetch"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { botFetch } = ctx.collected;
    if (botFetch.status !== "ok") return out.build();
    const challenged = botFetch.fetches.filter(isChallenge);
    if (challenged.length === 0) return out.build();

    const agents = [...new Set(challenged.map((f) => f.bot))];
    const rows = agents.map((bot) => {
      const all = botFetch.fetches.filter((f) => f.bot === bot);
      const hit = challenged.filter((f) => f.bot === bot);
      return { bot, hit: hit.length, total: all.length };
    });
    // S1 only when a search / AI-citation bot gets the challenge on every
    // fetch; a partial or browser-only challenge is intermittent (S2).
    const everyFetch = rows.filter(
      (r) => r.bot !== "browser" && r.hit === r.total,
    );
    const refs = challenged
      .slice(0, MAX_EVIDENCE)
      .map((f) =>
        out.evidence(
          "botFetch",
          f.url,
          `UA ${f.bot}: HTTP ${f.status}, ${f.blockedReason}, ${f.words} words, ${f.bytes} B, sha256 ${f.bodySha256.slice(0, 12)}${f.excerpt ? `\nbody: ${f.excerpt}` : ""}`,
        ),
      );
    const summary = rows
      .map((r) => `${r.bot}: ${r.hit} of ${r.total} fetches`)
      .join("\n");
    out.finding({
      itemIds: ["SUPP-07"],
      severity: everyFetch.length > 0 ? "S1" : "S2",
      ...(everyFetch.length > 0
        ? {}
        : {
            severityReason:
              "intermittent: no search or AI bot UA is challenged on every fetch",
          }),
      title: "Bot-check / interstitial page returned as HTTP 200 content",
      detail: `${summary}\n${[...new Set(challenged.map((f) => f.url))].slice(0, MAX_EVIDENCE).join("\n")}`,
      fix: "Allowlist verified search and AI-citation bots in the bot-check layer (vendor IP lists / verified-bot setting); answer any challenge that remains with 403/429/503, never a 200 page. Then check WAF logs for those bots.",
      fixability: "FIXABLE",
      effort: "S",
      urls: [...new Set(challenged.map((f) => f.url))],
      evidenceRefs: refs,
    });
    return out.build();
  },
};
