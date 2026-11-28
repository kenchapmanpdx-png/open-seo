import { describe, expect, it, vi } from "vitest";
import {
  createSafeFetch,
  HANDBOOK_SHORT_USER_AGENT,
  HANDBOOK_USER_AGENT,
  SafeFetchBlockedError,
} from "./safe-fetch";

const redirect = (location: string) =>
  new Response(null, { status: 301, headers: { location } });

function setup(responses: Record<string, Response>) {
  const fetchImpl = vi.fn(
    async (url: string) =>
      responses[url] ?? new Response("nf", { status: 404 }),
  );
  const safeFetch = createSafeFetch({
    allowedHosts: ["example.com", "www.example.com"],
    fetchImpl,
    checkHost: async () => {},
    minIntervalMs: 0,
  });
  return { safeFetch, fetchImpl };
}

describe("safeFetch", () => {
  it("refuses out-of-scope hosts and private targets before fetching", async () => {
    const { safeFetch, fetchImpl } = setup({});
    await expect(safeFetch("https://other.com/")).rejects.toBeInstanceOf(
      SafeFetchBlockedError,
    );
    await expect(safeFetch("http://127.0.0.1/")).rejects.toBeInstanceOf(
      SafeFetchBlockedError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("follows in-scope redirects and stops at an off-scope or private hop", async () => {
    const { safeFetch, fetchImpl } = setup({
      "http://example.com/": redirect("https://www.example.com/"),
      "https://www.example.com/": new Response("<p>ok</p>", { status: 200 }),
      "https://example.com/out": redirect("http://169.254.169.254/latest"),
    });
    const ok = await safeFetch("http://example.com/");
    expect(ok).toMatchObject({
      status: 200,
      finalUrl: "https://www.example.com/",
      body: "<p>ok</p>",
    });
    expect(ok.redirectChain).toEqual([
      { url: "http://example.com/", status: 301 },
    ]);

    const stopped = await safeFetch("https://example.com/out");
    expect(stopped).toMatchObject({
      status: 301,
      finalUrl: "https://example.com/out",
    });
    expect(fetchImpl).not.toHaveBeenCalledWith(
      "http://169.254.169.254/latest",
      expect.anything(),
    );
  });

  it("off-site mode fetches any public host but still refuses private targets", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const offsite = createSafeFetch({
      allowedHosts: "any",
      fetchImpl,
      checkHost: async () => {},
      minIntervalMs: 0,
    });
    await expect(
      offsite("https://partner.example.org/"),
    ).resolves.toMatchObject({ status: 200 });
    await expect(offsite("http://10.0.0.1/")).rejects.toBeInstanceOf(
      SafeFetchBlockedError,
    );
  });

  it("does not read a body the server sends whole for a ranged request", async () => {
    const { safeFetch } = setup({
      "https://example.com/v.mp4": new Response("x".repeat(5000), {
        status: 200,
      }),
    });
    const res = await safeFetch("https://example.com/v.mp4", {
      headers: { range: "bytes=0-0" },
    });
    expect(res).toMatchObject({ status: 200, body: "" });
  });
});

/** WO-B27-001: one short-name retest when the site refuses the full name. */
const ua = (init: RequestInit) =>
  new Headers(init.headers).get("user-agent") ?? "";
const ok = () => new Response("ok", { status: 200 });

describe("safeFetch short-name retest", () => {
  function refusing(refuse: (userAgent: string) => Response | "drop") {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const out = refuse(ua(init));
      if (out === "drop") throw new TypeError("fetch failed");
      return out;
    });
    const safeFetch = createSafeFetch({
      allowedHosts: ["example.com"],
      fetchImpl,
      checkHost: async () => {},
      minIntervalMs: 0,
      shortNameRetry: true,
    });
    return {
      safeFetch,
      agents: () => fetchImpl.mock.calls.map(([, i]) => ua(i)),
    };
  }
  it("switches for the rest of the fetcher after one refused request", async () => {
    const { safeFetch, agents } = refusing((agent) =>
      agent === HANDBOOK_USER_AGENT ? "drop" : ok(),
    );
    expect(await safeFetch("https://example.com/")).toMatchObject({
      status: 200,
      shortName: true,
    });
    await safeFetch("https://example.com/a");
    expect(agents()).toEqual([
      HANDBOOK_USER_AGENT,
      HANDBOOK_SHORT_USER_AGENT,
      HANDBOOK_SHORT_USER_AGENT,
    ]);
  });

  it("retests a 403 and keeps the 403 when the short name is refused too", async () => {
    const { safeFetch, agents } = refusing(
      () => new Response("no", { status: 403 }),
    );
    expect(await safeFetch("https://example.com/")).toMatchObject({
      status: 403,
    });
    await safeFetch("https://example.com/a");
    // Both names refused: no switch and no further retests.
    expect(agents()).toEqual([
      HANDBOOK_USER_AGENT,
      HANDBOOK_SHORT_USER_AGENT,
      HANDBOOK_USER_AGENT,
    ]);
  });

  it("never retests a site that answers the full name, or a named bot", async () => {
    const { safeFetch, agents } = refusing((agent) =>
      agent === "Googlebot" ? new Response("no", { status: 403 }) : ok(),
    );
    const res = await safeFetch("https://example.com/");
    await safeFetch("https://example.com/", { userAgent: "Googlebot" });
    expect(res.shortName).toBeUndefined();
    expect(agents()).toEqual([HANDBOOK_USER_AGENT, "Googlebot"]);
  });
});
