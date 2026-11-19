import { sha256Hex } from "@/server/lib/audit/ids";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import {
  detectInterstitial,
  interstitialReason,
  smallBodyHashTracker,
} from "@/server/features/handbook/engine/interstitial";
import {
  BOT_PARITY_BOTS,
  BOT_PARITY_GAP_MS,
  BOT_PARITY_STOP_AFTER,
  botParityPlan,
  botParityTrigger,
} from "@/server/features/handbook/engine/escalations";
import {
  BOT_USER_AGENTS,
  type BotFetchData,
  type BotName,
  type Collector,
  type CollectorContext,
  type CollectedData,
} from "@/server/features/handbook/contracts/collectors";
import { decide } from "@/server/features/handbook/engine/robots";
import { AI_BOT_TOKENS } from "./ai-bot-tokens";
import { tryFetch } from "./fetch-collectors";

/**
 * Bot parity (handbook §0 P9, §18; FULL-READ §4 row 1, ADR-021). Probe:
 * home + the first sample of every template (8 URLs) as the browser and
 * every `BOT_USER_AGENTS` UA. When that probe shows a block (403/429/503 or
 * an interstitial) or a bot body that differs from the browser's, the
 * collector escalates: every page (≤ 200, stratified by template) × the 5
 * search / AI bots × 2 rounds, plus plain-HTTP on 10 URLs, one request per
 * 300 ms, and a UA stops after 5 blocked fetches in a row; any HTTP 429
 * stops the whole pass (the site throttles us, not a bot). Runs at every
 * depth: the trigger, not the depth, decides (the collector has no depth).
 */
type Fetch = BotFetchData["fetches"][number];
type Agent = Fetch["bot"];

const PROBE_URLS = 8;
/** Body excerpt kept as evidence for a blocked fetch (WO-B9-008). */
const EXCERPT_CHARS = 400;

const isBotName = (key: string): key is BotName => key in BOT_USER_AGENTS;
const ALL_BOTS = Object.keys(BOT_USER_AGENTS).filter(isBotName);

const bytesOf = (text: string) => new TextEncoder().encode(text);

/** Home, then the first sample of every template — capped at `max`. */
function probeUrls(
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
  max: number,
) {
  const urls = new Set([new URL("/", ctx.origin).href]);
  const templates =
    collected.templates?.status === "ok" ? collected.templates.templates : [];
  for (const t of templates) {
    const first = t.samples[0]?.url;
    if (first) urls.add(first);
  }
  return [...urls].slice(0, max);
}

/**
 * One fetch as `bot`. Plain-HTTP probes do not follow redirects: the
 * question is what `http://` itself answers (a redirect or a challenge).
 */
async function fetchAs(
  ctx: CollectorContext,
  url: string,
  bot: Agent,
  round: 1 | 2,
): Promise<Fetch | null> {
  const plainHttp = url.startsWith("http:") && ctx.origin.startsWith("https:");
  const res = await tryFetch(ctx, url, {
    ...(bot === "browser" ? {} : { userAgent: BOT_USER_AGENTS[bot] }),
    ...(plainHttp ? { maxRedirects: 0 } : {}),
  });
  if (!res) return null;
  const statusBlocked = [403, 429, 503].includes(res.status);
  const redirect = res.status >= 300 && res.status < 400;
  const hit =
    statusBlocked || redirect
      ? null
      : detectInterstitial(res.body, res.headers, res.finalUrl);
  const blocked = hit
    ? interstitialReason(hit)
    : statusBlocked
      ? `HTTP ${res.status}`
      : null;
  if (hit)
    ctx.log("handbook.botfetch.interstitial", {
      url,
      bot,
      round,
      status: res.status,
      reason: blocked,
    });
  return {
    url,
    bot,
    status: res.status,
    finalUrl: res.finalUrl,
    bytes: bytesOf(res.body).byteLength,
    words: extractHtmlFacts(res.body, res.finalUrl).words,
    bodySha256: await sha256Hex(res.body),
    blockedReason: blocked,
    ...(round === 2 ? { round } : {}),
    ...(blocked ? { excerpt: res.body.slice(0, EXCERPT_CHARS) } : {}),
  };
}

/** Resolves when at least `gapMs` has passed since the previous call. */
function createPacer(gapMs: number) {
  let next = 0;
  return async () => {
    const wait = next - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    next = Date.now() + gapMs;
  };
}

/** URLs where a bot's 200 body hash differs from the browser's. */
function hashSuspects(fetches: readonly Fetch[]): string[] {
  const browser = new Map(
    fetches
      .filter((f) => f.bot === "browser" && f.status === 200)
      .map((f) => [f.url, f.bodySha256]),
  );
  const urls = fetches.filter(
    (f) =>
      f.bot !== "browser" &&
      f.status === 200 &&
      !f.blockedReason &&
      browser.has(f.url) &&
      browser.get(f.url) !== f.bodySha256,
  );
  return [...new Set(urls.map((f) => f.url))];
}

/**
 * The escalated pass. Round 1 skips (bot, URL) pairs the probe already
 * fetched, so each bot ends with 2 fetches per planned URL; the browser is
 * fetched once per URL as the parity reference.
 */
