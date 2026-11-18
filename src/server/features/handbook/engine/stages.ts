import type {
  CollectedData,
  Collector,
  CollectorContext,
  CollectorKey,
} from "@/server/features/handbook/contracts/collectors";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";

/**
 * Staged handbook run (FULL-READ §7.1, ADR-018). One unit of work is a
 * `(stage, batch)`; its state lives in a `StageTracker` (DB rows
 * `handbook_run_stage` in the app, memory in the CLI) and its output in a
 * `StageStore` (evidence store in the app). A unit whose row is `done`
 * returns immediately, so a resumed or replayed run skips finished work.
 * The workflow adapter runs one unit per `pgStep`; the CLI runs them all
 * in-process through `runStagedHandbook` — the same code either way.
 */
export const STAGES = [
  "crawl",
  "render",
  "axe",
  "lighthouse",
  "map",
  "reduce",
  "checks",
  "report",
] as const;
export type StageName = (typeof STAGES)[number];
export type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";

/** Default whole-run cap; `HANDBOOK_RUN_MAX_MINUTES` overrides. */
export const RUN_MAX_MINUTES_ENV = "HANDBOOK_RUN_MAX_MINUTES";
const DEFAULT_RUN_MAX_MINUTES = 90;
const RUN_TIME_CAP_REASON = "run time cap";

export function resolveRunMaxMinutes(env: string | undefined): number {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RUN_MAX_MINUTES;
}

/** Collector keys owned by a sidecar stage; every other collector runs in `crawl`. */
const STAGE_COLLECTORS: Partial<Record<StageName, readonly CollectorKey[]>> = {
  render: ["render"],
  axe: ["axe"],
  lighthouse: ["lighthouse"],
};

function collectorStage(key: CollectorKey): StageName {
  return STAGES.find((s) => STAGE_COLLECTORS[s]?.includes(key)) ?? "crawl";
}

/**
 * Runs the collectors `stage` owns (in dependency order) on top of `prior`
 * and returns only their output. A throwing collector reads `unavailable`.
 */
export async function collectStage(
  collectors: readonly Collector<CollectorKey>[],
  ctx: CollectorContext,
  stage: StageName,
  prior: Partial<CollectedData>,
): Promise<Partial<CollectedData>> {
  const collected: Partial<CollectedData> = { ...prior };
  const produced: Partial<CollectedData> = {};
  for (const collector of collectors) {
    if (collectorStage(collector.key) !== stage) continue;
    let value: unknown;
    try {
      value = await collector.collect(ctx, collected);
    } catch (error) {
      ctx.log("handbook.collector.error", {
        key: collector.key,
        error: String(error),
      });
      value = {
        status: "unavailable",
        reason: `collector error: ${String(error).slice(0, 200)}`,
      };
    }
    Object.assign(collected, { [collector.key]: value });
    Object.assign(produced, { [collector.key]: value });
  }
  return produced;
}

/** Keys no stage produced read "collector not configured". */
export function completeCollected(
  collected: Partial<CollectedData>,
): CollectedData {
  const off = {
    status: "unavailable",
    reason: "collector not configured",
  } as const;
  return {
    pages: collected.pages ?? off,
    robots: collected.robots ?? off,
    sitemap: collected.sitemap ?? off,
    llms: collected.llms ?? off,
    headers: collected.headers ?? off,
    variants: collected.variants ?? off,
    botFetch: collected.botFetch ?? off,
    outbound: collected.outbound ?? off,
    jsonld: collected.jsonld ?? off,
    templates: collected.templates ?? off,
    render: collected.render ?? off,
    axe: collected.axe ?? off,
    lighthouse: collected.lighthouse ?? off,
  };
}

/** Stages the run cap may skip; crawl, checks and report always run. */
const CAPPABLE = new Set<StageName>([
  "render",
  "axe",
  "lighthouse",
  "map",
  "reduce",
]);

/**
 * Batch count per stage after the crawl (ADR-018: render and Lighthouse
 * 25 pages per batch, map 20). Render, Lighthouse and map are one batch until their collectors take page batches (WO-B9-004 / 031 / 015);
 * the step ids already carry the batch so that change needs no new wiring.
 */
