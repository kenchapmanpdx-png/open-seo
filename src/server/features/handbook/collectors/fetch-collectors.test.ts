import { describe, expect, it, vi } from "vitest";
import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";
import {
  llmsCollector,
  robotsCollector,
  sitemapCollector,
} from "./fetch-collectors";

const ORIGIN = "https://example.com";
const pages = Array.from({ length: 250 }, (_, i) => snapshot(`/p${i}`));

async function probed(withLlmsTxt: boolean) {
  const mdFetches: string[] = [];
  const ctx: CollectorContext = {
    runId: "r1",
    origin: ORIGIN,
    fetch: async (url) => {
      if (url.endsWith(".md")) mdFetches.push(url);
      const found = url.endsWith("/llms.txt") && withLlmsTxt;
      return {
        url,
        finalUrl: url,
        status: found ? 200 : 404,
        headers: [["content-type", "text/plain"]],
        body: found ? "# Example" : "",
        truncated: false,
        redirectChain: [],
        timingMs: 1,
      };
    },
    fetchOffsite: () => Promise.reject(new Error("unused")),
    storeBody: async (kind, url) => `${kind}:${url}`,
    log: () => {},
  };
  await llmsCollector.collect(ctx, {
    pages: { status: "ok", snapshots: pages },
  });
  return mdFetches.length;
}

describe("llms collector .md mirrors", () => {
  it("probes every page's mirror up to 200 once llms.txt exists, else the first 5", async () => {
    expect(await probed(true)).toBe(200);
    expect(await probed(false)).toBe(5);
  });
});

describe("sitemap collector", () => {
  it("retries a 5xx sitemap once and records the second answer", async () => {
    vi.useFakeTimers();
    const statuses = [503, 200];
    const ctx: CollectorContext = {
      runId: "r1",
      origin: ORIGIN,
      fetch: async (url) => ({
        url,
        finalUrl: url,
        status: statuses.shift() ?? 404,
        headers: [["content-type", "application/xml"]],
        body: `<urlset><url><loc>${ORIGIN}/a</loc></url></urlset>`,
        truncated: false,
        redirectChain: [],
        timingMs: 1,
      }),
      fetchOffsite: () => Promise.reject(new Error("unused")),
      storeBody: async (kind, url) => `${kind}:${url}`,
      log: () => {},
    };
    const pending = sitemapCollector.collect(ctx, {});
    await vi.runAllTimersAsync();
    const data = await pending;
    vi.useRealTimers();
    expect(data.status).toBe("ok");
    if (data.status !== "ok") return;
    expect(data.sources.map((s) => s.status)).toEqual([200]);
    expect(data.urls.map((u) => u.loc)).toEqual([`${ORIGIN}/a`]);
  });
});

describe("robots collector", () => {
  // bluetreefunding.com b21r100: the apex robots.txt timed out, the www
  // sibling answered 301, and "no Sitemap: line" was reported (WO-B21-006).
  function ctxWith(apexFails: number): CollectorContext {
    return {
      runId: "r1",
      origin: ORIGIN,
      fetch: async (url) => {
        const www = url.startsWith("https://www.");
        if (!www && apexFails-- > 0) throw new Error("TimeoutError");
        return {
          url,
          finalUrl: url,
          status: www ? 301 : 200,
          headers: [["content-type", "text/plain"]],
          body: www ? "" : "User-agent: *\nSitemap: https://example.com/s.xml",
          truncated: false,
          redirectChain: [],
          timingMs: 1,
        };
      },
      fetchOffsite: () => Promise.reject(new Error("unused")),
      storeBody: async (kind, url) => `${kind}:${url}`,
      log: () => {},
    };
  }

  async function collect(apexFails: number) {
    vi.useFakeTimers();
    const pending = robotsCollector.collect(ctxWith(apexFails), {});
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    return pending;
  }

  it("retries a failed origin robots.txt once and keeps its Sitemap: line", async () => {
    const data = await collect(1);
    expect(data.status).toBe("ok");
    if (data.status !== "ok") return;
    expect(data.hosts.flatMap((h) => h.sitemaps)).toEqual([
      "https://example.com/s.xml",
    ]);
  });

  it("is unavailable when the origin robots.txt never answers, even if the sibling does", async () => {
    const data = await collect(2);
    expect(data.status).toBe("unavailable");
  });
});
