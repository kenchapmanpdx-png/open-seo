import type { WorkflowStep, WorkflowStepConfig } from "cloudflare:workers";
import { db } from "@/db";
import { getDatabaseProvider } from "@/db/provider";
import { pgStep } from "@/server/workflows/pgStep";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import { planBatches, STAGES } from "@/server/features/handbook/engine/stages";

/** Per stage unit (ADR-018): 30-min timeout, one retry (attempt + 1 on the stage row). */
const UNIT_STEP: WorkflowStepConfig = {
  retries: { limit: 1, delay: "30 seconds" },
  timeout: "30 minutes",
};

/**
 * `pgStep` that closes the step's Postgres connection when the body ends.
 * Upstream leaves it open for Hyperdrive to pool; on the direct Supabase
 * session pooler (pool 15, `run-local.sh`) each open step client holds a
 * slot, and a staged run has one step per unit (RUNBOOK `EMAXCONNSESSION`).
 */
function hbStep<T extends Rpc.Serializable<T>>(
  step: WorkflowStep,
  name: string,
  config: WorkflowStepConfig | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return pgStep(step, name, config, async () => {
    try {
      return await fn();
    } finally {
      await releasePgConnection();
    }
  });
}

async function releasePgConnection() {
  if (getDatabaseProvider() !== "postgres") return;
  const client: unknown = Reflect.get(db, "$client");
  if (isEndable(client)) await client.end({ timeout: 5 }).catch(() => {});
}

/** postgres.js `Sql.end`. */
function isEndable(
  value: unknown,
): value is { end: (options: { timeout: number }) => Promise<void> } {
  return (
    typeof value === "function" &&
    "end" in value &&
    typeof value.end === "function"
  );
}

const service = async () =>
  (await import("@/server/features/handbook/services/HandbookRunService"))
    .HandbookRunService;

/**
 * One-line hook target in `runAuditPhases` (ADR-001). Flag off → one cheap
 * step and return, without importing the engine. On: the staged run
 * (FULL-READ §7.1) — one `pgStep` per `(stage, batch)` with id
 * `runId:stage:batch`; a unit whose `handbook_run_stage` row is `done`
 * returns at once, so a resumed run skips finished work. A handbook failure
 * is logged and swallowed: it never fails the upstream audit.
 */
export async function runHandbookPhase(
  step: WorkflowStep,
  params: { auditId: string; projectId: string; startUrl: string },
) {
  // Deterministic per audit: a step retry or resume reuses the same run row.
  const runId = `hb-${params.auditId}`;
  try {
    const setting = await hbStep(
      step,
      "handbook-setting-v1",
      undefined,
      async () => {
        const row = await HandbookRepository.getProjectSetting(
          params.projectId,
        );
        return row?.enabled
          ? { mode: row.mode, tierOverride: row.tierOverride }
          : null;
      },
    );
    if (!setting) return;
    const start = await hbStep(step, `${runId}:start`, undefined, async () => {
      const seedUrls = await HandbookRepository.listCrawledUrls(params.auditId);
      const run = {
        runId,
        projectId: params.projectId,
        auditId: params.auditId,
        origin: new URL(params.startUrl).origin,
        seedUrls,
        mode: setting.mode,
        tierOverride: setting.tierOverride,
      };
      return { ...run, startedAt: await (await service()).startRun(run) };
    });
    try {
      await hbStep(step, `${runId}:crawl:0`, UNIT_STEP, async () =>
        (await service()).runStage(start, "crawl", 0, planBatches({})),
      );
      const batches = await hbStep(step, `${runId}:plan`, undefined, async () =>
        (await service()).planRun(start, start.startedAt),
      );
      for (const stage of STAGES.slice(1)) {
        for (let batch = 0; batch < batches[stage]; batch++) {
          await hbStep(
            step,
            `${runId}:${stage}:${batch}`,
            UNIT_STEP,
            async () =>
              (await service()).runStage(start, stage, batch, batches),
          );
        }
      }
    } catch (error) {
      await hbStep(step, `${runId}:failed`, undefined, async () => {
        await (await service()).failRun(start, error);
        return null;
      });
      throw error;
    }
  } catch (error) {
    console.error("handbook.phase.failed", {
      auditId: params.auditId,
      error: String(error),
    });
  }
}
