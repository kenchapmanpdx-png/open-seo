import { describe, expect, it, vi } from "vitest";
import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import { probeMediaSizes } from "./media-sizes";

type Reply = { status: number; headers: [string, string][] };

/** `head` answers HEAD requests; `get` answers the ranged GET fallback. */
function ctx(head: Reply, get: Reply = { status: 405, headers: [] }) {
  const fetchOffsite = vi.fn(
    async (url: string, init?: { method?: string }) => ({
      url,
      finalUrl: url,
      ...(init?.method === "HEAD" ? head : get),
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
    const { ctx: c, fetchOffsite } = ctx({
      status: 200,
      headers: [["content-length", "12000000"]],
    });
    expect(await probeMediaSizes(c, ["https://cdn.example/v.mp4"])).toEqual([
      { url: "https://cdn.example/v.mp4", bytes: 12_000_000, method: "head" },
    ]);
    expect(fetchOffsite.mock.calls[0][1]).toMatchObject({ method: "HEAD" });
  });

  it("falls back to a Range request when HEAD is refused", async () => {
    const { ctx: c, fetchOffsite } = ctx(
      { status: 405, headers: [] },
      { status: 206, headers: [["content-range", "bytes 0-0/7340032"]] },
    );
    expect(await probeMediaSizes(c, ["https://cdn.example/v.mp4"])).toEqual([
      { url: "https://cdn.example/v.mp4", bytes: 7_340_032, method: "range" },
    ]);
    expect(fetchOffsite.mock.calls[1][1]).toMatchObject({
      headers: { range: "bytes=0-0" },
    });
  });

  it("records unknown when the server ignores Range (200, no total)", async () => {
    const { ctx: c } = ctx(
      { status: 405, headers: [] },
      { status: 200, headers: [["content-length", "7340032"]] },
    );
    expect(await probeMediaSizes(c, ["https://cdn.example/v.mp4"])).toEqual([
      { url: "https://cdn.example/v.mp4", bytes: null, method: "unknown" },
    ]);
  });

  it("probes at most 200 unique URLs", async () => {
    const { ctx: c, fetchOffsite } = ctx({
      status: 200,
      headers: [["content-length", "1"]],
    });
    const urls = Array.from(
      { length: 250 },
      (_, i) => `https://cdn.example/${i}.mp4`,
    );
    expect(await probeMediaSizes(c, [...urls, urls[0]])).toHaveLength(200);
    expect(fetchOffsite).toHaveBeenCalledTimes(200);
  });
});
