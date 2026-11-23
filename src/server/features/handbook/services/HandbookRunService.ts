import { eq } from "drizzle-orm";
import { scoreRun } from "./HandbookScore";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { sha256Hex } from "@/server/lib/audit/ids";
import { getOpenRouterAccess } from "@/server/lib/openrouter";
import { getOptionalEnvValue, getWorkersEnv } from "@/server/lib/runtime-env";
import {
  HANDBOOK_VERSION,
  REGISTRY,
} from "@/server/features/handbook/registry";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import type { Coverage } from "@/server/features/handbook/contracts/collectors";
import {
  siteTierSchema,
  type HandbookMode,
  type SiteTier,
} from "@/server/features/handbook/contracts/status";
import {
  LLM_BUDGET_ENV,
  llmVerdictSchema,
} from "@/server/features/handbook/contracts/llm";
import { createDefaultCollectors } from "@/server/features/handbook/collectors";
import {
  probeSidecar,
  sidecarConfigFromEnv,
} from "@/server/features/handbook/collectors/sidecar-config";
import {
  SIDECAR_TOKEN_ENV,
  SIDECAR_URL_ENV,
} from "@/server/features/handbook/contracts/sidecar";
import { HANDBOOK_CHECKS } from "@/server/features/handbook/checks";
import {
  collectorContext,
  evaluateRun,
  type HandbookRuntime,
  type RunInput,
} from "@/server/features/handbook/engine/runner";
import {
  createEvidenceStageStore,
  loadCollected,
  planBatches,
  resolveRunMaxMinutes,
  RUN_MAX_MINUTES_ENV,
  runStageUnit,
  type StageContext,
  type StageName,
  type UnitOutcome,
} from "@/server/features/handbook/engine/stages";
import {
  createSafeFetch,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { createSupabaseEvidenceStore } from "@/server/features/handbook/engine/supabase-evidence-store";
import {
  DEPTH_ENV,
  LIGHTHOUSE_ENV,
  MAX_PAGES_ENV,
  resolveDepth,
  resolveMaxPages,
} from "@/server/features/handbook/engine/depth";
import type {
  LlmCallLog,
  VerdictCache,
} from "@/server/features/handbook/llm/judge";
import { createRunBudget } from "@/server/features/handbook/llm/budget";
import {
  createHandbookJudge,
  createHandbookMapper,
  createHandbookQueryDeriver,
  createHandbookSerpJudge,
  HANDBOOK_LLM_MODEL_ENV,
} from "@/server/features/handbook/llm/model";
import {
  createSerpBudget,
  dataforseoSerpLookup,
  SERP_BUDGET_ENV,
  SERP_ORIGINALITY_ENV,
  SERP_ORIGINALITY_PAGES_ENV,
  serpEnvOn,
  serpPagesFromEnv,
} from "@/server/features/handbook/llm/serp-originality-deps";
import type { SerpDeps } from "@/server/features/handbook/llm/serp-originality-collect";
import type { OpenRouterAccess } from "@/server/lib/openrouter";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import { collectRunUnit } from "@/server/features/handbook/engine/map-stage";
import { runScope } from "./runScope";
import {
  COPY_QUALITY_ENV,
  copyQualityEnvOn,
} from "@/server/features/handbook/engine/copy-quality";
import { HandbookStageRepository } from "@/server/features/handbook/repositories/HandbookStageRepository";
import { HandbookPageProfileRepository } from "@/server/features/handbook/repositories/HandbookPageProfileRepository";
import { LLM_EXTRACT_MODEL_ENV } from "@/server/features/handbook/contracts/page-profile";

/**
 * Staged handbook run in the app (FULL-READ §7.1, ADR-018): the workflow
 * hook calls `startRun`, the crawl unit, `planRun`, then one `runStage` per
 * `(stage, batch)`. Each call rebuilds its context, so any step can run in a
 * fresh invocation; facts move between steps through the evidence store.
 */

/** Pre-B9 app cap, kept for `HANDBOOK_DEPTH=quick`. */
const QUICK_MAX_PAGES = 200;

export async function supabaseConfig() {
  const url = await getOptionalEnvValue("SUPABASE_URL");
  const serviceRoleKey = await getOptionalEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

async function evidenceStore(): Promise<EvidenceStore> {
  const config = await supabaseConfig();
  if (config) return createSupabaseEvidenceStore(config);
  // ADR-003 fallback: excerpts still land in handbook_evidence; bodies are dropped.
  console.warn(
    "handbook: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing; evidence bodies not persisted",
  );
  return createMemoryEvidenceStore();
}

type HandbookRunParams = {
  runId: string;
  projectId: string;
  auditId: string | null;
  origin: string;
  /** The upstream crawl's URLs; the crawl still follows links up to the cap. */
  seedUrls: readonly string[];
  mode: HandbookMode;
  tierOverride: SiteTier | null;
};

/** Run row (idempotent: a replayed step keeps the first row) → its start time. */
async function startRun(input: HandbookRunParams): Promise<string> {
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project) throw new Error("handbook: project not found");
  await HandbookRepository.createRun({
    id: input.runId,
    projectId: input.projectId,
    organizationId: project.organizationId,
    auditId: input.auditId,
    origin: input.origin,
    handbookVersion: HANDBOOK_VERSION,
    contractsVersion: CONTRACTS_VERSION,
    mode: input.mode,
    depth: resolveDepth(await getOptionalEnvValue(DEPTH_ENV)),
  });
  const run = await HandbookRepository.getRun(input.projectId, input.runId);
  return run?.startedAt ?? new Date().toISOString();
}

const log = (event: string, fields: Record<string, unknown>) =>
  console.log(event, fields);

/** Bodies and stage outputs; without Supabase, one in-isolate store for the whole run. */
let fallbackStore: EvidenceStore | null = null;
async function runStore(): Promise<EvidenceStore> {
  if (await supabaseConfig()) return evidenceStore();
  fallbackStore ??= await evidenceStore();
  return fallbackStore;
}

/**
 * Judge verdicts kept in the evidence store under
 * `<projectId>/_judge-cache/`, so an unchanged rerun of the project skips
 * its judge calls (FULL-READ §9 rerun cost). Outside any run folder, so
 * evidence retention keeps it; one small JSON object per verdict.
 */
function storeVerdictCache(
  store: EvidenceStore,
  projectId: string,
): VerdictCache {
  const key = async (k: string) =>
    `${projectId}/_judge-cache/${await sha256Hex(k)}.json`;
  return {
    async get(k) {
      const bytes = await store.get(await key(k));
      if (!bytes) return null;
      try {
        const parsed = llmVerdictSchema.safeParse(
          JSON.parse(new TextDecoder().decode(bytes)),
        );
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    async put(k, verdict) {
      await store.put(
        await key(k),
        new TextEncoder().encode(JSON.stringify(verdict)),
        "application/json",
      );
    },
  };
}

/** Project setting wins when on; env `on` is the operator default (ADR-023). */
async function runOptions(projectId: string) {
  const setting = await HandbookRepository.getProjectSetting(projectId);
  return {
    copyQuality:
      (setting?.copyQuality ?? false) ||
      copyQualityEnvOn(await getOptionalEnvValue(COPY_QUALITY_ENV)),
    serpOriginality:
      (setting?.serpOriginality ?? false) ||
      serpEnvOn(await getOptionalEnvValue(SERP_ORIGINALITY_ENV)),
    serpOriginalityPages: serpPagesFromEnv(
      await getOptionalEnvValue(SERP_ORIGINALITY_PAGES_ENV),
    ),
  };
}

/**
 * SUPP-18 dependencies (ADR-024): DataForSEO live SERP, SERP cache in the
 * evidence store, query deriver and competitor map model on their own budget.
 */
async function serpDeps(
  access: OpenRouterAccess | null,
  store: EvidenceStore,
  input: HandbookRunParams,
): Promise<SerpDeps> {
  const budget = createSerpBudget(await getOptionalEnvValue(SERP_BUDGET_ENV));
  const modelId = await getOptionalEnvValue(HANDBOOK_LLM_MODEL_ENV);
  const mapper = access
    ? createHandbookMapper({
        access,
        modelId: await getOptionalEnvValue(LLM_EXTRACT_MODEL_ENV),
        budgetUsd: budget.remainingUsd,
        cache: HandbookPageProfileRepository.forProject(
          input.projectId,
          input.runId,
        ),
        log,
      })
    : null;
  return {
    lookup: dataforseoSerpLookup,
    cache: store,
    deriveQueries: access
      ? createHandbookQueryDeriver({ access, modelId, budget, log })
      : null,
    mapper,
    judge: access
      ? createHandbookSerpJudge({ access, modelId, budget, mapper, log })
      : null,
  };
}

/** Everything one stage unit needs; rebuilt per workflow step (cheap, no I/O but env and settings). */
async function prepareStage(input: HandbookRunParams, startedAt: string) {
  const depth = resolveDepth(await getOptionalEnvValue(DEPTH_ENV));
  const scope = await runScope(
    input,
    resolveMaxPages({
      depth,
      env: await getOptionalEnvValue(MAX_PAGES_ENV),
      quickDefault: QUICK_MAX_PAGES,
    }),
  );
  const llmCalls: LlmCallLog[] = [];
  const access = getOpenRouterAccess((await getWorkersEnv()) ?? {});
  const budget = createRunBudget(await getOptionalEnvValue(LLM_BUDGET_ENV));
  const store = await runStore();
  const judge = access
    ? createHandbookJudge({
        access,
        modelId: await getOptionalEnvValue(HANDBOOK_LLM_MODEL_ENV),
        budgetUsd: budget.judgeUsd,
        log: async (call) => {
          llmCalls.push(call);
        },
        cache: storeVerdictCache(store, input.projectId),
      })
    : null;
  const mapper = access
    ? createHandbookMapper({
        access,
        modelId: await getOptionalEnvValue(LLM_EXTRACT_MODEL_ENV),
        budgetUsd: budget.mapUsd,
        cache: HandbookPageProfileRepository.forProject(
          input.projectId,
          input.runId,
        ),
        log,
      })
    : null;
  const options = await runOptions(input.projectId);
  const sidecar = sidecarConfigFromEnv(
    {
      token: await getOptionalEnvValue(SIDECAR_TOKEN_ENV),
      url: await getOptionalEnvValue(SIDECAR_URL_ENV),
      lighthouse: await getOptionalEnvValue(LIGHTHOUSE_ENV),
      concurrency: await getOptionalEnvValue("HANDBOOK_RENDER_CONCURRENCY"),
    },
    depth,
  );
  const runInput: RunInput = {
    runId: input.runId,
    origin: input.origin,
    mode: input.mode,
    tierOverride: input.tierOverride,
    registry: REGISTRY,
    collectors: createDefaultCollectors(
      { seedUrls: input.seedUrls, followLinks: true, ...scope },
      sidecar,
    ),
    checks: HANDBOOK_CHECKS,
    maxPages: scope.maxPages,
    excludePaths: scope.excludePaths,
    judge,
    mapper,
    budget,
    options,
    serp: options.serpOriginality ? await serpDeps(access, store, input) : null,
  };
  const runtime: HandbookRuntime = {
    projectId: input.projectId,
    fetch: createSafeFetch({
      allowedHosts: siblingHosts(new URL(input.origin).host),
    }),
    fetchOffsite: createSafeFetch({
      allowedHosts: "any",
      maxBytes: 256 * 1024,
    }),
    store,
    log,
  };
  const stageStore = createEvidenceStageStore(
    store,
    input.projectId,
    input.runId,
  );
  const ctx: StageContext = {
    tracker: HandbookStageRepository.forRun(input.runId),
    store: stageStore,
    startedAt: new Date(startedAt),
    maxMinutes: resolveRunMaxMinutes(
      await getOptionalEnvValue(RUN_MAX_MINUTES_ENV),
    ),
    sidecarProbe: () => probeSidecar(sidecar),
  };
  return { runInput, runtime, stageStore, ctx, llmCalls };
}

/** What the checks unit keeps for the report unit. */
type RunSummary = { tier: SiteTier; coverage: Coverage | null };

/** Batch count per stage, from the crawl unit's output. */
async function planRun(input: HandbookRunParams, startedAt: string) {
  const { stageStore } = await prepareStage(input, startedAt);
  return planBatches(await loadCollected(stageStore, planBatches({})));
}

/**
 * One `(stage, batch)` unit of a persisted run (ADR-018). `checks` writes
 * the result rows; `report` marks the run completed.
 */
async function runStage(
  input: HandbookRunParams & { startedAt: string },
  stage: StageName,
  batch: number,
  batches: Record<StageName, number>,
): Promise<UnitOutcome> {
  const { runInput, runtime, stageStore, ctx, llmCalls } = await prepareStage(
    input,
    input.startedAt,
  );
  const cctx = collectorContext(runInput, runtime);
  return runStageUnit(
    stage,
    batch,
    batches,
    {
      collect: (s, prior, b) =>
        collectRunUnit(runInput, runtime, cctx, { stage: s, batch: b }, prior),
      evaluate: async (collected) => {
        const result = await evaluateRun(runInput, runtime, collected);
        await HandbookRepository.saveRunResult(input.runId, result);
        await HandbookRepository.saveLlmCalls(input.runId, llmCalls);
        const pages = result.collected.pages;
        const summary: RunSummary = {
          tier: result.intake.tier,
          coverage: pages.status === "ok" ? (pages.coverage ?? null) : null,
        };
        await stageStore.save("report", batch, summary);
      },
      report: async () => {
        const summary = runSummarySchema.parse(
          await stageStore.load("report", batch),
        );
        const score = await scoreRun(input.projectId, input.runId);
        await HandbookRepository.finishRun({
          projectId: input.projectId,
          runId: input.runId,
          status: "completed",
          tier: summary.tier,
          coverage: summary.coverage ?? undefined,
          score: score ?? undefined,
        });
      },
    },
    ctx,
  );
}

const runSummarySchema = z.object({
  tier: siteTierSchema,
  coverage: z
    .object({
      discovered: z.number(),
      read: z.number(),
      capped: z.boolean(),
    })
    .nullable(),
});

async function failRun(input: HandbookRunParams, error: unknown) {
  await HandbookRepository.finishRun({
    projectId: input.projectId,
    runId: input.runId,
    status: "failed",
    errorCode: error instanceof Error ? error.message.slice(0, 120) : "unknown",
  });
}

export const HandbookRunService = {
  startRun,
  planRun,
  runStage,
  failRun,
} as const;