export function planBatches(
  _crawl: Partial<CollectedData>,
): Record<StageName, number> {
  return {
    crawl: 1,
    render: 1,
    axe: 1,
    lighthouse: 1,
    map: 1,
    reduce: 1,
    checks: 1,
    report: 1,
  };
}

export type StageRow = { status: StageStatus; attempt: number };

export type StageTracker = {
  get: (stage: StageName, batch: number) => Promise<StageRow | null>;
  /** Marks `running`, attempt + 1; returns the new attempt. */
  start: (stage: StageName, batch: number) => Promise<number>;
  finish: (stage: StageName, batch: number, itemsDone: number) => Promise<void>;
  fail: (stage: StageName, batch: number, error: string) => Promise<void>;
  skip: (stage: StageName, batch: number, reason: string) => Promise<void>;
};

/** Output of a finished unit, reloaded by later stages (facts only, no bodies). */
export type StageStore = {
  save: (stage: StageName, batch: number, data: unknown) => Promise<void>;
  load: (stage: StageName, batch: number) => Promise<unknown>;
};

const unitKey = (stage: StageName, batch: number) => `${stage}:${batch}`;

export function createMemoryStageTracker(): StageTracker & {
  rows: Map<string, StageRow & { error?: string; itemsDone?: number }>;
} {
  const rows = new Map<
    string,
    StageRow & { error?: string; itemsDone?: number }
  >();
  return {
    rows,
    async get(stage, batch) {
      return rows.get(unitKey(stage, batch)) ?? null;
    },
    async start(stage, batch) {
      const attempt = (rows.get(unitKey(stage, batch))?.attempt ?? 0) + 1;
      rows.set(unitKey(stage, batch), { status: "running", attempt });
      return attempt;
    },
    async finish(stage, batch, itemsDone) {
      const row = rows.get(unitKey(stage, batch));
      rows.set(unitKey(stage, batch), {
        status: "done",
        attempt: row?.attempt ?? 1,
        itemsDone,
      });
    },
    async fail(stage, batch, error) {
      const row = rows.get(unitKey(stage, batch));
      rows.set(unitKey(stage, batch), {
        status: "failed",
        attempt: row?.attempt ?? 1,
        error,
      });
    },
    async skip(stage, batch, reason) {
      const row = rows.get(unitKey(stage, batch));
      rows.set(unitKey(stage, batch), {
        status: "skipped",
        attempt: row?.attempt ?? 0,
        error: reason,
      });
    },
  };
}

export function createMemoryStageStore(): StageStore {
  const data = new Map<string, unknown>();
  return {
    async save(stage, batch, value) {
      data.set(`${stage}:${batch}`, value);
    },
    async load(stage, batch) {
      return data.get(`${stage}:${batch}`) ?? null;
    },
  };
}

/** Stage outputs as gzip'd JSON under the run's evidence prefix (deleted with the run). */
export function createEvidenceStageStore(
  store: EvidenceStore,
  projectId: string,
  runId: string,
): StageStore {
  const key = (stage: StageName, batch: number) =>
    `${projectId}/${runId}/stages/${stage}-${batch}.json.gz`;
  return {
    async save(stage, batch, value) {
      const bytes = await gzip(new TextEncoder().encode(JSON.stringify(value)));
      await store.put(key(stage, batch), bytes, "application/gzip");
    },
    async load(stage, batch) {
      const bytes = await store.get(key(stage, batch));
      if (!bytes) return null;
      const parsed: unknown = JSON.parse(
        new TextDecoder().decode(await gunzip(bytes)),
      );
      return parsed;
    },
  };
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream("gzip"));
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream("gzip"));
}

async function pipe(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)])
    .stream()
    .pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * What a stage needs from the engine. Injected (not imported) so the runner
 * can drive stages without an import cycle.
 */
