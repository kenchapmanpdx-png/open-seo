import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import { AppError } from "@/server/lib/errors";
import { OUTCOME_METRICS, OUTCOME_OFFSETS_WEEKS } from "./contracts";
import {
  claimCheck,
  completeCheck,
  getRun,
  insertBatch,
  listBatchClasses,
  listBatches,
  listDueChecks,
  listFindingTargets,
  listItemStatuses,
  listMetrics,
  type MetricRow,
} from "./OutcomeRepository";

// Outcome record (ADR-017 §3, handbook P11): a fix batch schedules checks at
// +4 and +12 weeks; each due check reruns the deterministic checks on the
// batch URLs and collects before → after metrics from connected sources.
// A source that is not connected yields NULL values, never a guess.

type Scope = { projectId: string; organizationId: string };
export type OutcomeMetricName = (typeof OUTCOME_METRICS)[number];
type Pair = { before: string | null; after: string | null };

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const DUE_CHECKS_PER_TICK = 2;
const CLAIM_LEASE_MS = 60 * 60 * 1000;
const BLOCKED_SOURCE = "BLOCKED (not connected)";
const FIXABLE_MODES = new Set(["AUDIT", "MAINTAIN"]);
const OPEN_STATUSES = new Set(["OPEN", "PARTIAL"]);

export type SourceContext = Scope & {
  origin: string;
  urls: string[];
  fixedAt: Date;
  checkAt: Date;
};

/** One connected source; `null` from `collect` = not connected (BLOCKED). */
export type OutcomeSource = {
  metrics: readonly OutcomeMetricName[];
  collect: (ctx: SourceContext) => Promise<{
    source: string;
    payload: unknown;
    values: Partial<Record<OutcomeMetricName, Map<string, Pair>>>;
  } | null>;
};

export type OutcomeDeps = {
  /** URL-limited, deterministic-only handbook rerun; returns the persisted run id. */
  rerun: (input: Scope & { origin: string; urls: string[] }) => Promise<string>;
  sources: readonly OutcomeSource[];
  store: EvidenceStore;
};

// ---------------------------------------------------------------- fix batches

async function assertFixableRun(scope: Scope, runId: string) {
  const run = await getRun(runId, scope.projectId, scope.organizationId);
  if (!run) throw new AppError("NOT_FOUND", "Handbook run not found.");
  // EP-7: a REVIEW is an outside assessment, never an outcome baseline.
  if (!FIXABLE_MODES.has(run.mode))
    throw new AppError(
      "VALIDATION_ERROR",
      "Fix batches need an AUDIT or MAINTAIN run.",
    );
  if (run.status !== "completed")
    throw new AppError("VALIDATION_ERROR", "The run has not completed.");
  return run;
}

async function createBatch(
  scope: Scope,
  baselineRunId: string,
  classes: { itemId: string; url: string }[],
  fixedAt: Date,
) {
  if (classes.length === 0)
    throw new AppError("VALIDATION_ERROR", "No findings to record as fixed.");
  const id = crypto.randomUUID();
  await insertBatch(
    { id, ...scope, baselineRunId, fixedAt: fixedAt.toISOString() },
    classes,
    OUTCOME_OFFSETS_WEEKS.map((offsetWeeks) => ({
      id: crypto.randomUUID(),
      offsetWeeks,
      dueAt: new Date(fixedAt.getTime() + offsetWeeks * WEEK_MS).toISOString(),
    })),
  );
  return { batchId: id, classes: classes.length };
}

async function targetsOf(runId: string, origin: string) {
  const rows = await listFindingTargets(runId);
  return rows.map((r) => ({ ...r, url: r.url ?? origin }));
}

const uniqueClasses = (rows: { itemId: string; url: string }[]) => [
  ...new Map(rows.map((r) => [`${r.itemId} ${r.url}`, r])).values(),
];

/** The user marks findings of a run fixed (all of them when `findingCodes` is empty). */
async function recordFixBatch(
  scope: Scope,
  input: { runId: string; findingCodes: string[]; fixedAt?: Date },
) {
  const run = await assertFixableRun(scope, input.runId);
  const codes = new Set(input.findingCodes);
  const targets = (await targetsOf(run.id, run.origin)).filter(
    (t) => codes.size === 0 || codes.has(t.code),
  );
  return createBatch(
    scope,
    run.id,
    uniqueClasses(targets),
    input.fixedAt ?? new Date(),
  );
}

/** Items OPEN/PARTIAL in the baseline and PASS in a later run (OPEN → PASS flips). */
async function recordFlipBatch(
  scope: Scope,
  input: { baselineRunId: string; laterRunId: string },
) {
  const baseline = await assertFixableRun(scope, input.baselineRunId);
  await assertFixableRun(scope, input.laterRunId);
  const [before, after] = await Promise.all([
    listItemStatuses(baseline.id),
    listItemStatuses(input.laterRunId),
  ]);
  const passed = new Set(
    after.filter((s) => s.status === "PASS").map((s) => s.itemId),
  );
  const flipped = new Set(
    before
      .filter((s) => OPEN_STATUSES.has(s.status) && passed.has(s.itemId))
      .map((s) => s.itemId),
  );
  const targets = (await targetsOf(baseline.id, baseline.origin)).filter((t) =>
    flipped.has(t.itemId),
  );
  return createBatch(scope, baseline.id, uniqueClasses(targets), new Date());
}

// ---------------------------------------------------------------- due checks

