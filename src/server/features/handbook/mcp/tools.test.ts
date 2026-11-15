import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";

const { getRunReportMock } = vi.hoisted(() => ({
  getRunReportMock:
    vi.fn<(projectId: string, runId: string) => Promise<ReportJson | null>>(),
}));

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/features/projects/services/ProjectService", () => ({
  ProjectService: {
    getProjectForOrganization: async () => ({ id: "p1", domain: "a.com" }),
  },
}));
vi.mock("@/server/features/handbook/services/HandbookService", () => ({
  HandbookService: { getRunReport: getRunReportMock, listRuns: async () => [] },
}));

import { makeToolContext } from "@/server/mcp/tools/tool-test-support";
import { findingsGetTool } from "./tools";

const toolContext = makeToolContext();

// Shaped like the r12 whyracing run (45 findings; average title 50 and fix
// 120 characters, 2-3 URLs, long evidence excerpts) — its real reply was
// 19.4 KB.
const long = (n: number) => "x".repeat(n);
const report: ReportJson = {
  reportVersion: "1",
  contractsVersion: "1.2.0",
  handbookVersion: "4.6",
  generatedAt: "2026-11-14T00:00:00.000Z",
  site: { origin: "https://a.com", platform: null },
  run: {
    id: "run-p1",
    mode: "REVIEW",
    tier: "T2",
    tierEvidence: "",
    startedAt: "2026-11-14T00:00:00.000Z",
    finishedAt: "2026-11-14T00:05:00.000Z",
  },
  score: {
    final: 39,
    uncapped: 52,
    grade: "F",
    capReason: "F01 S1",
    phases: [{ phase: "P1", weight: 10, score: 40, driver: null }],
  },
  siteProfile: [],
  findings: Array.from({ length: 45 }, (_, i) => ({
    code: `F${String(i + 1).padStart(2, "0")}`,
    severity: "S2" as const,
    phase: "P4",
    sectionRef: "",
    title: long(50),
    detail: long(400),
    fix: long(120),
    fixability: "FIXABLE" as const,
    limitedReason: null,
    effort: "S" as const,
    source: "deterministic" as const,
    itemIds: ["P4-01", "P4-02"],
    urls: [`https://a.com/${long(30)}`, `https://a.com/b/${long(30)}`],
    evidence: [{ kind: "rawHtml", url: "https://a.com/", excerpt: long(900) }],
  })),
  items: [],
  release: { status: "NOT_APPLICABLE", blockingItemIds: [] },
  checkerErrors: [],
  outsideScope: [],
};

beforeEach(() => {
  // Tenant-scoped like the service: a run only resolves in its own project.
  getRunReportMock.mockImplementation(async (projectId, runId) =>
    projectId === "p1" && runId === "run-p1" ? report : null,
  );
});

describe("handbook_findings_get", () => {
  it("rejects a run id from another project", async () => {
    await expect(
      findingsGetTool.handler(
        { projectId: "p1", runId: "run-p2", limit: 50 },
        toolContext,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getRunReportMock).toHaveBeenCalledWith("p1", "run-p2");
  });

  it("keeps a 45-finding reply under 20 KB", async () => {
    const result = await findingsGetTool.handler(
      { projectId: "p1", runId: "run-p1", limit: 50 },
      toolContext,
    );
    expect(JSON.stringify(result).length).toBeLessThan(20_000);
  });
});
