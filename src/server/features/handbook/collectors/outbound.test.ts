import { sort } from "remeda";
import { describe, expect, it } from "vitest";
import type {
  CollectorContext,
  PageSnapshot,
  SafeFetch,
} from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";
import { outboundCollector } from "./outbound";

const calls: string[] = [];
/** `https://<status-for-HEAD>-<status-for-GET>.test/` answers by method. */
const fetchOffsite: SafeFetch = async (url, init) => {
  const [head, get] = new URL(url).hostname.split(".")[0].split("-");
  calls.push(
    `${init?.method} ${url} ${init?.userAgent?.includes("Googlebot") ? "bot" : "browser"}`,
  );
  return {
    url,
    finalUrl: url,
    status: Number(init?.method === "HEAD" ? head : get),
    headers: [],
    body: "",
    truncated: false,
    redirectChain: [],
    timingMs: 1,
  };
};

const ctx: CollectorContext = {
  runId: "r1",
  origin: "https://example.com",
  fetch: () => Promise.reject(new Error("unused")),
  fetchOffsite,
  storeBody: async (kind, url) => `${kind}:${url}`,
  log: () => {},
};

const collect = async (snapshots: PageSnapshot[]) => {
  const result = await outboundCollector.collect(ctx, {
    pages: { status: "ok", snapshots },
  });
  if (result.status !== "ok") throw new Error(result.reason);
  return result.links;
};

describe("outbound collector", () => {
  it("probes up to 500 unique links, most-linked first", async () => {
    const many = Array.from(
      { length: 520 },
      (_, i) => `https://200-200-${i}.test/`,
    );
    const shared = "https://200-200-shared.test/";
    const links = await collect([
      snapshot("/a", { links: [...many, shared] }),
      snapshot("/b", { links: [shared] }),
    ]);
    expect(links).toHaveLength(500);
    expect(links[0].url).toBe(shared);
  });

  it("falls back from HEAD 405 to GET and asks Googlebot only after a non-2xx", async () => {
    calls.length = 0;
    const links = await collect([
      snapshot("/", {
        links: ["https://405-200.test/", "https://404-404.test/"],
      }),
    ]);
    expect(links.map((l) => [l.browser?.status, l.bot?.status])).toEqual([
      [200, undefined],
      [404, 404],
    ]);
    expect(sort(calls, (a, b) => a.localeCompare(b))).toEqual([
      "GET https://404-404.test/ bot",
      "GET https://405-200.test/ browser",
      "HEAD https://404-404.test/ browser",
      "HEAD https://405-200.test/ browser",
    ]);
  });
});
