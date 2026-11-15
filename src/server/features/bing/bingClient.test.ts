import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bingDateToDay,
  bingPositionOrNull,
  getBlockedUrls,
  getCrawlIssues,
  getCrawlStats,
  getFeeds,
  getPageStats,
  getQueryStats,
  getRankAndTrafficStats,
  getSites,
  getUrlInfo,
  getUrlSubmissionQuota,
  isBlockingCrawlIssue,
  parseBingDate,
} from "./bingClient";
import { BingApiError } from "./bingTypes";

// Fixtures are Canonry's captured live responses (anonymised upstream).
const fixture = (name: string) =>
  readFileSync(path.join(__dirname, "__fixtures__", `${name}.json`), "utf8");

const SITE = "https://example.com/";
const KEY = "secret-key-abc123";
const fetchMock = vi.fn<typeof fetch>();

function respond(body: string, status = 200, headers: HeadersInit = {}) {
  fetchMock.mockImplementation(
    async () => new Response(body, { status, headers }),
  );
}

// Drive fake timers until the call settles (the key digest resolves off the timer queue).
async function settle(call: Promise<unknown>): Promise<unknown> {
  const state = { done: false };
  const result = call.then(
    (value) => value,
    (error: unknown) => error,
  );
  void result.finally(() => {
    state.done = true;
  });
  while (!state.done) await vi.advanceTimersByTimeAsync(31_000);
  return result;
}

function calledUrl(): URL {
  const input = fetchMock.mock.calls.at(-1)?.[0];
  if (input === undefined) throw new Error("no Bing call was made");
  return new URL(input instanceof Request ? input.url : input);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Bing read methods on captured fixtures", () => {
  it("getSites unwraps `d` and keeps IsVerified", async () => {
    respond(JSON.stringify({ d: [{ Url: SITE, IsVerified: true }] }));
    expect(await getSites(KEY)).toEqual([{ Url: SITE, IsVerified: true }]);
    expect(calledUrl().pathname).toMatch(/\/GetUserSites$/);
    expect(calledUrl().searchParams.get("apikey")).toBe(KEY);
  });

  it("getUrlInfo sends siteUrl + url and parses dates", async () => {
    respond(fixture("GetUrlInfo"));
    const info = await getUrlInfo(KEY, SITE, SITE);
    expect(calledUrl().searchParams.get("siteUrl")).toBe(SITE);
    expect(calledUrl().searchParams.get("url")).toBe(SITE);
    expect(info.IsPage).toBe(true);
    expect(parseBingDate(info.LastCrawledDate)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("crawl stats and crawl issues", async () => {
    respond(fixture("GetCrawlStats"));
    const stats = await getCrawlStats(KEY, SITE);
    expect(stats.length).toBeGreaterThan(0);
    expect(stats[0]).toMatchObject({ CrawledPages: 5, InIndex: 5 });
    respond(fixture("GetCrawlIssues"));
    expect(await getCrawlIssues(KEY, SITE)).toEqual([]);
  });

  it("daily traffic rows map to UTC days", async () => {
    respond(fixture("GetRankAndTrafficStats"));
    const rows = await getRankAndTrafficStats(KEY, SITE);
    expect(rows.map((r) => bingDateToDay(r.Date))).toEqual([
      "2026-05-13",
      "2026-06-15",
      "2026-06-19",
      "2026-06-22",
    ]);
  });

  it("query and page stats keep the -1 click-position sentinel as null", async () => {
    respond(fixture("GetQueryStats"));
    const queries = await getQueryStats(KEY, SITE);
    expect(queries[0].Query).toBe("example query 1");
    expect(bingPositionOrNull(queries[0].AvgClickPosition)).toBeNull();
    expect(bingPositionOrNull(queries[0].AvgImpressionPosition)).toBe(5);
    respond(fixture("GetPageStats"));
    const pages = await getPageStats(KEY, SITE);
    expect(pages[0].Query).toMatch(/^https:\/\/example\.com\//);
  });

  it("feeds, blocked URLs and quota", async () => {
    respond(fixture("GetFeeds"));
    const feeds = await getFeeds(KEY, SITE);
    expect(feeds[0]).toMatchObject({
      Type: "Sitemap Index",
      Status: "Success",
    });
    respond(fixture("GetBlockedUrls"));
    expect(await getBlockedUrls(KEY, SITE)).toEqual([]);
    respond(fixture("GetUrlSubmissionQuota"));
    expect(await getUrlSubmissionQuota(KEY, SITE)).toMatchObject({
      DailyQuota: 100,
      MonthlyQuota: 2700,
    });
  });
});

describe("errors and throttling", () => {
  it("never puts the key in a thrown error message", async () => {
    respond(`{"Message":"bad key ${KEY}"}`, 400);
    const err = await getQueryStats(KEY, SITE).catch((e: unknown) => e);
    if (!(err instanceof BingApiError)) throw err;
    expect(err.message).not.toContain(KEY);
    expect(err.message).toContain("***");
    expect(fetchMock).toHaveBeenCalledTimes(1); // plain 400 is not retried
  });

  it("redacts the key from a network failure after retries", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError(`fetch failed for ${KEY}`));
    const err = await settle(getQueryStats(KEY, SITE));
    expect(String(err)).toContain("fetch failed");
    expect(String(err)).not.toContain(KEY);
  });

  it("retries a throttle, then cools the key down so the next call is not sent", async () => {
    const key = "throttled-key";
    vi.useFakeTimers();
    respond('{"ErrorCode":5,"Message":"ERROR!!! ThrottleHost"}', 400);
    const err = await settle(getQueryStats(key, SITE));
    expect(err).toMatchObject({ isThrottle: true, retryCount: 4 });
    expect(fetchMock).toHaveBeenCalledTimes(5);

    fetchMock.mockClear();
    await expect(getQueryStats(key, SITE)).rejects.toMatchObject({
      status: 429,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    respond(fixture("GetQueryStats"));
    await expect(getQueryStats(key, SITE)).resolves.toHaveLength(3);
  });

  it("rejects a response that does not match the schema", async () => {
    respond(JSON.stringify({ d: [{ Query: 1 }] }));
    await expect(getQueryStats(KEY, SITE)).rejects.toMatchObject({
      status: 502,
    });
  });
});

describe("helpers", () => {
  it("parseBingDate handles offsets and the never sentinel", () => {
    expect(parseBingDate("/Date(1786665600000-0700)/")).toBe(
      "2026-08-14T00:00:00.000Z",
    );
    expect(parseBingDate("/Date(-62135596800000)/")).toBeNull();
    expect(parseBingDate(null)).toBeNull();
  });

  it("isBlockingCrawlIssue treats only SEO flags as non-blocking", () => {
    expect(isBlockingCrawlIssue("SeoIssues SeoConcerns")).toBe(false);
    expect(isBlockingCrawlIssue("None")).toBe(false);
    expect(isBlockingCrawlIssue("SeoIssues BlockedByRobotsTxt")).toBe(true);
    expect(isBlockingCrawlIssue(undefined)).toBe(true);
  });
});
