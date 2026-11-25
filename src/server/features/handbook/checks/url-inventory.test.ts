import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sort } from "remeda";
import { describe, expect, it } from "vitest";
import { context, ORIGIN, snapshot } from "./check-test-fixtures";
import { urlInventoryCheck } from "./url-inventory";

describe("crawl.url-inventory", () => {
  it("reconciles sitemap, canonicals and internal links", async () => {
    const locs = ["/", "/a", "/orphan", "/dup"];
    const result = await urlInventoryCheck.run(
      context({
        sitemap: {
          status: "ok",
          sources: [
            {
              url: `${ORIGIN}/sitemap.xml`,
              status: 200,
              kind: "urlset",
              storageKey: null,
              errors: [],
            },
          ],
          urls: locs.map((p) => ({
            loc: new URL(p, ORIGIN).href,
            lastmod: null,
            source: `${ORIGIN}/sitemap.xml`,
          })),
        },
        pages: {
          status: "ok",
          snapshots: [
            snapshot("/", { links: ["/a", "/dup", "/b"] }),
            snapshot("/a", { links: ["/"] }),
            snapshot("/orphan"),
            snapshot("/dup", { canonical: "/a" }),
            snapshot("/b"),
          ],
        },
      }),
    );
    const byTitle = Object.fromEntries(
      result.findings.map((f) => [f.title, f.urls]),
    );
    expect(byTitle).toEqual({
      "Sitemap <loc> canonicalises to another URL": [`${ORIGIN}/dup`],
      "Sitemap URLs without an internal link (orphans)": [`${ORIGIN}/orphan`],
      "Sitemap URLs with only one internal link": [`${ORIGIN}/a`],
      "Indexable pages missing from the sitemap": [`${ORIGIN}/b`],
      // WO-B20-014 (c): pages outside the sitemap get the one-inlink rule too.
      "Pages with only one internal link": [`${ORIGIN}/b`],
    });
  });

  const noSitemapRun = (robotsStatus: number) =>
    urlInventoryCheck.run(
      context({
        sitemap: {
          status: "ok",
          sources: [
            {
              url: `${ORIGIN}/sitemap.xml`,
              status: 404,
              kind: "invalid",
              storageKey: null,
              errors: [],
            },
          ],
          urls: [],
        },
        robots: {
          status: "ok",
          hosts: [
            {
              host: "example.com",
              status: robotsStatus,
              storageKey: null,
              groups: [],
              sitemaps: [],
              parseWarnings: [],
            },
          ],
          decisions: [],
        },
        pages: {
          status: "ok",
          snapshots: [
            snapshot("/", { links: ["/a", "/b"] }),
            snapshot("/a", { links: ["/b"] }),
            snapshot("/b", { links: ["/"] }),
          ],
        },
      }),
    );

  it("reports a missing sitemap and falls back to the crawl link graph (WO-B19-013)", async () => {
    const result = await noSitemapRun(200);
    const byTitle = Object.fromEntries(
      result.findings.map((f) => [f.title, f.urls]),
    );
    expect(byTitle).toEqual({
      "No XML sitemap": [`${ORIGIN}/sitemap.xml`],
      "robots.txt has no Sitemap: line": [`${ORIGIN}/robots.txt`],
      "Pages with only one internal link": [`${ORIGIN}/a`],
    });
    expect(result.findings[0].detail).toContain("/sitemap.xml — HTTP 404");
  });

  it("leaves a missing robots.txt to P3-15, not 'no Sitemap: line' (WO-B20-011)", async () => {
    const result = await noSitemapRun(404);
    expect(result.findings.map((f) => f.itemIds[0])).not.toContain("P3-19");
  });
});

// WO-B21-003: aweandorderorganizing.com (https) lists its pages as http://
// in the sitemap. One defect (wrong scheme) read as "redirects" + "missing".
const http = (path: string) => `http://example.com${path}`;

describe("crawl.url-inventory sitemap scheme", () => {
  const run = (locs: string[], snapshots: ReturnType<typeof snapshot>[]) =>
    urlInventoryCheck.run(
      context({
        sitemap: {
          status: "ok",
          sources: [
            {
              url: `${ORIGIN}/sitemap.xml`,
              status: 200,
              kind: "urlset",
              storageKey: null,
              errors: [],
            },
          ],
          urls: locs.map((loc) => ({
            loc,
            lastmod: null,
            source: `${ORIGIN}/sitemap.xml`,
          })),
        },
        pages: { status: "ok", snapshots },
      }),
    );
  // The crawler fetched each http <loc> (301 → https) and the https pages.
  const redirect = (path: string) => ({
    ...snapshot(path),
    url: http(path),
    status: 301,
  });
  const site = [
    snapshot("/", { links: ["/a", "/b", "/a", "/c"] }),
    snapshot("/a", { links: ["/", "/b", "/c"] }),
    snapshot("/b", { links: ["/", "/a", "/c"] }),
    snapshot("/c", { links: ["/", "/a"] }),
  ];

  it("reports http <loc> on an https site once, under P3-19", async () => {
    const locs = ["/", "/a", "/b"].map(http);
    const result = await run(locs, [
      ...site,
      ...["/", "/a", "/b"].map(redirect),
    ]);
    expect(
      result.findings.map((f) => [f.itemIds[0], f.severity, f.title]),
    ).toEqual([
      ["P3-12", "S3", "Indexable pages missing from the sitemap"],
      ["P3-19", "S3", "Sitemap <loc> scheme differs from the canonical scheme"],
    ]);
    expect(result.findings[0]?.urls).toEqual([`${ORIGIN}/c`]);
    expect(result.findings[1]?.detail).toContain(http("/b"));
  });

  it("still reports a <loc> that really fails, and an off-host <loc>", async () => {
    const result = await run(
      [
        `${ORIGIN}/`,
        `${ORIGIN}/a`,
        `${ORIGIN}/gone`,
        "https://www.example.com/b",
        `${ORIGIN}/c`,
        `${ORIGIN}/b`,
      ],
      [...site, snapshot("/gone", { status: 404 })],
    );
    expect(
      sort(
        result.findings.map((f) => f.title),
        (a, b) => a.localeCompare(b),
      ),
    ).toEqual([
      "Sitemap <loc> host differs from the canonical host",
      "Sitemap lists URLs that redirect or do not return 200",
    ]);
  });
});

// WO-B21-003 guard: a sitemap `<loc>` is matched to crawled pages with
// `sitemapKey` (scheme folded) everywhere in checks/, never `normalizeUrl`.
describe("sitemap <loc> comparisons", () => {
  it("use sitemapKey", () => {
    const dir = import.meta.dirname;
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .filter((f) =>
        /normalizeUrl\(\w+\.loc\)/.test(readFileSync(join(dir, f), "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});
