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
    });
  });
});