/** Per (item, url): baseline item status → rerun status for that URL. */
async function handbookStatusPairs(
  baselineRunId: string,
  resultRunId: string,
  origin: string,
) {
  const [before, after, stillFailing] = await Promise.all([
    listItemStatuses(baselineRunId),
    listItemStatuses(resultRunId),
    targetsOf(resultRunId, origin),
  ]);
  const beforeOf = new Map(before.map((s) => [s.itemId, s.status]));
  const afterOf = new Map(after.map((s) => [s.itemId, s.status]));
  const failing = new Set(stillFailing.map((t) => `${t.itemId} ${t.url}`));
  return (itemId: string, url: string): Pair => {
    const status = afterOf.get(itemId) ?? null;
    return {
      before: beforeOf.get(itemId) ?? null,
      // The URL no longer listed under a finding of a still-open item = fixed there.
      after:
        failing.has(`${itemId} ${url}`) ||
        status === null ||
        !OPEN_STATUSES.has(status)
          ? status
          : "PASS",
    };
  };
}

async function storePayload(
  store: EvidenceStore,
  projectId: string,
  checkId: string,
  name: string,
  payload: unknown,
) {
  const stored = await store.put(
    `${projectId}/outcome-${checkId}/source/${name}.json`,
    new TextEncoder().encode(JSON.stringify(payload)),
    "application/json",
  );
  return stored.key;
}

type DueCheck = Awaited<ReturnType<typeof listDueChecks>>[number];

async function runCheck(check: DueCheck, deps: OutcomeDeps, now: Date) {
  const scope = {
    projectId: check.projectId,
    organizationId: check.organizationId,
  };
  const baseline = await getRun(
    check.baselineRunId,
    scope.projectId,
    scope.organizationId,
  );
  if (!baseline) {
    await completeCheck({
      checkId: check.id,
      status: "skipped",
      resultRunId: null,
      metrics: [],
    });
    return;
  }
  const classes = await listBatchClasses(check.batchId);
  const urls = [...new Set(classes.map((c) => c.url))];
  const resultRunId = await deps.rerun({
    ...scope,
    origin: baseline.origin,
    urls,
  });
  const statusOf = await handbookStatusPairs(
    baseline.id,
    resultRunId,
    baseline.origin,
  );

  const metrics: MetricRow[] = [];
  const row = (
    c: { itemId: string; url: string },
    metric: OutcomeMetricName,
    pair: Pair,
    source: string,
    evidencePath: string | null,
  ) =>
    metrics.push({
      id: crypto.randomUUID(),
      checkId: check.id,
      itemId: c.itemId,
      url: c.url,
      metric,
      beforeValue: pair.before,
      afterValue: pair.after,
      source,
      evidencePath,
    });

  for (const c of classes)
    row(
      c,
      "handbook_status",
      statusOf(c.itemId, c.url),
      "handbook rerun (deterministic checks)",
      `handbook_run/${resultRunId}`,
    );

  const covered = new Set<OutcomeMetricName>(["handbook_status"]);
  const ctx: SourceContext = {
    ...scope,
    origin: baseline.origin,
    urls,
    fixedAt: new Date(check.fixedAt),
    checkAt: now,
  };
  for (const source of deps.sources) {
    const result = await source.collect(ctx);
    if (!result) continue;
    const evidencePath = await storePayload(
      deps.store,
      scope.projectId,
      check.id,
      source.metrics.join("+"),
      result.payload,
    );
    for (const metric of source.metrics) {
      const values = result.values[metric];
      if (!values) continue;
      covered.add(metric);
      for (const c of classes)
        row(
          c,
          metric,
          values.get(c.url) ?? { before: null, after: null },
          result.source,
          evidencePath,
        );
    }
  }
  for (const metric of OUTCOME_METRICS)
    if (!covered.has(metric))
      for (const c of classes)
        row(c, metric, { before: null, after: null }, BLOCKED_SOURCE, null);

  await completeCheck({
    checkId: check.id,
    status: "done",
    resultRunId,
    metrics,
  });
}

/** Cron tick: run checks whose due date passed (computer off → next tick). */
async function runDueChecks(deps: OutcomeDeps, now = new Date()) {
  const due = await listDueChecks(now.toISOString(), DUE_CHECKS_PER_TICK);
  let done = 0;
  for (const check of due) {
    const lease = new Date(now.getTime() + CLAIM_LEASE_MS).toISOString();
    if (!(await claimCheck(check.id, check.dueAt, lease))) continue;
    try {
      await runCheck(check, deps, now);
      done++;
    } catch (error) {
      console.error(`[outcome] check ${check.id} failed:`, error);
      await completeCheck({
        checkId: check.id,
        status: "failed",
        resultRunId: null,
        metrics: [],
      });
    }
  }
  return { due: due.length, done };
}

// ---------------------------------------------------------------- reads

/** Batches with their checks and metric rows, for the follow-ups export. */
async function getOutcomeRecord(scope: Scope) {
  const rows = await listBatches(scope.projectId, scope.organizationId);
  const metrics = await listMetrics(rows.map((r) => r.checkId));
  const batches = new Map<
    string,
    {
      batchId: string;
      baselineRunId: string;
      fixedAt: string;
      checks: ((typeof rows)[number] & { metrics: typeof metrics })[];
    }
  >();
  for (const r of rows) {
    const batch = batches.get(r.batchId) ?? {
      batchId: r.batchId,
      baselineRunId: r.baselineRunId,
      fixedAt: r.fixedAt,
      checks: [],
    };
    batch.checks.push({
      ...r,
      metrics: metrics.filter((m) => m.checkId === r.checkId),
    });
    batches.set(r.batchId, batch);
  }
  return [...batches.values()];
}

export const OutcomeService = {
  recordFixBatch,
  recordFlipBatch,
  runDueChecks,
  getOutcomeRecord,
};
