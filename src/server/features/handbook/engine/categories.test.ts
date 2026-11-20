import { describe, expect, it } from "vitest";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import type { ItemStatus } from "@/server/features/handbook/contracts/status";
import { withCategories } from "./categories";

type Finding = ReportJson["findings"][number];

const finding = (over: Partial<Finding>): Finding => ({
  code: "F01",
  severity: "S2",
  phase: "P9",
  sectionRef: "",
  title: "t",
  detail: "",
  fix: "",
  fixability: "FIXABLE",
  limitedReason: null,
  effort: "S",
  source: "deterministic",
  itemIds: [],
  urls: [],
  evidence: [],
  ...over,
});

// P9-* items are tagged GEO only; P4-01 SEO only (registry-tags.json).
const report = (
  items: [string, ItemStatus, string[]?][],
  findings: Finding[] = [],
): ReportJson => ({
  reportVersion: "1",
  contractsVersion: "1.8.0",
  handbookVersion: "4.6",
  generatedAt: "2026-11-20T00:00:00.000Z",
  site: { origin: "https://a.com", platform: null },
  run: {
    id: "r",
    mode: "AUDIT",
    tier: "T2",
    tierEvidence: "",
    startedAt: "2026-11-20T00:00:00.000Z",
    finishedAt: null,
  },
  score: null,
  siteProfile: [],
  findings,
  items: items.map(([itemId, status, findingCodes = []]) => ({
    itemId,
    phase: itemId.split("-")[0],
    status,
    note: null,
    findingCodes,
  })),
  release: { status: "CLEAR", blockingItemIds: [] },
  checkerErrors: [],
  outsideScope: [],
});

describe("withCategories", () => {
  it("scores pass share per tag; null without applicable items", () => {
    const all = withCategories(
      report([
        ["P9-01", "PASS"],
        ["P9-02", "PASS"],
        ["P4-01", "OPEN"],
        ["P4-03", "PASS"],
        ["P4-04", "NA"],
      ]),
    );
    expect(all.categoryScores).toEqual({ SEO: 50, GEO: 100, AEO: null });
  });

  it("caps a tag at 39 for an open non-LLM S1, not for an LLM one", () => {
    const items: [string, ItemStatus, string[]][] = [
      ["P9-01", "OPEN", ["F01"]],
      ["P9-02", "PASS", []],
      ["P9-03", "PASS", []],
      ["P9-04", "PASS", []],
    ];
    const s1 = (source: Finding["source"]) =>
      withCategories(
        report(items, [
          finding({ severity: "S1", source, itemIds: ["P9-01"] }),
        ]),
      ).categoryScores?.GEO;
    expect(s1("deterministic")).toBe(39);
    expect(s1("llm")).toBe(75);
  });

  it("tags each finding with the union of its items' tags", () => {
    const out = withCategories(
      report([], [finding({ itemIds: ["P9-01", "P4-01"] })]),
    );
    expect(out.findings[0].categories).toEqual(["SEO", "GEO"]);
  });
});
