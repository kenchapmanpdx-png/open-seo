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
 * Outbound links (P5-13, FULL-READ §3.6): every unique off-site link found on
 * crawled pages, capped at 500 (most source pages first, then
 * conversion-ish anchors). Each is fetched through `ctx.fetchOffsite` (SSRF
 * policy, no site-host scope) with a browser user-agent: HEAD first, GET when
 * HEAD answers 405/501 or fails, one retry on a transient failure. Googlebot
 * is asked only when the browser gets no 2xx (bot-only blocks are recorded,
 * not findings). 4 workers; at most 1 request per second per host.
 */
const MAX_LINKS = 500;
const WORKERS = 4;
const HOST_INTERVAL_MS = 1000;
const RETRY_DELAY_MS = 2000;
const BOT: BotName = "Googlebot";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CONVERSION = /book|buy|register|ticket|donate|gift|order|shop|reserve/i;
const HEAD_UNSUPPORTED = new Set([405, 501]);
const TRANSIENT = new Set([429, 502, 503, 504]);

type Probe = { status: number; finalUrl: string } | null;

const sleep = (ms: number) =>
  new Promise<void>((done) => setTimeout(done, Math.max(0, ms)));

/** Per-host pacer: each request on a host waits for its own 1 s slot. */
function hostPacer() {
  const next = new Map<string, number>();
  return async (url: string) => {
    const host = new URL(url).host;
    const now = Date.now();
    const slot = Math.max(now, next.get(host) ?? 0);
    next.set(host, slot + HOST_INTERVAL_MS);
    await sleep(slot - now);
  };
}

async function fetchOnce(
  ctx: CollectorContext,
  pace: (url: string) => Promise<void>,
  url: string,
  userAgent: string,
  method: "GET" | "HEAD",
): Promise<Probe> {
  await pace(url);
  try {
    const res = await ctx.fetchOffsite(url, { userAgent, method });
    return { status: res.status, finalUrl: res.finalUrl };
  } catch (error) {
    ctx.log("handbook.outbound.fetch_failed", {
      url,
      method,
      error: String(error),
    });
    return null;
  }
}

/** Browser probe: HEAD, GET when HEAD is refused or fails. */
async function browserProbe(
  ctx: CollectorContext,
  pace: (url: string) => Promise<void>,
  url: string,
): Promise<Probe> {
  const attempt = async () => {
    const head = await fetchOnce(ctx, pace, url, BROWSER_UA, "HEAD");
    if (head && !HEAD_UNSUPPORTED.has(head.status)) return head;
    return fetchOnce(ctx, pace, url, BROWSER_UA, "GET");
  };
  const first = await attempt();
  if (first && !TRANSIENT.has(first.status)) return first;
  await sleep(RETRY_DELAY_MS);
  return (await attempt()) ?? first;
}

const ok = (p: Probe) => p !== null && p.status >= 200 && p.status < 300;

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
    const links: OutboundData["links"][number][] = Array.from({
      length: picked.length,
    });
    let cursor = 0;
    const worker = async () => {
      while (cursor < picked.length) {
        const i = cursor++;
        const [url, entry] = picked[i];
        const browser = await browserProbe(ctx, pace, url);
        const bot = ok(browser)
          ? null
          : await fetchOnce(ctx, pace, url, BOT_USER_AGENTS[BOT], "GET");
        links[i] = {
          url,
          sourceUrls: entry.sources,
          browser,
          bot: bot ? { name: BOT, ...bot } : null,
        };
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    return { status: "ok", links };
  },
};
