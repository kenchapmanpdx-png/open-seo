import { sort } from "remeda";
import { describe, expect, it } from "vitest";
import { decideScope, type SitemapCensus } from "./scopePreflight";

const census = (sections: Record<string, number>): SitemapCensus => {
  const list = Object.entries(sections).map(([section, count]) => ({
    section,
    count,
  }));
  return {
    total: list.reduce((n, s) => n + s.count, 0),
    sections: sort(list, (a, b) => b.count - a.count),
    paramShare: 0,
  };
};

describe("decideScope (WO-B27-003)", () => {
  it("reads a small site, and a site of exactly the limit, whole", () => {
    expect(
      decideScope(census({ "/": 1, "/services/": 33 }), 500),
    ).toMatchObject({ excludePaths: [], inScope: 34 });
    expect(decideScope(census({ "/": 1, "/p/": 499 }), 500)).toMatchObject({
      excludePaths: [],
      inScope: 500,
    });
  });

  it("leaves out archives first, then the largest section, to 90 % of the limit", () => {
    // antiquecandleco.com, 2026-11-28 sitemap.
    const acc = census({
      "/pages/": 218,
      "/products/": 156,
      "/blogs/": 131,
      "/collections/": 105,
      "/": 1,
      "/agents.md/": 1,
    });
    expect(decideScope(acc, 500)).toMatchObject({
      excludePaths: ["/blogs/", "/pages/"],
      inScope: 263,
    });
    const blog = census({ "/": 1, "/blog/": 300, "/tag/": 90, "/shop/": 200 });
    expect(decideScope(blog, 500).excludePaths).toEqual(["/blog/"]);
  });
});
