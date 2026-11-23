import { describe, expect, it } from "vitest";
import type {
  CollectedData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { crawlCoverageCheck } from "./crawl-coverage";

const abs = (path: string) => new URL(path, ORIGIN).href;

function run(snapshots: PageSnapshot[], sitemapPaths: string[] = []) {
  const groups = new Map<string, string[]>();
  for (const s of snapshots) {
    const path = new URL(s.url).pathname;
    const pattern =
      path.startsWith("/events/") && path !== "/events/" ? "/events/*" : "/*";
    groups.set(pattern, [...(groups.get(pattern) ?? []), s.url]);
  }
  const collected: Partial<CollectedData> = {
    pages: { status: "ok", snapshots },
    templates: {
      status: "ok",
      templates: [...groups].map(([urlPattern, urls]) => ({
        key: urlPattern,
        urlPattern,
        skeletonHash: "x",
        urls,
        samples: [],
      })),
    },
    sitemap: {
      status: "ok",
      sources: [
        {
          url: abs("/sitemap.xml"),
          status: 200,
          kind: "urlset",
          storageKey: null,
          errors: [],
        },
      ],
      urls: sitemapPaths.map((p) => ({
        loc: abs(p),
        lastmod: null,
        source: abs("/sitemap.xml"),
      })),
    },
  };
  return crawlCoverageCheck.run(context(collected));
}

describe("crawl.coverage", () => {
  it("opens P2-10 for a detail page with no index inlink", async () => {
    const result = await run([
      snapshot("/events/", { links: ["/events/a-1"] }),
      snapshot("/events/a-1"),
      snapshot("/events/b-2"),
    ]);
    expect(
      result.findings.find((f) => f.itemIds.includes("P2-10"))?.urls,
    ).toEqual([abs("/events/b-2")]);
  });

  it("counts an index link with a query (Shopify ?variant=) as an inlink", async () => {
    const result = await run([
      snapshot("/events/", { links: ["/events/a-1?variant=7", "/events/b-2"] }),
      snapshot("/events/a-1"),
      snapshot("/events/b-2"),
    ]);
    expect(statusOf(result, "P2-10")).toBe("PASS");
  });

  it("opens P2-12 on an underscore slug", async () => {
    const result = await run([snapshot("/"), snapshot("/bad_slug")]);
    expect(statusOf(result, "P2-12")).toBe("OPEN");
  });

  it("opens P2-12 when .html and extensionless page URLs mix", async () => {
    const result = await run([
      snapshot("/"),
      snapshot("/pages/about.html"),
      snapshot("/contact"),
    ]);
    expect(statusOf(result, "P2-12")).toBe("OPEN");
  });

  it("records coverage counts and JS-only links in the P3-13 note", async () => {
    const jsOnly = { ...snapshot("/a"), discoveredBy: "render" as const };
    const result = await run([snapshot("/"), jsOnly], ["/", "/b"]);
    expect(result.statuses.find((s) => s.itemId === "P3-13")?.note).toBe(
      "sitemap 2 · crawled 2 · both 1 · sitemap-only 1 · crawled-only 1 · JS-only links: 1",
    );
  });
});
