import { describe, expect, it } from "vitest";
import {
  CITIES,
  many,
  setPage,
  template,
  variationPages,
} from "./check-test-fixtures";
import { findScaledSets, swapped } from "./scaled-sets";

describe("findScaledSets", () => {
  it("links ≥ 3 template pages at ratio ≥ 0.6 and names the swapped term", () => {
    const pages = variationPages();
    const sets = findScaledSets(pages, [template("/*", pages)]);
    expect(sets).toHaveLength(1);
    expect(sets[0].subtype).toBe("variation");
    expect(sets[0].swapField).toBe("title");
    expect(new Set(sets[0].swaps)).toEqual(new Set(CITIES));
    // 8 shared of 11 own sentences (H1 + 10 paragraphs).
    expect(sets[0].pages.map((p) => p.shared)).toEqual(Array(4).fill(8 / 11));
  });

  it("ignores pages below the ratio and sets of 2 pages", () => {
    const low = ["a", "b", "c"].map((x) =>
      setPage(`/low-${x}`, `Low page ${x} here`, [
        ...many("common", 2),
        ...many(`own${x}`, 6),
      ]),
    );
    const pair = variationPages().slice(0, 2);
    expect(
      findScaledSets(
        [...low, ...pair],
        [template("/low", low), template("/pair", pair)],
      ),
    ).toEqual([]);
  });

  it("does not count chrome (sentences on pages of ≥ 2 templates)", () => {
    const pages = variationPages();
    const other = setPage("/about", "About us", many("shared", 8));
    expect(
      findScaledSets(
        [...pages, other],
        [template("/*", pages), template("/about", [other])],
      ),
    ).toEqual([]);
  });

  it("is templated when titles, H1s and slugs differ by more than one term", () => {
    const pages = ["red apple pie", "blue kite flying", "old stone bridge"].map(
      (t, i) =>
        setPage(`/x${i}/${t.replace(/ /g, "")}`, t, [
          ...many("shared", 8),
          ...many(`p${i}`, 2),
        ]),
    );
    const [set] = findScaledSets(pages, [template("/*", pages)]);
    expect(set.subtype).toBe("templated");
  });
});

describe("swapped", () => {
  it("accepts one swapped run of ≤ 2 words in phrases of ≥ 3 words", () => {
    expect(swapped("Plumber in Portland Oregon", "Plumber in Salt Lake")).toBe(
      true,
    );
    expect(swapped("Plumber in Portland", "Roofer at Seattle")).toBe(false);
    expect(swapped("Plumber Portland", "Plumber Seattle")).toBe(false);
  });
});
