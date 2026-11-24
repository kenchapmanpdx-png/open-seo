import { describe, expect, it, vi } from "vitest";
import type {
  CollectorContext,
  SafeFetch,
  SafeFetchResult,
} from "@/server/features/handbook/contracts/collectors";
import { BROWSER_UA, hostPacer, probeUrl } from "./probe";

const ctx: CollectorContext = {
  runId: "r1",
  origin: "https://example.com",
  fetch: () => Promise.reject(new Error("unused")),
  fetchOffsite: () => Promise.reject(new Error("unused")),
  storeBody: async (kind, url) => `${kind}:${url}`,
  log: () => {},
};

const answer = (status: number): SafeFetchResult => ({
  url: "https://example.com/a",
  finalUrl: "https://example.com/a",
  status,
  headers: [],
  body: "",
  truncated: false,
  redirectChain: [],
  timingMs: 1,
});

/** Fake fetcher: `reply(method, userAgent)` → status, or throws on null. */
const fetcher =
  (reply: (method: string, ua?: string) => number | null): SafeFetch =>
  async (_url, init) => {
    const status = reply(init?.method ?? "GET", init?.userAgent);
    if (status === null) throw new Error("ENOTFOUND");
    return answer(status);
  };

const probe = (reply: (method: string, ua?: string) => number | null) =>
  probeUrl(ctx, fetcher(reply), hostPacer(0), "https://example.com/a");

describe("probeUrl", () => {
  it("falls back to GET when HEAD is refused", async () => {
    expect(await probe((m) => (m === "HEAD" ? 405 : 200))).toMatchObject({
      status: 200,
      method: "GET",
    });
  });

  it("retests a 403 as a browser", async () => {
    const p = await probe((_, ua) => (ua === BROWSER_UA ? 200 : 403));
    expect(p).toMatchObject({ status: 403, browserRetest: { status: 200 } });
  });

  it("returns null when nothing answers", async () => {
    expect(await probe(() => null)).toBeNull();
  });
});

describe("hostPacer", () => {
  it("spaces a host out after it answers 429; other hosts keep their pace", async () => {
    vi.useFakeTimers();
    const pace = hostPacer(300);
    const done: string[] = [];
    pace.slowDown("https://a.test/1");
    void pace.wait("https://a.test/2").then(() => done.push("a"));
    void pace.wait("https://b.test/2").then(() => done.push("b"));
    await vi.advanceTimersByTimeAsync(300);
    expect(done).toEqual(["b"]);
    await vi.advanceTimersByTimeAsync(700);
    expect(done).toEqual(["b", "a"]);
    vi.useRealTimers();
  });
});
