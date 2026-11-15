import { describe, expect, it, vi } from "vitest";
import {
  handbookFindingItems,
  handbookFindingUrls,
  handbookFindings,
  handbookItemStatuses,
  handbookRuns,
} from "@/db/handbook.schema";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { renderFollowupsMd } from "@/server/features/handbook/export/followups";
import { OutcomeService, type OutcomeDeps } from "./outcomeService";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const scope = { projectId: "project", organizationId: "organization" };
const page = "https://openseo.so/pricing";
const WEEK_MS = 7 * 86_400_000;

/** A completed run; `failing` = the page still has a P4-01 finding. */
async function seedRun(id: string, mode: "AUDIT" | "REVIEW", failing: boolean) {
  await testDb.db.insert(handbookRuns).values({
    id,
    ...scope,
    origin: "https://openseo.so",
    handbookVersion: "1",
    contractsVersion: "1",
    mode,
    status: "completed",
  });
  await testDb.db
    .insert(handbookItemStatuses)
    .values({ runId: id, itemId: "P4-01", status: failing ? "OPEN" : "PASS" });
  if (!failing) return;
  await testDb.db.insert(handbookFindings).values({
    id: `${id}-f`,
    runId: id,
    code: "F1",
    phase: "P4",
    severity: "S2",
    class: "deterministic",
    title: "Missing title",
    detail: "No <title>",
    fix: "Add a title",
    fixability: "FIXABLE",
    effort: "S",
    source: "deterministic",
  });
  await testDb.db
    .insert(handbookFindingItems)
    .values({ findingId: `${id}-f`, itemId: "P4-01" });
  await testDb.db
    .insert(handbookFindingUrls)
    .values({ findingId: `${id}-f`, url: page });
}

describe("OutcomeService", () => {
  it("schedules +4/+12 checks for AUDIT runs and rejects REVIEW runs", async () => {
    await testDb.seedProject();
    await seedRun("audit", "AUDIT", true);
    await seedRun("review", "REVIEW", true);
    const fixedAt = new Date("2026-01-01T00:00:00Z");

    await OutcomeService.recordFixBatch(scope, {
      runId: "audit",
      findingCodes: [],
      fixedAt,
    });
    const [batch] = await OutcomeService.getOutcomeRecord(scope);
    expect(batch.checks.map((c) => [c.offsetWeeks, c.dueAt])).toEqual([
      [4, new Date(fixedAt.getTime() + 4 * WEEK_MS).toISOString()],
      [12, new Date(fixedAt.getTime() + 12 * WEEK_MS).toISOString()],
    ]);
    await expect(
      OutcomeService.recordFixBatch(scope, {
        runId: "review",
        findingCodes: [],
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("runs a due check once: handbook rerun, connected source, BLOCKED rest", async () => {
    await testDb.seedProject();
    await seedRun("audit", "AUDIT", true);
    const fixedAt = new Date("2026-01-01T00:00:00Z");
    await OutcomeService.recordFixBatch(scope, {
      runId: "audit",
      findingCodes: ["F1"],
      fixedAt,
    });
    const rerun = vi.fn(async () => {
      await seedRun("rerun", "AUDIT", false);
      return "rerun";
    });
    const deps: OutcomeDeps = {
      rerun,
      store: createMemoryEvidenceStore(),
      sources: [
        {
          metrics: ["bing_clicks_28d"],
          collect: async () => ({
            source: "Bing",
            payload: { rows: [] },
            values: {
              bing_clicks_28d: new Map([[page, { before: "3", after: "9" }]]),
            },
          }),
        },
        // GSC not connected.
        { metrics: ["gsc_clicks_28d"], collect: async () => null },
      ],
    };
    const at = new Date(fixedAt.getTime() + 4 * WEEK_MS + 60_000);

    expect(await OutcomeService.runDueChecks(deps, at)).toEqual({
      due: 1,
      done: 1,
    });
    expect(await OutcomeService.runDueChecks(deps, at)).toEqual({
      due: 0,
      done: 0,
    });
    expect(rerun).toHaveBeenCalledWith({
      ...scope,
      origin: "https://openseo.so",
      urls: [page],
    });

    const record = await OutcomeService.getOutcomeRecord(scope);
    const metrics = record[0].checks[0].metrics;
    const of = (metric: string) => metrics.find((m) => m.metric === metric);
    expect(of("handbook_status")).toMatchObject({
      beforeValue: "OPEN",
      afterValue: "PASS",
    });
    expect(of("bing_clicks_28d")).toMatchObject({
      beforeValue: "3",
      afterValue: "9",
      source: "Bing",
    });
    expect(of("bing_clicks_28d")?.evidencePath).toBeTruthy();
    expect(of("gsc_clicks_28d")).toMatchObject({
      beforeValue: null,
      afterValue: null,
      source: "BLOCKED (not connected)",
    });
    expect(record[0].checks[1].status).toBe("scheduled");
    expect(renderFollowupsMd(record, [], "3.2")).toContain(
      "| gsc_clicks_28d | BLOCKED | BLOCKED | BLOCKED (not connected) |",
    );
  });
});
