import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { BotFetchData } from "@/server/features/handbook/contracts/collectors";
import { decide } from "@/server/features/handbook/engine/robots";
import { createResult, parseUrl } from "./support";

/**
 * BOTFETCH exemplar (handbook §0 P9, §18): a bot that robots.txt allows must
 * get what a browser gets — 200, no challenge page, comparable content. A
 * bot robots.txt blocks is a deliberate choice, not a parity failure.
 * CDN/firewall dashboards and verified-bot logs stay manual (P9-01 partial).
 */
const ITEMS = ["P9-01"];

/** Bot words below this share of the browser's words = content withheld. */
const MIN_WORD_RATIO = 0.5;

type Fetch = BotFetchData["fetches"][number];

function mismatch(bot: Fetch, browser: Fetch): string | null {
  // Same marker for the browser = the page itself, not a bot block.
  if (bot.blockedReason && bot.blockedReason !== browser.blockedReason)
    return bot.blockedReason;
  if (bot.status !== browser.status)
    return `HTTP ${bot.status} (browser ${browser.status})`;
  if (browser.words > 50 && bot.words < browser.words * MIN_WORD_RATIO)
    return `${bot.words} words (browser ${browser.words})`;
  return null;
}

/** URLs listed in the finding detail and evidence. */
const MAX_LISTED = 20;

const pct = (n: number, d: number) => `${Math.round((n / d) * 100)} %`;

export const botParityCheck: HandbookCheck = {
  id: "botfetch.parity",
  itemIds: ITEMS,
  class: "BOTFETCH",
  requires: ["botFetch"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { botFetch, robots } = ctx.collected;
    if (botFetch.status !== "ok") return out.build();
    const robotsAllows = (bot: string, url: string) => {
      const u = parseUrl(url);
      if (robots.status !== "ok" || !u) return true;
      const { host, pathname } = u;
      const file = robots.hosts.find(
        (h) => h.host === host && h.status === 200,
      );
      return file ? decide(host, file.groups, bot, pathname).allowed : true;
    };
    // The first browser fetch of a URL is the reference; a URL the browser
    // does not get as 200 (plain-HTTP redirect probes) is not compared.
    const browserOf = new Map<string, Fetch>();
    for (const f of botFetch.fetches)
      if (f.bot === "browser" && !browserOf.has(f.url)) browserOf.set(f.url, f);
    const urls = [...browserOf.values()]
      .filter((b) => b.status === 200)
      .map((b) => b.url);
    if (urls.length === 0) {
      out.na("P9-01", "no URL returned 200 to the browser UA");
      return out.build();
    }
    const compared = botFetch.fetches.flatMap((f) => {
      const browser = browserOf.get(f.url);
      if (f.bot === "browser" || browser?.status !== 200) return [];
      // 429 = the audit's own request rate was throttled (the escalation
      // stops on it); a deliberate bot block shows as 403 or a challenge.
      if (f.status === 429) return [];
      if (!robotsAllows(f.bot, f.url)) return [];
      return [{ f, why: mismatch(f, browser) }];
    });
    const ref = (url: string) =>
      out.evidence(
        "botFetch",
        url,
        botFetch.fetches
          .filter((f) => f.url === url)
          .map(
            (f) =>
              `${f.bot} round ${f.round ?? 1}: HTTP ${f.status}, ${f.words} words, ${f.bytes} B, sha256 ${f.bodySha256.slice(0, 12)}${f.blockedReason ? `, ${f.blockedReason}` : ""}${f.excerpt ? `\n  body: ${f.excerpt.replace(/\s+/g, " ")}` : ""}`,
          )
          .join("\n"),
      );
    const failing = compared.filter((c) => c.why !== null);
    if (failing.length === 0) {
      out.pass(
        "P9-01",
        `${urls.length} URLs, ${compared.length} bot fetches: every robots-allowed bot UA gets 200 + comparable HTML (CDN dashboard + verified-bot logs manual)`,
        urls.slice(0, MAX_LISTED).map(ref),
      );
      return out.build();
    }
    // Per UA: blocked share of its fetches. A (bot, URL) pair that fails on
    // one round and passes on the other is intermittent.
    const rates = [...new Set(failing.map((c) => c.f.bot))].map((bot) => {
      const all = compared.filter((c) => c.f.bot === bot);
      const bad = all.filter((c) => c.why !== null).length;
      return `${bot}: ${bad} of ${all.length} fetches (${pct(bad, all.length)})`;
    });
    const pairs = [...new Set(failing.map((c) => `${c.f.bot} ${c.f.url}`))].map(
      (key) => {
        const all = compared.filter((c) => `${c.f.bot} ${c.f.url}` === key);
        return all.every((c) => c.why !== null);
      },
    );
    const intermittent = pairs.every((always) => !always);
    const failingUrls = [...new Set(failing.map((c) => c.f.url))];
    const lines = failingUrls.slice(0, MAX_LISTED).map((url) => {
      const reasons = [
        ...new Set(
          failing
            .filter((c) => c.f.url === url)
            .map((c) => `${c.f.bot}: ${c.why}`),
        ),
      ];
      return `${url}\n  ${reasons.join("\n  ")}`;
    });
    const more =
      failingUrls.length > MAX_LISTED
        ? [`… ${failingUrls.length - MAX_LISTED} more URLs`]
        : [];
    out.finding({
      itemIds: ITEMS,
      ...(intermittent
        ? {
            severity: "S2" as const,
            severityReason: `intermittent: every failing bot got the full page on another fetch of the same URL (${failing.length} of ${compared.length} bot fetches, ${pct(failing.length, compared.length)})`,
          }
        : { severity: "S1" as const }),
      title: "Bots allowed by robots.txt do not get the browser response",
      detail: [
        `${failing.length} of ${compared.length} bot fetches blocked (${pct(failing.length, compared.length)})`,
        ...rates,
        ...lines,
        ...more,
      ].join("\n"),
      fix: "Allow these user agents in the CDN/firewall/bot-protection rules (or block them deliberately in robots.txt and record the decision); re-test each bot UA for 200 + full HTML.",
      fixability: "FIXABLE",
      effort: "S",
      urls: failingUrls,
      evidenceRefs: failingUrls.slice(0, MAX_LISTED).map(ref),
    });
    return out.build();
  },
};
