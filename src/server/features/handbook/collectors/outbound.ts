import { sort } from "remeda";
import type {
  BotName,
  Collector,
  LinkProbe,
} from "@/server/features/handbook/contracts/collectors";
import { BOT_USER_AGENTS } from "@/server/features/handbook/contracts/collectors";
import { siblingHosts } from "@/server/features/handbook/engine/safe-fetch";
import { sleep } from "@/server/features/handbook/engine/transient-retry";
import { BROWSER_UA, fetchOnce, hostPacer, pool, probeUrl } from "./probe";

/**
 * Outbound links (P5-13, FULL-READ §3.6): every unique off-site link found on
 * crawled pages, capped at 500 (most source pages first, then
 * conversion-ish anchors). Each is fetched through `ctx.fetchOffsite` (SSRF
 * policy, no site-host scope) with a browser user-agent: HEAD first, GET when
 * HEAD answers 405/501 or fails, one retry on a transient failure. Googlebot
 * is asked only when the browser gets no 2xx (bot-only blocks are recorded,
 * not findings). 4 workers; at most 1 request per second per host. A link
 * with no HTTP answer is probed once more ≥ 30 s later (WO-B26-006).
 */
const MAX_LINKS = 500;
/** Gap between the first probe and the late re-probe of a no-answer link. */
const LATE_RETRY_MS = 30_000;
const WORKERS = 4;
const BOT: BotName = "Googlebot";
const CONVERSION = /book|buy|register|ticket|donate|gift|order|shop|reserve/i;

type Probe = { status: number; finalUrl: string } | null;

const ok = (p: Probe) => p !== null && p.status >= 200 && p.status < 300;
const plain = (p: LinkProbe): Probe =>
  p ? { status: p.status, finalUrl: p.finalUrl } : null;

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
    const picked = sort(
      [...found],
      ([, a], [, b]) =>
        b.sources.length - a.sources.length ||
        Number(b.conversion) - Number(a.conversion),
    ).slice(0, MAX_LINKS);
    if (found.size > MAX_LINKS)
      ctx.log("handbook.outbound.capped", {
        found: found.size,
        probed: MAX_LINKS,
      });

    const pace = hostPacer();
    const fetcher = ctx.fetchOffsite;
    const probe = async (url: string) => {
      const browser = plain(
        await probeUrl(ctx, fetcher, pace, url, BROWSER_UA),
      );
      const bot = ok(browser)
        ? null
        : await fetchOnce(
            ctx,
            { fetcher, pace, url },
            BOT_USER_AGENTS[BOT],
            "GET",
          );
      return {
        browser,
        bot: bot
          ? { name: BOT, status: bot.status, finalUrl: bot.finalUrl }
          : null,
      };
    };
    const firstAt = new Map<string, number>();
    const links = await pool(picked, WORKERS, async ([url, entry]) => {
      firstAt.set(url, Date.now());
      return { url, sourceUrls: entry.sources, ...(await probe(url)) };
    });
    // No HTTP answer: one more probe at the end of the phase, at least
    // LATE_RETRY_MS after the first (WO-B26-006), not a burst (ADR-035).
    const unanswered = links.filter((l) => !l.browser);
    await pool(unanswered, WORKERS, async (link) => {
      await sleep((firstAt.get(link.url) ?? 0) + LATE_RETRY_MS - Date.now());
      Object.assign(link, await probe(link.url));
    });
    return { status: "ok", links };
  },
};
