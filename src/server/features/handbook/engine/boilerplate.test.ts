import { describe, expect, it } from "vitest";
import { pageBlocks, templateBoilerplate } from "./boilerplate";

const page = (unique: string, shared: string[]) =>
  pageBlocks(
    `<main><h1>${unique}</h1><p>Body of ${unique}</p></main><footer>${shared
      .map((s) => `<p>${s}</p>`)
      .join("")}</footer>`,
  );

describe("templateBoilerplate", () => {
  it("keeps blocks on ≥ 80 % of the pages, not page-unique ones", () => {
    const shared = ["Call us at 555 0100", "© 2026  Example\n Co"];
    const pages = ["a", "b", "c", "d", "e"].map((u) => page(u, shared));
    expect(templateBoilerplate(pages)).toEqual({
      blocks: ["Call us at 555 0100", "© 2026 Example Co"],
      words: 8,
    });
  });

  it("drops a block on 79 % of the pages and templates under 3 pages", () => {
    const pages = Array.from({ length: 100 }, (_, i) =>
      page(`p${i}`, i < 79 ? ["Seasonal banner"] : []),
    );
    expect(templateBoilerplate(pages)?.blocks).toEqual([]);
    expect(templateBoilerplate(pages.slice(0, 2))).toBeUndefined();
  });
});