async function escalate(
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
  probe: readonly Fetch[],
  pace: () => Promise<void>,
): Promise<Fetch[]> {
  const plan = botParityPlan(collected);
  const done = new Set(probe.map((f) => `${f.bot} ${f.url}`));
  const streak = new Map<Agent, number>();
  const stopped = new Set<Agent>();
  const out: Fetch[] = [];
  const get = async (url: string, bot: Agent, round: 1 | 2) => {
    await pace();
    const f = await fetchAs(ctx, url, bot, round);
    if (!f) return;
    out.push(f);
    // 429 to any UA = the site throttles this pass, not one bot: stop all.
    if (f.status === 429) {
      stopped.add("browser");
      ctx.log("handbook.botfetch.rate_limited", {
        bot,
        url,
        round,
        capped: true,
      });
      return;
    }
    if (bot === "browser") return;
    const n = f.blockedReason ? (streak.get(bot) ?? 0) + 1 : 0;
    streak.set(bot, n);
    if (n < BOT_PARITY_STOP_AFTER) return;
    stopped.add(bot);
    ctx.log("handbook.botfetch.ua_stopped", { bot, url, round, capped: true });
  };
  const urls = [...plan.urls, ...plan.httpUrls];
  for (const round of [1, 2] as const) {
    for (const url of urls) {
      if (stopped.has("browser") || stopped.size === BOT_PARITY_BOTS.length)
        return out;
      if (round === 1 && !done.has(`browser ${url}`))
        await get(url, "browser", 1);
      for (const bot of BOT_PARITY_BOTS) {
        if (stopped.has(bot) || (round === 1 && done.has(`${bot} ${url}`)))
          continue;
        await get(url, bot, round);
      }
    }
  }
  return out;
}

/**
 * AI-bot policy map (FULL-READ §3.9, WO-B9-028): home fetched once per
 * crawler token (≥ 300 ms apart) next to robots.txt's verdict for `/`
 * on the origin host; no robots.txt (HTTP 200) = allowed.
 */
async function collectPolicyMap(
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
  pace: () => Promise<void>,
): Promise<NonNullable<BotFetchData["policyMap"]>> {
  const home = new URL("/", ctx.origin);
  const file =
    collected.robots?.status === "ok"
      ? collected.robots.hosts.find(
          (h) => h.host === home.host && h.status === 200,
        )
      : undefined;
  const rows: NonNullable<BotFetchData["policyMap"]>[number][] = [];
  for (const { token, userAgent } of AI_BOT_TOKENS) {
    await pace();
    const res = await tryFetch(ctx, home.href, { userAgent });
    if (!res) continue;
    const hit =
      res.status === 200
        ? detectInterstitial(res.body, res.headers, res.finalUrl)
        : null;
    rows.push({
      token,
      robotsAllowed: file
        ? decide(home.host, file.groups, token, "/").allowed
        : true,
      status: res.status,
      blockedReason: hit ? interstitialReason(hit) : null,
    });
  }
  return rows;
}

export const botFetchCollector: Collector<"botFetch"> = {
  key: "botFetch",
  dependsOn: ["templates"],
  async collect(ctx, collected) {
    const probe: Fetch[] = [];
    const agents: Agent[] = ["browser", ...ALL_BOTS];
    for (const url of probeUrls(ctx, collected, PROBE_URLS)) {
      for (const bot of agents) {
        const f = await fetchAs(ctx, url, bot, 1);
        if (f) probe.push(f);
      }
    }
    if (probe.length === 0)
      return { status: "unavailable", reason: "no response" };
    // A second browser fetch tells a dynamic page from a bot-specific body.
    for (const url of hashSuspects(probe)) {
      const again = await fetchAs(ctx, url, "browser", 2);
      if (again) probe.push(again);
    }
    // One pacer: policy map + escalation never exceed 1 request / 300 ms.
    const pace = createPacer(BOT_PARITY_GAP_MS);
    const policyMap = await collectPolicyMap(ctx, collected, pace);
    const marked = markRepeatedSmallBodies(probe);
    const because = botParityTrigger(marked);
    if (!because) return { status: "ok", fetches: marked, policyMap };
    ctx.log("handbook.botfetch.escalate", { because });
    const more = await escalate(ctx, collected, marked, pace);
    return {
      status: "ok",
      fetches: markRepeatedSmallBodies([...marked, ...more]),
      policyMap,
    };
  },
};

/**
 * Hash rule (ADR-021): a bot UA that gets the same small body on ≥ 3 URLs is
 * being served one interstitial — unless the browser gets that same body on
 * the URL too (a tiny SPA shell is the page itself, not a challenge).
 */
function markRepeatedSmallBodies(fetches: readonly Fetch[]): Fetch[] {
  const browserHash = new Map(
    fetches
      .filter((f) => f.bot === "browser")
      .map((f) => [f.url, f.bodySha256]),
  );
  const repeatedByBot = new Map<string, Set<string>>();
  for (const bot of new Set(fetches.map((f) => f.bot))) {
    if (bot === "browser") continue;
    const tracker = smallBodyHashTracker();
    for (const f of fetches)
      if (f.bot === bot && f.status === 200)
        tracker.add(f.url, f.bytes, f.bodySha256);
    repeatedByBot.set(bot, tracker.repeated());
  }
  return fetches.map((f) =>
    !f.blockedReason &&
    repeatedByBot.get(f.bot)?.has(f.bodySha256) &&
    browserHash.get(f.url) !== f.bodySha256
      ? {
          ...f,
          blockedReason: interstitialReason({ vendor: null, rule: "hash" }),
        }
      : f,
  );
}
