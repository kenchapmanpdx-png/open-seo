import type {
  RobotsDecision,
  RobotsGroup,
} from "@/server/features/handbook/contracts/collectors";

/**
 * RFC 9309 robots.txt parsing + per-group evaluation (ADR-004). Upstream's
 * `parseRobotsTxt` answers "may OpenSEO crawl this"; checks need "which group
 * does bot X fall into, and what does it decide": a named group fully
 * replaces `*` for that bot, which is the classic GEO mistake.
 */
export type ParsedRobots = {
  groups: RobotsGroup[];
  sitemaps: string[];
  warnings: string[];
};

export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const warnings: string[] = [];
  let current: {
    userAgents: string[];
    rules: RobotsGroup["rules"][number][];
  } | null = null;
  let lastWasAgent = false;

  text.split(/\r\n|\r|\n/).forEach((rawLine, index) => {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) return;
    const colon = line.indexOf(":");
    if (colon < 0) {
      warnings.push(`line ${index + 1}: no colon`);
      return;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
      }
      current.userAgents.push(value);
      lastWasAgent = true;
      return;
    }
    lastWasAgent = false;
    if (key === "sitemap") {
      sitemaps.push(value);
      return;
    }
    if (key === "allow" || key === "disallow") {
      if (!current) {
        warnings.push(`line ${index + 1}: ${key} before any user-agent`);
        return;
      }
      current.rules.push({ type: key, path: value });
      return;
    }
    if (key !== "crawl-delay" && key !== "host" && key !== "content-signal") {
      warnings.push(`line ${index + 1}: unknown directive "${key}"`);
    }
  });
  return { groups, sitemaps, warnings };
}

/** Groups that apply to `bot`: every group naming it, else every `*` group. */
export function selectGroups(groups: readonly RobotsGroup[], bot: string) {
  const token = bot.toLowerCase();
  const named = groups.filter((g) =>
    g.userAgents.some((ua) => ua.toLowerCase() === token),
  );
  if (named.length > 0) return { groups: named, matched: bot };
  const star = groups.filter((g) => g.userAgents.includes("*"));
  return { groups: star, matched: star.length > 0 ? "*" : "" };
}

function ruleMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
}

export function decide(
  host: string,
  groups: readonly RobotsGroup[],
  bot: string,
  path: string,
): RobotsDecision {
  const selected = selectGroups(groups, bot);
  let best: { type: "allow" | "disallow"; path: string } | null = null;
  for (const group of selected.groups) {
    for (const rule of group.rules) {
      // Empty Disallow matches nothing (RFC 9309 §2.2.2).
      if (rule.path === "" || !ruleMatches(rule.path, path)) continue;
      const longer = !best || rule.path.length > best.path.length;
      const tieAllow =
        best && rule.path.length === best.path.length && rule.type === "allow";
      if (longer || tieAllow) best = rule;
    }
  }
  return {
    host,
    bot,
    path,
    allowed: best?.type !== "disallow",
    matchedGroup: selected.matched,
    matchedRule: best ? `${best.type}: ${best.path}` : null,
  };
}
