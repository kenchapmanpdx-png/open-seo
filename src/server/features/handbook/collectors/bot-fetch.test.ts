import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOT_USER_AGENTS,
  type BotFetchData,
  type CollectedData,
  type CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
import { AI_BOT_TOKENS } from "./ai-bot-tokens";
import { botFetchCollector } from "./bot-fetch";

const ORIGIN = "http://example.test";
const href = (path: string) => new URL(path, ORIGIN).href;

type Call = { url: string; bot: string; at: number };

const botOf = (userAgent: string | undefined) =>
  Object.entries(BOT_USER_AGENTS).find(([, ua]) => ua === userAgent)?.[0] ??
  "browser";

/** Site whose `blocks(bot, url)` answers 403; everything else a full page. */
function site(blocks: (bot: string, url: string) => boolean) {
  const calls: Call[] = [];
  const log = vi.fn();
  const ctx: CollectorContext = {
    runId: "r1",
    origin: ORIGIN,
    fetch: async (url, init) => {
      const bot = botOf(init?.userAgent);
      calls.push({ url, bot, at: Date.now() });
      const status = blocks(bot, url) ? 403 : 200;
      return {
        url,
        finalUrl: url,
        status,
        headers: [],
        body: `<html><body><p>${url} ${"word ".repeat(80)}</p></body></html>`,
        truncated: false,
        redirectChain: [],
        timingMs: 1,
      };
    },
    fetchOffsite: () => Promise.reject(new Error("unused")),
    storeBody: async (kind, url) => `${kind}:${url}`,
    log,
  };
  return { ctx, calls, log };
}

/** One template; its first page is home, the only probe URL besides it. */
function templates(paths: string[]): Partial<CollectedData> {
  return {
    templates: {
      status: "ok",
      templates: [
        {
          key: "t",
          urlPattern: "/*",
          skeletonHash: "h",
          urls: paths.map(href),
          samples: [{ url: href("/"), rank: 1, reason: "first" }],
        },
      ],
    },
  };
}

async function collect(
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
) {
  const state = { done: false };
  const run = botFetchCollector.collect(ctx, collected).finally(() => {
    state.done = true;
  });
  // Pacing waits on fake timers; let real I/O (sha256) settle in between.
  while (!state.done) {
    await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(300);
  }
  const result = await run;
  if (result.status !== "ok") throw new Error("collector unavailable");
  return result.fetches;
}

const count = (fetches: BotFetchData["fetches"], bot: string) =>
  fetches.filter((f) => f.bot === bot).length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("botFetch escalation", () => {
  it("does not escalate when every bot gets the browser page", async () => {
    const { ctx, calls } = site(() => false);
    await collect(ctx, templates(["/", "/a", "/b"]));
    expect(calls).toHaveLength(
      Object.keys(BOT_USER_AGENTS).length + 1 + AI_BOT_TOKENS.length,
    );
  });

  it("fetches every page twice per bot once a probe is blocked", async () => {
    const { ctx } = site(
      (bot, url) => bot === "PerplexityBot" && url === href("/"),
    );
    const fetches = await collect(ctx, templates(["/", "/a", "/b", "/c"]));
    for (const bot of [
      "Googlebot",
      "Bingbot",
      "OAI-SearchBot",
      "PerplexityBot",
      "ClaudeBot",
    ]) {
      expect(count(fetches, bot)).toBe(8);
      expect(
        fetches.filter((f) => f.bot === bot && f.round === 2),
      ).toHaveLength(4);
    }
    expect(count(fetches, "GPTBot")).toBe(1);
    expect(count(fetches, "browser")).toBe(4);
  });

  it("stops a UA after 5 blocks in a row and spaces requests ≥ 300 ms", async () => {
    const { ctx, calls, log } = site((bot) => bot === "ClaudeBot");
    const paths = ["/", ...Array.from({ length: 9 }, (_, i) => `/p${i}`)];
    const fetches = await collect(ctx, templates(paths));
    // 1 probe fetch + 5 escalated blocks, then no more ClaudeBot requests.
    expect(count(fetches, "ClaudeBot")).toBe(6);
    expect(log).toHaveBeenCalledWith(
      "handbook.botfetch.ua_stopped",
      expect.objectContaining({ bot: "ClaudeBot", capped: true }),
    );
    // Policy map + escalation share the pacer.
    const escalated = calls.slice(Object.keys(BOT_USER_AGENTS).length + 1);
    const gaps = escalated
      .slice(1)
      .map((c, i) => c.at - (escalated[i]?.at ?? 0));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(300);
  });

  it("stops the whole pass on HTTP 429", async () => {
    const { ctx, log } = site(() => false);
    const fetch = ctx.fetch;
    ctx.fetch = async (url, init) => {
      const res = await fetch(url, init);
      const bot = botOf(init?.userAgent);
      if (bot === "GPTBot") return { ...res, status: 403 };
      return url === href("/a") ? { ...res, status: 429 } : res;
    };
    const fetches = await collect(ctx, templates(["/", "/a", "/b"]));
    expect(fetches.some((f) => f.url === href("/b"))).toBe(false);
    expect(log).toHaveBeenCalledWith(
      "handbook.botfetch.rate_limited",
      expect.objectContaining({ capped: true }),
    );
  });
});
