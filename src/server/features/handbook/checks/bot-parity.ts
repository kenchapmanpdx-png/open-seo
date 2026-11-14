import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { BotFetchData } from "@/server/features/handbook/contracts/collectors";
import { decide } from "@/server/features/handbook/engine/robots";
import { createResult } from "./support";

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
      if (robots.status !== "ok") return true;
      const { host, pathname } = new URL(url);
      const file = robots.hosts.find(
        (h) => h.host === host && h.status === 200,
      );
      return file ? decide(host, file.groups, bot, pathname).allowed : true;
    };
    const urls = [...new Set(botFetch.fetches.map((f) => f.url))];
    const rows: string[] = [];
    for (const url of urls) {
      const all = botFetch.fetches.filter((f) => f.url === url);
      const browser = all.find((f) => f.bot === "browser");
      if (!browser || browser.status !== 200) continue;
      const table = all
        .map(
          (f) =>
            `${f.bot}: HTTP ${f.status}, ${f.words} words, ${f.bytes} B, sha256 ${f.bodySha256.slice(0, 12)}${f.blockedReason ? `, ${f.blockedReason}` : ""}`,
        )
        .join("\n");
      const ref = out.evidence("botFetch", url, table);
      rows.push(ref);
      const failing = all.flatMap((f) => {
        if (f.bot === "browser") return [];
        const why = mismatch(f, browser);
        return why && robotsAllows(f.bot, url) ? [`${f.bot}: ${why}`] : [];
      });
      if (failing.length === 0) continue;
      out.finding({
        itemIds: ITEMS,
        severity: "S1",
        title: "Bots allowed by robots.txt do not get the browser response",
        detail: `${url}\n${failing.join("\n")}`,
        fix: "Allow these user agents in the CDN/firewall/bot-protection rules (or block them deliberately in robots.txt and record the decision); re-test each bot UA for 200 + full HTML.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [url],
        evidenceRefs: [ref],
      });
    }
    if (rows.length === 0) {
      out.na("P9-01", "no URL returned 200 to the browser UA");
      return out.build();
    }
    out.pass(
      "P9-01",
      `${urls.length} URLs: every robots-allowed bot UA gets 200 + comparable HTML (CDN dashboard + verified-bot logs manual)`,
      rows,
    );
    return out.build();
  },
};
