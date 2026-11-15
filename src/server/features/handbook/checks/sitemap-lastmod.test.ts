import { describe, expect, it } from "vitest";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { sitemapLastmodCheck } from "./sitemap-lastmod";

const SOURCE = `${ORIGIN}/sitemap.xml`;

const run = (lastmods: string[]) =>
  sitemapLastmodCheck.run(
    context({
      sitemap: {
        status: "ok",
        sources: [
          {
            url: SOURCE,
            status: 200,
            kind: "urlset",
            storageKey: null,
            errors: [],
          },
        ],
        urls: lastmods.map((lastmod, i) => ({
          loc: `${ORIGIN}/p${i}`,
          lastmod,
          source: SOURCE,
        })),
      },
    }),
  );

describe("crawl.sitemap-lastmod", () => {
  it("opens when every lastmod is one build date", async () => {
    const result = await run(Array.from({ length: 6 }, () => "2026-11-01"));
    expect(statusOf(result, "P3-17")).toBe("OPEN");
  });

  it("opens on a future lastmod", async () => {
    const result = await run(["2099-01-01"]);
    expect(statusOf(result, "P3-17")).toBe("OPEN");
  });

  it("passes mixed real dates", async () => {
    const result = await run([
      "2025-03-02",
      "2025-07-14",
      "2026-01-09T10:00:00+00:00",
      "2026-05-30",
      "2026-10-11",
    ]);
    expect(statusOf(result, "P3-17")).toBe("PASS");
  });
});
