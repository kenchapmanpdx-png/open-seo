// Handbook recovery reconciler (B13 WO-B13-010, ADR-027). Every 5 minutes:
// fail Handbook runs whose heartbeat stopped, free leases no live run holds,
// and start one whole-audit re-run for an interrupted Handbook run or an
// audit that failed for a transient reason. Rows decide; KV only carries the
// heartbeat and the run page's re-run note.
import { env } from "cloudflare:workers";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { audits, projects } from "@/db/schema";
import { handbookRuns } from "@/db/handbook-tables";
import { AuditService } from "@/server/features/audit/services/AuditService";
import { HandbookKv } from "@/server/features/handbook/ops/kv";
import { HandbookLeaseRepository } from "@/server/features/handbook/repositories/HandbookLeaseRepository";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import { isAuditRenderingAllowed } from "@/server/lib/audit/rendering-policy";
import { parseAuditConfig } from "@/server/lib/audit/types";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import {
  readWorkflowStatus,
  terminateStuckWorkflow,
} from "@/server/lib/startWorkflow";

const STALE_AFTER_S = 600;
const RERUN_COOLDOWN_S = 600;
const RERUN_LOOKBACK_S = 3600;
const RERUN_WINDOW_S = 6 * 3600;

/** Audit failures worth one more try; oom / cpu_limit / output size repeat. */
const RERUNNABLE_AUDIT_ERRORS = [
  "db_error",
  "instance_lost",
  "workflow_internal",
  "step_timeout",
  "unknown",
];
const INTERRUPTED = "interrupted";

