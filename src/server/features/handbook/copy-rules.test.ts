import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";

const { getRunReportMock } = vi.hoisted(() => ({
  getRunReportMock: vi.fn<() => Promise<ReportJson | null>>(),
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
import copyRules from "./copy-rules.json";
import { copyRulesGetTool, findingsGetTool } from "./mcp/tools";

const skillBody = readFileSync("fork/skills/copy-rules/SKILL.md", "utf8")
  .replace(/^---\n[\s\S]*?\n---\n/, "")
  .trim();

function reportWith(
  findings: { phase: string; itemIds: string[] }[],
): ReportJson {
  return {
    reportVersion: "1",
    contractsVersion: "1.7.0",
    handbookVersion: "4.6",
    generatedAt: "2026-11-19T00:00:00.000Z",
    site: { origin: "https://a.com", platform: null },
    run: {
      id: "run-p1",
      mode: "AUDIT",
      tier: "T2",
      tierEvidence: "",
      startedAt: "2026-11-19T00:00:00.000Z",
      finishedAt: "2026-11-19T00:05:00.000Z",
    },
    score: null,
    siteProfile: [],
    findings: findings.map((f, i) => ({
      ...f,
      code: `F0${i + 1}`,
      severity: "S3",
      sectionRef: "",
      title: "t",
      detail: "",
      fix: "f",
      fixability: "FIXABLE",
      limitedReason: null,
      effort: "S",
      source: "deterministic",
      urls: [],
      evidence: [],
    })),
    items: [],
    release: { status: "NOT_APPLICABLE", blockingItemIds: [] },
    checkerErrors: [],
    outsideScope: [],
  };
}

const getFindings = () =>
  findingsGetTool.handler(
    { projectId: "p1", runId: "run-p1", limit: 50 },
    makeToolContext(),
  );

beforeEach(() => {
  getRunReportMock.mockResolvedValue(reportWith([]));
});

describe("copy rules pack", () => {
  it("bundles the SKILL.md body", () => {
    expect(copyRules.text.trim()).toBe(skillBody);
  });

  it("handbook_copy_rules_get returns version and text", async () => {
    const result = await copyRulesGetTool.handler();
    expect(result.structuredContent).toEqual({
      version: copyRules.version,
      text: copyRules.text,
    });
  });

  it.each([
    ["a P5 finding", { phase: "P5", itemIds: ["P5-03"] }],
    ["a SUPP-17 finding", { phase: "SUPP", itemIds: ["SUPP-17"] }],
  ])("findings carry the copyRules hint for %s", async (_, finding) => {
    getRunReportMock.mockResolvedValue(reportWith([finding]));
    const result = await getFindings();
    expect(result.structuredContent?.copyRules).toEqual({
      tool: "handbook_copy_rules_get",
      version: copyRules.version,
    });
  });

  it("findings without content items carry no hint", async () => {
    getRunReportMock.mockResolvedValue(
      reportWith([{ phase: "P4", itemIds: ["P4-01"] }]),
    );
    const result = await getFindings();
    expect(result.structuredContent).not.toHaveProperty("copyRules");
  });
});
