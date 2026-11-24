import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportService } from "@/server/features/reports/services/ReportService";
import { HandbookService } from "./HandbookService";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/server/features/reports/services/ReportService", () => ({
  ReportService: { saveReport: vi.fn() },
}));

beforeEach(async () => {
  await testDb.seedProject();
  await testDb.client.executeMultiple(`
    INSERT INTO projects (id, organization_id, name, domain)
      VALUES ('other', 'organization', 'Other', 'other.example');
    INSERT INTO handbook_run (id, project_id, organization_id, origin, handbook_version, contracts_version, mode)
      VALUES ('run', 'project', 'organization', 'https://openseo.so', '4.6', '1.0.0', 'AUDIT');
    INSERT INTO handbook_evidence (id, run_id, item_id, kind, url, excerpt, sha256)
      VALUES ('evidence', 'run', 'P1-01', 'html', 'https://openseo.so/', '<title>', 'abc');
  `);
});

describe("HandbookService.getEvidence", () => {
  it("returns evidence only to the project that owns its run", async () => {
    expect(await HandbookService.getEvidence("project", "evidence")).toEqual(
      expect.objectContaining({ excerpt: "<title>", bodyUrl: null }),
    );
    expect(await HandbookService.getEvidence("other", "evidence")).toBeNull();
  });
});

describe("HandbookService.getRunProgress", () => {
  it("returns progress only to the project that owns the run", async () => {
    await testDb.client.executeMultiple(`
      INSERT INTO handbook_run_stage (run_id, stage, batch, status, items_done)
        VALUES ('run', 'crawl', 0, 'done', 60), ('run', 'render', 0, 'done', 25),
               ('run', 'render', 1, 'running', 0);
      INSERT INTO handbook_llm_call (id, run_id, item_id, model, prompt_sha256, cost_usd)
        VALUES ('c1', 'run', 'P1-01', 'haiku', 'x', 0.25);
    `);
    expect(await HandbookService.getRunProgress("other", "run")).toBeNull();
    expect(
      await HandbookService.getRunProgress("project", "run"),
    ).toMatchObject({
      currentStage: "render",
      pagesDone: 25,
      pagesTotal: 60,
      llmCostUsd: 0.25,
    });
  });

  // WO-B20-006: the checks step counts checks, not pages.
  it("counts checks done of total while the checks step runs", async () => {
    await testDb.client.executeMultiple(`
      INSERT INTO handbook_run_stage (run_id, stage, batch, status, items_done, items_total)
        VALUES ('run', 'crawl', 0, 'done', 60, 60), ('run', 'checks', 0, 'running', 40, 120);
    `);
    expect(
      await HandbookService.getRunProgress("project", "run"),
    ).toMatchObject({
      currentStage: "checks",
      pagesDone: 40,
      pagesTotal: 120,
      unit: "checks",
    });
  });
});

describe("HandbookService.publishToReports", () => {
  const publish = (projectId: string) =>
    HandbookService.publishToReports({
      projectId,
      organizationId: "organization",
      userId: "user",
      runId: "run",
    });

  it("treats another project's run as not found", async () => {
    await expect(publish("other")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(ReportService.saveReport).not.toHaveBeenCalled();
  });

  it("saves the client report under the handbook-audit skill", async () => {
    await publish("project");
    expect(ReportService.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project",
        skill: "handbook-audit",
        createdByUserId: "user",
      }),
    );
  });
});