/** D1 defaults lack the T/Z; read both formats as UTC (as upstream does). */
function parseTs(value: string | null): number {
  if (!value) return Number.NaN;
  return Date.parse(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Step 2: a run past `STALE_AFTER_S` whose beat stopped is interrupted. */
async function failStaleRuns(now: number) {
  const staleMs = STALE_AFTER_S * 1000;
  for (const run of await HandbookRepository.listActiveRuns()) {
    if (!(now - parseTs(run.startedAt) > staleMs)) continue;
    const beat = await HandbookKv.getBeat(run.id);
    if (beat && now - beat.ts <= staleMs) continue;
    if (run.workflowInstanceId) {
      const status = await readWorkflowStatus(
        env.SITE_AUDIT_WORKFLOW,
        run.workflowInstanceId,
      );
      const stopped =
        status === "missing" ||
        (status !== null &&
          ["complete", "errored", "terminated"].includes(status.status));
      if (!stopped) {
        await terminateStuckWorkflow(
          env.SITE_AUDIT_WORKFLOW,
          run.workflowInstanceId,
        );
      }
    }
    await HandbookRepository.finishRun({
      projectId: run.projectId,
      runId: run.id,
      status: "failed",
      errorCode: INTERRUPTED,
    });
    await HandbookLeaseRepository.release(run.id);
    console.warn("handbook.reconciler.interrupted", {
      runId: run.id,
      lastBeat: beat ? iso(beat.ts) : null,
    });
  }
}

/** Step 3: a lease whose holder is not `running | queued` is free. */
async function releaseOrphanLease() {
  const holder = await HandbookLeaseRepository.currentHolder();
  if (!holder) return;
  const active = await HandbookRepository.listActiveRuns();
  if (active.some((run) => run.id === holder)) return;
  await HandbookLeaseRepository.release(holder);
  console.warn("handbook.reconciler.lease-released", { runId: holder });
}

const auditColumns = {
  id: audits.id,
  projectId: audits.projectId,
  startUrl: audits.startUrl,
  startedByUserId: audits.startedByUserId,
  config: audits.config,
  startedAt: audits.startedAt,
};
type Candidate = {
  id: string;
  projectId: string;
  startUrl: string;
  startedByUserId: string;
  config: string;
  startedAt: string;
};

/** Step 4: interrupted Handbook runs at once; failed audits after a cooldown. */
async function listCandidates(now: number): Promise<Candidate[]> {
  const since = iso(now - RERUN_LOOKBACK_S * 1000);
  const interrupted = await db
    .select(auditColumns)
    .from(handbookRuns)
    .innerJoin(audits, eq(audits.id, handbookRuns.auditId))
    .where(
      and(
        eq(handbookRuns.status, "failed"),
        eq(handbookRuns.errorCode, INTERRUPTED),
        gte(handbookRuns.finishedAt, since),
      ),
    );
  const failedAudits = await db
    .select(auditColumns)
    .from(audits)
    .where(
      and(
        eq(audits.status, "failed"),
        inArray(audits.errorCode, RERUNNABLE_AUDIT_ERRORS),
        gte(audits.completedAt, since),
        lte(audits.completedAt, iso(now - RERUN_COOLDOWN_S * 1000)),
      ),
    );
  return [...interrupted, ...failedAudits];
}

/** The first step-5 rule that blocks a re-run, or null when all hold. */
async function blockingRule(
  candidate: Candidate,
  now: number,
): Promise<string | null> {
  if ((await getOptionalEnvValue("HANDBOOK_AUTO_RERUN")) === "0") {
    return "automatic re-run is off (HANDBOOK_AUTO_RERUN=0)";
  }
  const running = await db
    .select({ id: audits.id })
    .from(audits)
    .where(
      and(
        eq(audits.projectId, candidate.projectId),
        eq(audits.status, "running"),
      ),
    )
    .limit(1);
  if (running.length > 0) return "another audit is running in this project";
  const site = await db
    .select({
      id: audits.id,
      status: audits.status,
      startedAt: audits.startedAt,
      handbookError: handbookRuns.errorCode,
    })
    .from(audits)
    .leftJoin(handbookRuns, eq(handbookRuns.auditId, audits.id))
    .where(
      and(
        eq(audits.projectId, candidate.projectId),
        eq(audits.startUrl, candidate.startUrl),
      ),
    )
    .orderBy(desc(audits.startedAt))
    .limit(50);
  const startedAt = parseTs(candidate.startedAt);
  if (site.some((a) => parseTs(a.startedAt) > startedAt)) {
    return "a newer audit of this site exists";
  }
  const windowStart = now - RERUN_WINDOW_S * 1000;
  const troubled = site.filter(
    (a) =>
      parseTs(a.startedAt) >= windowStart &&
      (a.status === "failed" || a.handbookError === INTERRUPTED),
  );
  if (troubled.length > 1) {
    return "a second failure within 6 hours (one automatic re-run per site)";
  }
  return null;
}

async function dbPing() {
  try {
    await db.select({ id: projects.id }).from(projects).limit(1);
    return true;
  } catch {
    return false;
  }
}

/** Step 6: the same audit again, as the user who started it. */
async function startRerun(candidate: Candidate) {
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, candidate.projectId))
    .limit(1);
  if (!project) return null;
  const config = parseAuditConfig(candidate.config);
  const billingCustomer = {
    organizationId: project.organizationId,
    userId: candidate.startedByUserId,
    userEmail: "",
  };
  const { auditId } = await AuditService.startAudit({
    actorUserId: candidate.startedByUserId,
    billingCustomer,
    projectId: candidate.projectId,
    startUrl: candidate.startUrl,
    maxPages: config?.maxPages,
    lighthouseStrategy: config?.lighthouseStrategy,
    excludePaths: config?.excludePaths,
    renderJavaScript:
      config?.renderJavaScript === true && (await isAuditRenderingAllowed()),
    limitTier: await AuditService.resolveAuditLimitTier(billingCustomer),
  });
  return auditId;
}

async function rerunEligible(now: number) {
  for (const candidate of await listCandidates(now)) {
    const rule = await blockingRule(candidate, now);
    if (rule) {
      // Keep the note of a re-run already started (its new audit now blocks).
      const note = await HandbookKv.getRerunNote(candidate.id);
      if (!note || !("newAuditId" in note)) {
        await HandbookKv.putRerunNote(candidate.id, { blockedBy: rule });
      }
      continue;
    }
    // DB trouble: nothing now, the next tick retries.
    if (!(await dbPing())) return;
    const newAuditId = await startRerun(candidate);
    if (!newAuditId) continue;
    await HandbookKv.putRerunNote(candidate.id, { newAuditId, at: iso(now) });
    console.warn("handbook.reconciler.rerun", {
      auditId: candidate.id,
      newAuditId,
    });
  }
}

export async function reconcileHandbookRuns(now = Date.now()) {
  if (!(await HandbookKv.selfTest())) {
    console.warn("handbook.reconciler.kv-unavailable");
    return;
  }
  await failStaleRuns(now);
  await releaseOrphanLease();
  await rerunEligible(now);
}

export const handbookReconcilerJob = {
  name: "handbook-reconciler",
  run: () => reconcileHandbookRuns(),
};
