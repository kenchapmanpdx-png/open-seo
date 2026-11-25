import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { REGISTRY } from "@/server/features/handbook/registry";
import { renderReviewMd } from "../export/markdown";
import { renderClientReportHtml } from "../export/client-report";
import { scoreReport } from "../engine/report";
import type { ReportJson } from "./exports";
import { gradeLabel, gradeView, noFindingsText } from "./grade-view";

// WO-B21-001: zmklaw.com read no page and showed "Grade A 100/100" and
// "Every automated check passed". A robots item passes without a page.
const unread: ReportJson = (() => {
  const report: ReportJson = {
    reportVersion: "1",
    contractsVersion: "1.11.0",
    handbookVersion: "3.4",
    generatedAt: "2026-11-24T00:00:00.000Z",
    site: { origin: "https://zmklaw.com", platform: null },
    run: {
      id: "e8f77e8b",
      mode: "AUDIT",
      tier: "T1",
      tierEvidence: "",
      startedAt: "2026-11-24T00:00:00.000Z",
      finishedAt: "2026-11-24T00:01:00.000Z",
      coverage: { discovered: 1, read: 0, capped: false },
    },
    score: null,
    siteProfile: [],
    findings: [],
    items: [
      {
        itemId: "P3-01",
        phase: "P3",
        status: "PASS",
        note: null,
        findingCodes: [],
      },
      {
        itemId: "P3-02",
        phase: "P3",
        status: "BLOCKED",
        note: "pages unavailable: no page could be fetched",
        findingCodes: [],
      },
    ],
    release: { status: "CLEAR", blockingItemIds: [] },
    checkerErrors: [],
    outsideScope: [],
  };
  return { ...report, score: scoreReport(report) };
})();

const withRun = (
  coverage: ReportJson["run"]["coverage"],
  items: ReportJson["items"] = unread.items,
): ReportJson => {
  const report = { ...unread, run: { ...unread.run, coverage }, items };
  return { ...report, score: scoreReport(report) };
};

describe("scoreReport graded state (WO-B21-001)", () => {
  it("does not grade a run whose crawl read no page", () => {
    expect(gradeView(unread.score)).toEqual({
      kind: "not-graded",
      reason: "pages unavailable: no page could be fetched",
    });
  });

  it("does not grade a stored run without coverage whose pages were unavailable", () => {
    expect(gradeView(withRun(undefined).score).kind).toBe("not-graded");
  });

  it("grades a run that read pages, and a legacy run without coverage", () => {
    const passOnly = unread.items.slice(0, 1);
    for (const coverage of [
      { discovered: 3, read: 3, capped: false },
      undefined,
    ])
      expect(gradeView(withRun(coverage, passOnly).score)).toEqual({
        kind: "graded",
        grade: "A",
        final: 100,
      });
  });
});

const CONSUMERS: Record<string, (r: ReportJson) => string> = {
  "review markdown": (r) => renderReviewMd(r, REGISTRY),
  "client report": (r) => renderClientReportHtml(r, REGISTRY),
  "list / summary label": (r) => gradeLabel(r.score),
  "no-findings text": (r) => noFindingsText(r),
};

describe("a run that read no page (WO-B21-001)", () => {
  it.each(Object.keys(CONSUMERS))("%s shows no grade and no pass", (name) => {
    const out = CONSUMERS[name](unread);
    expect(out).not.toMatch(/\/ ?100|Grade:? [A-F]\b|class="grade">[A-F]/);
    expect(out).not.toMatch(/Every automated check|checks? passed/i);
  });
});

// Where the stored grade may be read directly: everything else goes through
// `gradeView` / `gradeLabel`, so a not-graded run never shows a letter.
const GRADE_READ_ALLOWED: Record<string, string> = {
  "server/features/handbook/contracts/grade-view.ts": "the one reader",
  "server/features/handbook/engine/report.ts": "writes the score",
  "server/features/handbook/repositories/HandbookGradeRepository.ts":
    "stores the score after its not-graded branch",
  "client/features/handbook/fixList.ts":
    "capNote: only rendered for graded runs (FixList returns early)",
};
const ROOTS = [
  "server/features/handbook",
  "client/features/handbook",
  "server/features/agency",
  "client/features/agency",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sourceFiles(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

describe("grade readers (WO-B21-001)", () => {
  it("read score.grade / score.final only through gradeView", () => {
    const src = join(import.meta.dirname, "../../../..");
    const offenders = ROOTS.flatMap((r) => sourceFiles(join(src, r)))
      .filter((f) =>
        /\bscore\??\.(grade|final)\b/.test(readFileSync(f, "utf8")),
      )
      .map((f) => relative(src, f))
      .filter((f) => !(f in GRADE_READ_ALLOWED));
    expect(offenders).toEqual([]);
  });
});
