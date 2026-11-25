import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  RobotsGroup,
  RobotsHost,
} from "@/server/features/handbook/contracts/collectors";
import { decide } from "@/server/features/handbook/engine/robots";
import { AI_BOT_TOKENS } from "@/server/features/handbook/collectors/ai-bot-tokens";
import { ROBOTS_BOT_TOKENS } from "@/server/features/handbook/collectors/fetch-collectors";
import { createResult, missingRobotsHosts, originUrl } from "./support";

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

/**
 * Google special-case crawlers ignore the `*` group whatever the file says
 * ("The global user agent (`*`) is ignored"), so a named group for them
 * changes nothing (B18 WO-B18-002):
 * https://developers.google.com/search/docs/crawling-indexing/google-special-case-crawlers
 */
const IGNORES_STAR = new Set(
  [
    "AdsBot-Google",
    "AdsBot-Google-Mobile",
    "Mediapartners-Google",
    "APIs-Google",
  ].map((t) => t.toLowerCase()),
);

/** Search and AI-answer crawlers: a gap for them always stays Must fix. */
const SEARCH_OR_AI = new Set(
  [...ROBOTS_BOT_TOKENS, ...AI_BOT_TOKENS.map((b) => b.token)].map((t) =>
    t.toLowerCase(),
  ),
);
const SEARCH_BOT =
  /googlebot|storebot-google|google-extended|bingbot|msnbot|applebot|duckduck|yandex|baiduspider/i;
const isSearchOrAi = (agent: string) =>
  SEARCH_OR_AI.has(agent.toLowerCase()) || SEARCH_BOT.test(agent);
const isParameterRule = (pattern: string) => /[?=]/.test(pattern);

function namedGroupGaps(host: RobotsHost): Gap[] {
  const star = disallows(host.groups.filter((g) => g.userAgents.includes("*")));
  if (star.size === 0) return [];
  const gaps: Gap[] = [];
  for (const group of host.groups) {
    if (group.userAgents.includes("*")) continue;
    if (group.userAgents.every((ua) => IGNORES_STAR.has(ua.toLowerCase())))
      continue;
    const bot = group.userAgents[0] ?? "";
    // RFC 9309: every group naming the bot merges into its ruleset.
    const merged = disallows(
      host.groups.filter((g) =>
        g.userAgents.some((ua) => ua.toLowerCase() === bot.toLowerCase()),
      ),
    );
    // WO-B21-005: a gap is a route the named bot may crawl and an unlisted
    // bot may not, by evaluation; a broader own rule (`Disallow: /`) covers it.
    const evaluated = [...star]
      .filter((p) => !merged.has(p))
      .map((pattern) => {
        const path = samplePath(pattern);
        const named = decide(host.host, host.groups, bot, path);
        const unlisted = decide(host.host, host.groups, UNLISTED_BOT, path);
        return {
          pattern,
          leaks: named.allowed && !unlisted.allowed,
          proof: `${path}: ${bot} ${named.allowed ? "allowed" : "blocked"} (group ${named.matchedGroup}) · unlisted bot ${unlisted.allowed ? "allowed" : "blocked"} (group ${unlisted.matchedGroup})`,
        };
      })
      .filter((e) => e.leaks);
    if (evaluated.length === 0) continue;
    const missing = evaluated.map((e) => e.pattern);
    const proof = evaluated.map((e) => e.proof);
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
    const protocol = originUrl(ctx.origin).protocol;
    const hosts = robots.hosts.filter((h) => h.status === 200);
    // WO-B20-011: robots.txt answers 4xx on every host → one "No robots.txt"
    // finding (crawlers read a 4xx as allow-all); a 5xx keeps the N/A below.
    const missing = missingRobotsHosts(robots.hosts);
    if (missing.length > 0) {
      const first = missing[0];
      const url = `${protocol}//${first?.host}/robots.txt`;
      out.finding({
        itemIds: ["P3-15"],
        severity: "S3",
        severityReason:
          "a missing robots.txt blocks nothing; crawlers treat a 4xx as allow-all",
        title: `No robots.txt (HTTP ${first?.status})`,
        detail: [
          ...missing.map(
            (h) => `${protocol}//${h.host}/robots.txt — HTTP ${h.status}`,
          ),
          "Crawlers treat a 4xx robots.txt as allow-all, so nothing is blocked, but there is no place to declare the sitemap or keep private sections out of crawls.",
        ].join("\n"),
        fix: "Publish /robots.txt (HTTP 200) with a `Sitemap:` line pointing at the XML sitemap, and Disallow rules only for real private or duplicate routes.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [url],
        evidenceRefs: [
          out.evidence(
            "status",
            url,
            missing
              .map(
                (h) =>
                  `GET ${protocol}//${h.host}/robots.txt → HTTP ${h.status}`,
              )
              .join("\n"),
            first?.storageKey,
          ),
        ],
      });
      out.na("P9-05", "no robots.txt (HTTP 200) on any host");
      return out.build();
    }
    if (hosts.length === 0) {
      out.na("P3-15", "no robots.txt (HTTP 200) on any host");
      out.na("P9-05", "no robots.txt (HTTP 200) on any host");
      return out.build();
    }
    for (const host of hosts) {
      const url = `${protocol}//${host.host}/robots.txt`;
      const groupsText = host.groups.map(formatGroup).join("\n\n");
      // One finding per robots.txt listing every affected group (WO-B18-001).
      const gaps = namedGroupGaps(host);
      if (gaps.length > 0) {
        const agents = gaps.flatMap((g) => g.agents);
        const ref = out.evidence(
          "robotsTxt",
          url,
          `${groupsText}\n\n# Evaluation\n${gaps.flatMap((g) => g.proof).join("\n")}`,
          host.storageKey,
        );
        // Severity scales (§18, WO-B18-003): parameter-only leaks to
        // crawlers that are neither search nor AI-answer bots do not touch
        // Google or AI answers. Any search / AI bot or real route → S1.
        const minor =
          !agents.some(isSearchOrAi) &&
          gaps.every((g) => g.missing.every(isParameterRule));
        out.finding({
          itemIds: ["P3-15", "P9-05"],
          severity: minor ? "S3" : "S1",
          ...(minor
            ? {
                severityReason:
                  "only parameter rules leak, and only to crawlers that are not search or AI-answer bots",
              }
            : {}),
          title: `Named robots.txt groups miss the * Disallow set (${agents.join(", ")})`,
          detail: `A named group replaces \`*\` for that bot (RFC 9309), so these bots may crawl paths unlisted bots may not:\n${gaps.map((g) => `${g.agents.join(", ")}: ${g.missing.join(", ")}`).join("\n")}`,
          fix: `Copy every \`*\` Disallow line into each named group (or drop a named group that only restates \`Allow: /\`), then re-test one named and one unlisted bot per protected route shape.`,
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
