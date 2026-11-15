import { sort } from "remeda";
import type {
  BotName,
  Collector,
  CollectorContext,
  OutboundData,
} from "@/server/features/handbook/contracts/collectors";
import { BOT_USER_AGENTS } from "@/server/features/handbook/contracts/collectors";
import { siblingHosts } from "@/server/features/handbook/engine/safe-fetch";

/**
 * Outbound links (P5-13): off-site links found on crawled pages, fetched once
 * with a browser user-agent and once as GPTBot through `ctx.fetchOffsite`
 * (SSRF policy, no site-host scope). Capped at 40 links: links on ≥2 pages
 * first, then conversion-ish anchors, then the rest in page order.
 */
const MAX_LINKS = 40;
const BATCH = 5;
const BOT: BotName = "GPTBot";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CONVERSION = /book|buy|register|ticket|donate|gift|order|shop|reserve/i;

async function probe(ctx: CollectorContext, url: string, userAgent: string) {
  try {
    const res = await ctx.fetchOffsite(url, { userAgent });
    return { status: res.status, finalUrl: res.finalUrl };
  } catch (error) {
    ctx.log("handbook.outbound.fetch_failed", { url, error: String(error) });
    return null;
  }
}

export const outboundCollector: Collector<"outbound"> = {
  key: "outbound",
  dependsOn: ["pages"],
  async collect(ctx, collected) {
    if (collected.pages?.status !== "ok")
      return { status: "unavailable", reason: "pages unavailable" };
    const own = new Set(siblingHosts(new URL(ctx.origin).hostname));
    const found = new Map<string, { sources: string[]; conversion: boolean }>();
    for (const page of collected.pages.snapshots) {
      for (const link of page.links) {
        let u: URL;
        try {
          u = new URL(link.href);
        } catch {
          continue;
        }
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
        if (own.has(u.hostname.toLowerCase())) continue;
        u.hash = "";
        const entry = found.get(u.href) ?? { sources: [], conversion: false };
        if (!entry.sources.includes(page.url)) entry.sources.push(page.url);
        entry.conversion ||= CONVERSION.test(`${link.text} ${u.href}`);
        found.set(u.href, entry);
      }
    }
    const ranked = sort(
      [...found],
      ([, a], [, b]) =>
        Number(b.sources.length >= 2) - Number(a.sources.length >= 2) ||
        Number(b.conversion) - Number(a.conversion),
    );
    const links: OutboundData["links"][number][] = [];
    const picked = ranked.slice(0, MAX_LINKS);
    for (let i = 0; i < picked.length; i += BATCH) {
      const batch = await Promise.all(
        picked.slice(i, i + BATCH).map(async ([url, entry]) => {
          const browser = await probe(ctx, url, BROWSER_UA);
          const bot = await probe(ctx, url, BOT_USER_AGENTS[BOT]);
          return {
            url,
            sourceUrls: entry.sources,
            browser,
            bot: bot ? { name: BOT, ...bot } : null,
          };
        }),
      );
      links.push(...batch);
    }
    return { status: "ok", links };
  },
};
