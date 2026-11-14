import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  RobotsGroup,
  RobotsHost,
} from "@/server/features/handbook/contracts/collectors";
import { decide } from "@/server/features/handbook/engine/robots";
import { createResult } from "./support";

/**
 * ROBOTS exemplar (handbook §18 group-matching rule + Route coverage).
 * A named group replaces `*` for that bot, so every named group must carry
 * the full `*` Disallow set; each gap is proven by evaluating one sample path
 * for the named bot and for an unlisted bot. Parameter rules need both the
 * `?p=` and `&p=` shapes.
 */
const ITEMS = ["P3-15", "P9-05"];
const UNLISTED_BOT = "HandbookUnlistedBot";

const disallows = (groups: readonly RobotsGroup[]) =>
  new Set(
    groups.flatMap((g) =>
      g.rules.filter((r) => r.type === "disallow" && r.path).map((r) => r.path),
    ),
  );

/** A concrete path a rule pattern matches (`*` → `x`, `$` dropped). */
const samplePath = (pattern: string) =>
  pattern.replace(/\$$/, "").replaceAll("*", "x") || "/";

const formatGroup = (g: RobotsGroup) =>
  [
    ...g.userAgents.map((ua) => `User-agent: ${ua}`),
    ...g.rules.map(
      (r) => `${r.type === "allow" ? "Allow" : "Disallow"}: ${r.path}`,
    ),
  ].join("\n");

type Gap = { agents: string[]; missing: string[]; proof: string[] };

function namedGroupGaps(host: RobotsHost): Gap[] {
  const star = disallows(host.groups.filter((g) => g.userAgents.includes("*")));
  if (star.size === 0) return [];
  const gaps: Gap[] = [];
  for (const group of host.groups) {
    if (group.userAgents.includes("*")) continue;
    const bot = group.userAgents[0] ?? "";
    // RFC 9309: every group naming the bot merges into its ruleset.
    const merged = disallows(
      host.groups.filter((g) =>
        g.userAgents.some((ua) => ua.toLowerCase() === bot.toLowerCase()),
      ),
    );
    const missing = [...star].filter((p) => !merged.has(p));
    if (missing.length === 0) continue;
    const proof = missing.map((pattern) => {
      const path = samplePath(pattern);
      const named = decide(host.host, host.groups, bot, path);
      const unlisted = decide(host.host, host.groups, UNLISTED_BOT, path);
      return `${path}: ${bot} ${named.allowed ? "allowed" : "blocked"} (group ${named.matchedGroup}) · unlisted bot ${unlisted.allowed ? "allowed" : "blocked"} (group ${unlisted.matchedGroup})`;
    });
    gaps.push({ agents: [...group.userAgents], missing, proof });
  }
  return gaps;
}

/** `?p=` rule without its `&p=` sibling (handbook §18 Route coverage). */
function parameterShapeGaps(host: RobotsHost): string[] {
  const all = new Set(host.groups.flatMap((g) => g.rules.map((r) => r.path)));
  return [...all].filter((path) => {
    const match = /\?([^=&*$]+)=/.exec(path);
    return match ? ![...all].some((p) => p.includes(`&${match[1]}=`)) : false;
  });
}

export const robotsGroupsCheck: HandbookCheck = {
  id: "robots.group-evaluation",
  itemIds: ITEMS,
  class: "ROBOTS",
  requires: ["robots"],
  run(ctx) {
    const out = createResult(ITEMS);
    const robots = ctx.collected.robots;
    if (robots.status !== "ok") return out.build();
    const protocol = new URL(ctx.origin).protocol;
    const hosts = robots.hosts.filter((h) => h.status === 200);
    if (hosts.length === 0) {
      out.na("P3-15", "no robots.txt (HTTP 200) on any host");
      out.na("P9-05", "no robots.txt (HTTP 200) on any host");
      return out.build();
    }
    for (const host of hosts) {
      const url = `${protocol}//${host.host}/robots.txt`;
      const groupsText = host.groups.map(formatGroup).join("\n\n");
      for (const gap of namedGroupGaps(host)) {
        const ref = out.evidence(
          "robotsTxt",
          url,
          `${groupsText}\n\n# Evaluation\n${gap.proof.join("\n")}`,
          host.storageKey,
        );
        out.finding({
          itemIds: ["P3-15", "P9-05"],
          severity: "S1",
          title: `Named robots.txt group (${gap.agents.join(", ")}) misses the * Disallow set`,
          detail: `A named group replaces \`*\` for that bot (RFC 9309), so ${gap.agents.join(", ")} may crawl ${gap.missing.join(", ")} while unlisted bots are blocked.`,
          fix: `Copy every \`*\` Disallow line into the ${gap.agents.join(", ")} group (or drop the named group if it only restates \`Allow: /\`), then re-test one named and one unlisted bot per protected route shape.`,
          fixability: "FIXABLE",
          effort: "S",
          urls: [url],
          evidenceRefs: [ref],
        });
      }
      const shapes = parameterShapeGaps(host);
      if (shapes.length > 0) {
        const ref = out.evidence("robotsTxt", url, groupsText, host.storageKey);
        out.finding({
          itemIds: ["P3-15"],
          severity: "S3",
          severityReason:
            "shape gap leaks only parameter-order variants of an already protected route",
          title: "robots.txt parameter rules miss the `&param=` shape",
          detail: `${shapes.join(", ")} do not match the parameter when it is not first (\`?a=1&${shapes[0]?.match(/\?([^=]+)=/)?.[1] ?? "p"}=…\`).`,
          fix: "Add the `&param=` sibling for every `?param=` Disallow line, in every group.",
          fixability: "FIXABLE",
          effort: "S",
          urls: [url],
          evidenceRefs: [ref],
        });
      }
      const ref = out.evidence("robotsTxt", url, groupsText, host.storageKey);
      out.pass(
        "P3-15",
        "every named group carries the * Disallow set (or * has none)",
        [ref],
      );
      out.pass("P9-05", "robots.txt evaluated per group", [ref]);
    }
    return out.build();
  },
};
