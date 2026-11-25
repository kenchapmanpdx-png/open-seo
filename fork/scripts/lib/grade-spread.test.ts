import { describe, expect, it } from "vitest";
import type { ReportJson } from "../../../src/server/features/handbook/contracts/exports";
import { gradeSpread } from "./grade-spread";

type Status = ReportJson["items"][number]["status"];

function report(
  statuses: Record<string, Status>,
  score: { grade: "D" | "F"; capReason?: string },
  notes: Record<string, string> = {},
): ReportJson {
  return {
    reportVersion: "1",
    contractsVersion: "1.11.0",
    handbookVersion: "4.6",
    generatedAt: "2026-11-25T00:00:00.000Z",
    site: { origin: "https://example.com", platform: null },
    run: {
      id: "r",
      mode: "AUDIT",
      tier: "T1",
      tierEvidence: "",
      startedAt: "2026-11-25T00:00:00.000Z",
      finishedAt: null,
    },
    score: {
      final: 30,
      uncapped: 30,
      grade: score.grade,
      capReason: score.capReason ?? null,
      phases: [],
    },
    siteProfile: [],
    findings: [
      {
        code: "F01",
        severity: "S1",
        phase: "P3",
        sectionRef: "",
        title: "No canonical",
        detail: "",
        fix: "",
        fixability: "FIXABLE",
        limitedReason: null,
        effort: "S",
        source: "deterministic",
        itemIds: ["P3-01"],
        urls: [],
        evidence: [],
      },
    ],
    items: Object.entries(statuses).map(([itemId, status]) => ({
      itemId,
      phase: itemId.slice(0, 2),
      status,
      note: notes[itemId] ?? null,
      findingCodes: [],
    })),
    release: { status: "CLEAR", blockingItemIds: [] },
    checkerErrors: [],
    outsideScope: [],
  };
}

// P2 and P3 both scored → 50 points each; P2-01 alone in P2, P3 has two items.
const capped = report(
  { "P2-01": "OPEN", "P3-01": "OPEN", "P3-02": "PASS" },
  { grade: "F", capReason: "open S1: F01" },
);
const plain = report(
  { "P2-01": "OPEN", "P3-01": "PASS", "P3-02": "PASS" },
  { grade: "D" },
);
const broken = report(
  { "P2-01": "PASS", "P3-01": "PASS", "P3-02": "OPEN" },
  { grade: "D" },
  { "P3-02": "check error: TypeError" },
);

describe("gradeSpread (WO-B22-002)", () => {
  it("counts grades, OPEN rates, points lost and caps; skips a run with a check error", () => {
    const g = gradeSpread([
      { site: "a.com", dir: "a", report: capped },
      { site: "b.com", dir: "b", report: plain },
      { site: "c.com", dir: "c", report: broken },
    ]);
    expect(g.grades).toEqual({ A: 0, B: 0, C: 0, D: 1, F: 1 });
    expect(g.skipped).toEqual([{ site: "c.com", reason: "check error" }]);
    expect(
      g.items.map((r) => [r.itemId, r.open, r.openRate, r.meanPointsLost]),
    ).toEqual([
      ["P2-01", 2, 1, 50],
      ["P3-01", 1, 0.5, 25],
      ["P3-02", 0, 0, 0],
    ]);
    expect(g.caps).toEqual([
      { title: "No canonical", itemIds: ["P3-01"], sites: ["a.com"] },
    ]);
    expect(g.universal).toBeNull();
    expect(g.universalNote).toBe("omitted: 2 graded site(s), fewer than 8");
  });

  it("lists items OPEN on at least 80 % of eight or more sites", () => {
    const sites = Array.from({ length: 8 }, (_, i) => ({
      site: `s${i}.com`,
      dir: `s${i}`,
      report: i === 0 ? capped : plain,
    }));
    expect(gradeSpread(sites).universal?.map((r) => r.itemId)).toEqual([
      "P2-01",
    ]);
  });
});