export type StageEngine = {
  /** Runs the collectors owned by `stage`; `prior` = earlier stages' output. */
  collect: (
    stage: StageName,
    prior: Partial<CollectedData>,
  ) => Promise<Partial<CollectedData>>;
  /**
   * Intake + checks + evidence over the full collected data. The engine
   * keeps the result (CLI: in memory; app: DB rows + a summary).
   */
  evaluate: (collected: Partial<CollectedData>) => Promise<void>;
  /** Finishes the run from what `evaluate` kept (app: run status). */
  report: () => Promise<void>;
};

export type StageContext = {
  tracker: StageTracker;
  store: StageStore;
  /** Run start; the cap is measured from here. */
  startedAt: Date;
  maxMinutes: number;
  now?: () => Date;
};

export type UnitOutcome = "done" | "replayed" | "skipped";

/** Collection stages in order; checks reload their output. */
const COLLECTION_STAGES = STAGES.filter(
  (s) => s !== "checks" && s !== "report",
);

/** Every collection unit's output merged in stage order (skipped units included). */
export async function loadCollected(
  store: StageStore,
  batches: Record<StageName, number>,
): Promise<Partial<CollectedData>> {
  const out: Partial<CollectedData> = {};
  for (const stage of COLLECTION_STAGES) {
    for (let batch = 0; batch < batches[stage]; batch++) {
      const data = await store.load(stage, batch);
      if (data && typeof data === "object") Object.assign(out, data);
    }
  }
  return out;
}

/**
 * Runs one `(stage, batch)` unit idempotently. `done` → no-op; past the run
 * cap a cappable stage is `skipped` and its collectors read `run time cap`;
 * an error marks the row `failed` (attempt kept) and rethrows so the
 * workflow step retries with attempt + 1.
 */
export async function runStageUnit(
  stage: StageName,
  batch: number,
  batches: Record<StageName, number>,
  engine: StageEngine,
  ctx: StageContext,
): Promise<UnitOutcome> {
  const row = await ctx.tracker.get(stage, batch);
  if (row?.status === "done" || row?.status === "skipped") return "replayed";
  const elapsedMin =
    ((ctx.now?.() ?? new Date()).getTime() - ctx.startedAt.getTime()) / 60_000;
  if (CAPPABLE.has(stage) && elapsedMin >= ctx.maxMinutes) {
    await ctx.store.save(stage, batch, capped(stage));
    await ctx.tracker.skip(stage, batch, RUN_TIME_CAP_REASON);
    return "skipped";
  }
  await ctx.tracker.start(stage, batch);
  try {
    const items = await runWork(stage, batch, batches, engine, ctx.store);
    await ctx.tracker.finish(stage, batch, items);
    return "done";
  } catch (error) {
    await ctx.tracker.fail(stage, batch, String(error).slice(0, 500));
    throw error;
  }
}

/** Unavailable output for every collector a skipped stage owns. */
function capped(stage: StageName): Partial<CollectedData> {
  const out: Partial<CollectedData> = {};
  for (const key of STAGE_COLLECTORS[stage] ?? [])
    out[key] = { status: "unavailable", reason: RUN_TIME_CAP_REASON };
  return out;
}

async function runWork(
  stage: StageName,
  batch: number,
  batches: Record<StageName, number>,
  engine: StageEngine,
  store: StageStore,
): Promise<number> {
  if (stage === "checks") {
    await engine.evaluate(await loadCollected(store, batches));
    return 1;
  }
  if (stage === "report") {
    await engine.report();
    return 1;
  }
  const prior = stage === "crawl" ? {} : await loadCollected(store, batches);
  const patch = await engine.collect(stage, prior);
  await store.save(stage, batch, patch);
  return Object.keys(patch).length;
}

/**
 * In-process staged run (CLI, outcome reruns, tests): every unit in order.
 * Same units and idempotency as the workflow.
 */
export async function runStagedHandbook(
  engine: StageEngine,
  ctx: StageContext,
): Promise<void> {
  const one = planBatches({});
  await runStageUnit("crawl", 0, one, engine, ctx);
  const batches = planBatches(await loadCollected(ctx.store, one));
  for (const stage of STAGES.slice(1)) {
    for (let batch = 0; batch < batches[stage]; batch++) {
      await runStageUnit(stage, batch, batches, engine, ctx);
    }
  }
}
