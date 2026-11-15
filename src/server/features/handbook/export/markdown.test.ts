import { describe, expect, it } from "vitest";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import { renderOwnerTodoMd, renderReviewMd, renderStatusMd } from "./markdown";

const report = (over: Partial<ReportJson> = {}): ReportJson => ({
  reportVersion: "1",
  contractsVersion: "1.2.0",
  handbookVersion: "4.6",
  generatedAt: "2026-11-15T00:00:00.000Z",
  site: { origin: "https://example.com", platform: null },
  run: {
    id: "r1",
    mode: "AUDIT",
    tier: "T2",
    tierEvidence: "12 pages",
    startedAt: "2026-11-15T00:00:00.000Z",
    finishedAt: null,
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
      status: "PARTIAL",
      note: null,
      findingCodes: ["F01"],
    },
  ],
  release: { status: "CLEAR", blockingItemIds: [] },
  checkerErrors: [],
  outsideScope: [],
  ...over,
});

const registry = [
  { id: "P3-01", text: "[T1+] Canonical host (§10)" },
  { id: "P3-02", text: "[T1+] Trailing slash (§10)" },
];

describe("renderStatusMd", () => {
  it("writes the EP-5 template in handbook vocabulary", () => {
    const md = renderStatusMd(report(), registry);
    expect(md.split("\n").filter((l) => l.startsWith("#"))).toEqual([
      "# SEO/GEO Status",
      "## Site Profile",
      "## Decisions",
      "## Phase gates",
      "## Release",
      "## Checklist (§41 copy)",
      "## Blocked / owner needed",
      "## Deferred (trigger)",
    ]);
    expect(md).toContain(
      "handbook: 4.6 | mode: AUDIT | tier: T2 (12 pages) | updated: 2026-11-15",
    );
    expect(md).toContain("| P3 | FAIL | 2026-11-15 |");
    expect(md).toContain("- [DONE] [T1+] Canonical host (§10)");
    expect(md).toContain("- [OPEN] [T1+] Trailing slash (§10) — partial · F01");
  });
});

describe("renderReviewMd", () => {
  it("prints the capped grade with the handbook version", () => {
    const md = renderReviewMd(
      report({
        score: {
          final: 39,
          uncapped: 53.6,
          grade: "F",
          capReason: "open S1: F01",
          phases: [],
        },
      }),
      registry,
    );
    expect(md).toContain(
      "## Grade: 39 / 100 — F (capped; 53.6 uncapped — open S1: F01)",
    );
    expect(md).toContain("Handbook v4.6.");
  });

  it("marks the grade provisional when render evidence is missing", () => {
    const md = renderReviewMd(
      report({
        items: [
          {
            itemId: "P2-01",
            phase: "P2",
            status: "BLOCKED",
            note: "render unavailable: no sidecar",
            findingCodes: [],
          },
        ],
      }),
      registry,
    );
    expect(md).toContain("- Grade provisional: render evidence missing");
  });
});

describe("renderOwnerTodoMd", () => {
  it("asks for unknown Site Profile facts and owner-blocked items", () => {
    const md = renderOwnerTodoMd(
      report({
        siteProfile: [
          {
            code: "SP7",
            value: "?",
            evidence: "no address found",
            confidence: "low",
          },
        ],
        items: [
          {
            itemId: "P11-01",
            phase: "P11",
            status: "BLOCKED",
            note: "needs Search Console access",
            findingCodes: [],
          },
        ],
      }),
      [{ id: "P11-01", text: "GSC verified", class: "OWNER" }],
    );
    const section = (h: string) => md.split(`## ${h}`)[1].split("## ")[0];
    expect(section("Business facts needed")).toContain("SP7 (now ?");
    expect(section("TODO(owner)")).toContain("P11-01 GSC verified");
  });
});
