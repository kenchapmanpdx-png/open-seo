import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import {
  type BotFetchData,
  type CollectedData,
} from "@/server/features/handbook/contracts/collectors";
import {
  AI_BOTS,
  SEARCH_BOTS,
} from "@/server/features/handbook/contracts/bot-classes";
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

/**
 * Bot fetches compared with the browser's: robots-allowed bots on URLs the
 * browser got as 200, 429s left out. `why` = the mismatch, null = same page.
 * Shared with `ai-bot-policy` so one block is reported once (WO-B21-004).
 */
export function compareBotFetches(
  collected: Pick<CollectedData, "botFetch" | "robots">,
) {
  const { botFetch, robots } = collected;
  if (botFetch.status !== "ok") return { urls: [], compared: [] };
  const robotsAllows = (bot: string, url: string) => {
    const u = parseUrl(url);
    if (robots.status !== "ok" || !u) return true;
    const { host, pathname, search } = u;
    const file = robots.hosts.find((h) => h.host === host && h.status === 200);
    return file
      ? decide(host, file.groups, bot, pathname + search).allowed
      : true;
  };
  // The first browser fetch of a URL is the reference; a URL the browser
  // does not get as 200 (plain-HTTP redirect probes) is not compared.
  const browserOf = new Map<string, Fetch>();
  for (const f of botFetch.fetches)
    if (f.bot === "browser" && !browserOf.has(f.url)) browserOf.set(f.url, f);
  const urls = [...browserOf.values()]
    .filter((b) => b.status === 200)
    .map((b) => b.url);
  const compared = botFetch.fetches.flatMap((f) => {
    const browser = browserOf.get(f.url);
    if (f.bot === "browser" || browser?.status !== 200) return [];
    // 429 = the audit's own request rate was throttled (the escalation
    // stops on it); a deliberate bot block shows as 403 or a challenge.
    if (f.status === 429) return [];
    if (!robotsAllows(f.bot, f.url)) return [];
    return [{ f, why: mismatch(f, browser) }];
  });
  // WO-B25-008: a bot that got the browser's page on some URLs and a refusal
  // on others, with no URL that failed and then passed (intermittent), was
  // refused for our IP or request history, not for its UA: a UA-spoofed
  // fetch cannot reproduce how the site treats the real crawler (handbook
  // §0 Mode 1). It is "not tested"; only the other bots count as refused.
  const notTested = [...new Set(compared.map((c) => c.f.bot))].flatMap(
    (bot) => {
      const all = compared.filter((c) => c.f.bot === bot);
      const bad = all.filter((c) => c.why !== null);
      const full = all.length - bad.length;
      const failedUrls = new Set(bad.map((c) => c.f.url));
      const intermittent = [...failedUrls].some((url) =>
        all.some((c) => c.f.url === url && c.why === null),
      );
      return bad.length > 0 && full > 0 && !intermittent
        ? [{ bot, refused: bad.length, all: all.length, full }]
        : [];
    },
  );
  const skip = new Set(notTested.map((n) => n.bot));
  const failing = compared.filter((c) => c.why !== null && !skip.has(c.f.bot));
  return { urls, compared, failing, notTested };
}

const notTestedLine = (n: {
  bot: string;
  refused: number;
  all: number;
  full: number;
}) =>
  `${n.bot}: not tested from our IP (${n.refused} of ${n.all} fetches refused after ${n.full} full page${n.full === 1 ? "" : "s"}; a UA-spoofed fetch cannot reproduce how the site treats the real crawler, handbook §0 Mode 1)`;

const pct = (n: number, d: number) => `${Math.round((n / d) * 100)} %`;

export const botParityCheck: HandbookCheck = {
  id: "botfetch.parity",
  itemIds: ITEMS,
  class: "BOTFETCH",
  requires: ["botFetch"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { botFetch } = ctx.collected;
    if (botFetch.status !== "ok") return out.build();
    const { urls, compared, failing, notTested } = compareBotFetches(
      ctx.collected,
    );
    const notTestedLines = notTested.map(notTestedLine);
    if (urls.length === 0) {
      out.na("P9-01", "no URL returned 200 to the browser UA");
      return out.build();
    }
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
    if (failing.length === 0) {
      out.pass(
        "P9-01",
        `${urls.length} URLs, ${compared.length} bot fetches: every robots-allowed bot UA gets 200 + comparable HTML (CDN dashboard + verified-bot logs manual)${notTestedLines.length > 0 ? `; ${notTestedLines.join("; ")}` : ""}`,
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
    const failingBots = new Set(failing.map((c) => c.f.bot));
    const searchFailing = SEARCH_BOTS.filter((b) => failingBots.has(b));
    const aiFailing = AI_BOTS.filter((b) => failingBots.has(b));
    const byClass = [
      ...(searchFailing.length
        ? [`search crawlers: ${searchFailing.join(", ")}`]
        : []),
      ...(aiFailing.length ? [`AI crawlers: ${aiFailing.join(", ")}`] : []),
    ];
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
      // WO-B21-004: S1 only when a search crawler is consistently refused;
      // an AI-crawler-only block cannot stop indexing (ADR-037).
      ...(intermittent
        ? {
            severity: "S2" as const,
            severityReason: `intermittent: every failing bot got the full page on another fetch of the same URL (${failing.length} of ${compared.length} bot fetches, ${pct(failing.length, compared.length)})`,
          }
        : searchFailing.length === 0
          ? {
              severity: "S2" as const,
              severityReason:
                "AI-crawler-only block: Googlebot and Bingbot receive the page; a deliberate block is allowed (record it under P9-04)",
            }
          : { severity: "S1" as const }),
      title: "Bots allowed by robots.txt do not get the browser response",
      detail: [
        `${failing.length} of ${compared.length} bot fetches blocked (${pct(failing.length, compared.length)})`,
        ...byClass,
        ...rates,
        ...notTestedLines,
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
