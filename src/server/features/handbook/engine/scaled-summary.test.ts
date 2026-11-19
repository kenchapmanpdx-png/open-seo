import { describe, expect, it } from "vitest";
import {
  setPage,
  template,
  variationPages,
} from "../checks/check-test-fixtures";
import { buildScaledContent } from "./scaled-summary";
import { completeCollected } from "./stages";

describe("buildScaledContent", () => {
  it("shows zeros for a site with no pages", () => {
    expect(buildScaledContent(completeCollected({}), [])).toEqual({
      indexablePages: 0,
      duplicateClusterPages: 0,
      thinPages: 0,
      supp17Sets: 0,
      supp17Pages: 0,
      ownTextShare: [],
      supp19Pages: 0,
    });
  });

  it("counts pages, thin pages, SUPP-17 / SUPP-19 findings and own-text share per template", () => {
    const set = variationPages();
    const thin = setPage("/thin", "Opening hours", ["We open at nine daily."]);
    const pages = [...set, thin];
    const collected = completeCollected({
      pages: { status: "ok", snapshots: pages },
      templates: {
        status: "ok",
        templates: [template("/plumber-*", set), template("/thin", [thin])],
      },
    });
    const urls = set.map((p) => p.url);
    const summary = buildScaledContent(collected, [
      { itemIds: ["SUPP-17"], urls },
      { itemIds: ["SUPP-19"], urls: [urls[0]] },
      { itemIds: ["P5-15"], urls: [thin.url, urls[1]] },
    ]);
    expect(summary).toEqual({
      indexablePages: 5,
      duplicateClusterPages: 0,
      thinPages: 2,
      supp17Sets: 1,
      supp17Pages: 4,
      ownTextShare: [
        {
          template: "/plumber-* (e.g. /plumber-portland)",
          pages: 4,
          median: 0.27,
        },
      ],
      supp19Pages: 1,
    });
  });
});
