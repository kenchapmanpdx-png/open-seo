import { describe, expect, it, vi } from "vitest";
import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import { probeMediaSizes } from "./media-sizes";

function ctx(status: number, length: string | null) {
  const fetchOffsite = vi.fn(
    async (url: string, _init?: { method?: string }) => ({
      url,
      finalUrl: url,
      status,
      headers: length ? [["content-length", length] as const] : [],
      body: "",
      truncated: false,
      redirectChain: [],
      timingMs: 1,
    }),
  );
  const c: CollectorContext = {
    runId: "r1",
    origin: "https://example.com",
    fetch: () => Promise.reject(new Error("unused")),
    fetchOffsite,
    storeBody: async (kind, url) => `${kind}:${url}`,
    log: () => {},
  };
  return { fetchOffsite, ctx: c };
}

describe("probeMediaSizes", () => {
  it("reads Content-Length from a HEAD", async () => {
    const { ctx: c, fetchOffsite } = ctx(200, "12000000");
    expect(await probeMediaSizes(c, ["https://cdn.example/v.mp4"])).toEqual([
      { url: "https://cdn.example/v.mp4", bytes: 12_000_000, method: "head" },
    ]);
    expect(fetchOffsite.mock.calls[0][1]).toMatchObject({ method: "HEAD" });
  });

  it("records HEAD 405 as unknown (no body download)", async () => {
    const { ctx: c } = ctx(405, null);
    expect(await probeMediaSizes(c, ["https://cdn.example/v.mp4"])).toEqual([
      { url: "https://cdn.example/v.mp4", bytes: null, method: "unknown" },
    ]);
  });

  it("probes at most 200 unique URLs", async () => {
    const { ctx: c, fetchOffsite } = ctx(200, "1");
    const urls = Array.from(
      { length: 250 },
      (_, i) => `https://cdn.example/${i}.mp4`,
    );
    expect(await probeMediaSizes(c, [...urls, urls[0]])).toHaveLength(200);
    expect(fetchOffsite).toHaveBeenCalledTimes(200);
  });
});
