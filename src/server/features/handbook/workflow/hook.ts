import type { WorkflowStep, WorkflowStepConfig } from "cloudflare:workers";
import { pgStep } from "@/server/workflows/pgStep";
import { releasePgConnection } from "./pgRelease";
import { HandbookLeaseRepository } from "@/server/features/handbook/repositories/HandbookLeaseRepository";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import {
  planBatches,
  STAGES,
  type StageName,
} from "@/server/features/handbook/engine/stages";

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

/** 30-s polls past the 2-h lease expiry, so a dead holder is always taken over. */
const LEASE_POLLS = 300;

/**
 * Run queue (ADR-018): wait `queued` until this run holds the machine lease.
 * Returns the acquire time; the run cap counts from it, not from the queued
 * start, so waiting never eats the 90-min budget.
 */
async function waitForLease(step: WorkflowStep, runId: string) {
  for (let poll = 0; ; poll++) {
    const at = await hbStep(
      step,
      `${runId}:lease:${poll}`,
      undefined,
      async () =>
        (await HandbookLeaseRepository.acquire(runId))
          ? new Date().toISOString()
          : null,
    );
    if (at) return at;
    if (poll >= LEASE_POLLS) throw new Error("handbook: queue wait timed out");
    await step.sleep(`${runId}:queued:${poll}`, "30 seconds");
  }
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
      const leased = { ...start, startedAt: await waitForLease(step, runId) };
      // Each unit renews the lease first, so a long run keeps the machine.
      const unit = (
        stage: StageName,
        batch: number,
        batches: Record<StageName, number>,
      ) =>
        hbStep(step, `${runId}:${stage}:${batch}`, UNIT_STEP, async () => {
          await HandbookLeaseRepository.renew(runId);
          return (await service()).runStage(leased, stage, batch, batches);
        });
      await unit("crawl", 0, planBatches({}));
      const batches = await hbStep(step, `${runId}:plan`, undefined, async () =>
        (await service()).planRun(leased, leased.startedAt),
      );
      for (const stage of STAGES.slice(1)) {
        for (let batch = 0; batch < batches[stage]; batch++) {
          await unit(stage, batch, batches);
        }
      }
    } catch (error) {
      await hbStep(step, `${runId}:failed`, undefined, async () => {
        await (await service()).failRun(start, error);
        return null;
      });
      throw error;
    } finally {
      await hbStep(step, `${runId}:release`, undefined, async () => {
        await HandbookLeaseRepository.release(runId);
        return null;
      });
    }
  } catch (error) {
    console.error("handbook.phase.failed", {
      auditId: params.auditId,
      error: String(error),
    });
  }
}
