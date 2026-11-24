import { sort } from "remeda";
import {
  type CollectedData,
  type Collector,
  type CollectorContext,
  type CollectorKey,
  type SafeFetch,
} from "@/server/features/handbook/contracts/collectors";
import type {
  CheckResult,
  EvidenceDraft,
  FindingDraft,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { Judge } from "@/server/features/handbook/contracts/llm";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import {
  ITEM_STATUS_PRECEDENCE,
  type HandbookMode,
  type ItemStatus,
  type SiteTier,
} from "@/server/features/handbook/contracts/status";
import { ITEM_SCORE } from "@/server/features/handbook/contracts/scoring";
import { pagesRead, type RunBudget } from "../llm/budget";
import { LlmBudgetError } from "../llm/judge";
import type { PageMapper } from "../llm/map";
import { collectRunUnit, stageFactMap, stageProfiles } from "./map-stage";
import { checkerReproduction } from "./checker-reproduction";
import {
  missingInput,
  scheduleChecks,
  type CheckOutcome,
} from "./check-schedule";
import { appliesWithSupp } from "../registry-supp";
import { runIntake, type Intake } from "./intake";
import { processVerdicts } from "./process-items";
import { evidenceKey, factMapEvidence, materialize } from "./evidence";
import { runCopyQuality } from "./copy-quality";
import { scaledContentEvidence } from "./scaled-summary";
import { applyScaledPrecedence } from "../checks/supp-scaled";
import {
  SERP_ORIGINALITY_CHECK_ID,
  supp18Summary,
} from "../checks/supp-serp-originality";
import type {
  CopyQuality,
  RunOptions,
  ScaledContent,
} from "../contracts/scaled-copy";
import { serpForRun, type SerpDeps } from "../llm/serp-originality-collect";
import { contractViolation } from "./contract-violation";
import { scopeS1ToIndexable } from "./s1-scope";
import {
  completeCollected,
  createMemoryStageStore,
  createMemoryStageTracker,
  resolveRunMaxMinutes,
  runStagedHandbook,
  type StageContext,
} from "./stages";

/**
 * Runtime-agnostic handbook run (ADR-001): collectors → intake → checks →
 * reconcile, in the stages of `./stages` (ADR-018). The workflow adapter and the CLI both call `runHandbook`; it
 * never touches the DB. Runner-enforced K1 invariants live here so checks
 * cannot record a finding or a PASS without evidence.
 */
export type HandbookRuntime = {
  projectId: string;
  fetch: SafeFetch;
  fetchOffsite: SafeFetch;
  store: EvidenceStore;
  log: CollectorContext["log"];
};

export type RunInput = {
  runId: string;
  origin: string;
  mode: HandbookMode;
  tierOverride?: SiteTier | null;
  registry: readonly RegistryEntry[];
  /** In dependency order; missing keys become `unavailable`. */
  collectors: readonly Collector<CollectorKey>[];
  checks: readonly HandbookCheck[];
  maxPages: number;
  /** Sections left out of the run (audit `excludePaths`, WO-B18-015). */
  excludePaths?: readonly string[];
  /** K5 judge; absent (no OpenRouter access) → LLM items BLOCKED `no llm key`. */
  judge?: Judge | null;
  /** Map-stage extractor (ADR-019); absent → no PageProfiles (checks read `pageProfiles` undefined). */
  mapper?: PageMapper | null;
  /** Run LLM budget; the engine sets its page count before the map stage and the checks. */
  budget?: RunBudget | null;
  /** Per-run options (SCALED-COPY §6); absent = off. */
  options?: Partial<RunOptions>;
  /** SUPP-18 lookups, queries, competitor profiles (ADR-024); absent → BLOCKED `dataforseo credit`. */
  serp?: SerpDeps | null;
};

export type EvidenceRow = {
  id: string;
  findingCode: string | null;
  itemId: string;
  kind: EvidenceDraft["kind"];
  url: string;
  storageKey: string | null;
  excerpt: string;
  sha256: string;
  byteSize: number;
  contentType: string | null;
};

export type ItemStatusRow = {
  itemId: string;
  status: ItemStatus;
  score: number | null;
  note: string | null;
  checkIds: string[];
};

export type PendingResult = {
  checkId: string;
  checkClass: HandbookCheck["class"];
  result: CheckResult;
};

export type FindingRow = Omit<FindingDraft, "evidenceRefs"> & {
  code: string;
  checkId: string;
  class: HandbookCheck["class"];
  phase: string;
  sectionRef: string;
};

export type RunResult = {
  intake: Intake;
  collected: CollectedData;
  statuses: ItemStatusRow[];
  findings: FindingRow[];
  evidence: EvidenceRow[];
  checkerErrors: string[];
  /** Map-stage profiles the checks read; feeds "Answer-engine readiness". */
  pageProfiles?: readonly PageProfile[];
  /** Copy quality section (ADR-023); only when the option is on. */
  copyQuality?: CopyQuality;
  /** SUPP-18 counts for the scaled-content summary; only when the option is on. */
  supp18?: ScaledContent["supp18"];
};

/**
 * In-process staged run (FULL-READ §7.6): the CLI, outcome reruns and tests
 * go through the same `(stage, batch)` units as the workflow, with memory
 * state. `staging` overrides the tracker / store / clock (tests, resume).
 */
export async function runHandbook(
  input: RunInput,
  runtime: HandbookRuntime,
  staging?: Partial<StageContext>,
): Promise<RunResult> {
  const out: { result?: RunResult } = {};
  const ctx = collectorContext(input, runtime);
  await runStagedHandbook(
    {
      collect: (stage, prior, batch) =>
        collectRunUnit(input, runtime, ctx, { stage, batch }, prior),
      evaluate: async (collected) => {
        out.result = await evaluateRun(input, runtime, collected);
      },
      report: async () => {},
    },
    {
      tracker: createMemoryStageTracker(),
      store: createMemoryStageStore(),
      startedAt: new Date(),
      maxMinutes: resolveRunMaxMinutes(undefined),
      ...staging,
    },
  );
  if (!out.result) throw new Error("handbook run: checks stage did not run");
  return out.result;
}

/** Intake → checks → reconcile → evidence over everything collected (stage `checks`). SUPP rules (ADR-020) apply on every site and get no status row. */
export async function evaluateRun(
  input: RunInput,
  runtime: HandbookRuntime,
  partial: Partial<CollectedData>,
  /** Checks done of total, before each check and once at the end (WO-B20-006). */
  onCheck: (done: number, total: number) => void = () => {},
): Promise<RunResult> {
  const collected = completeCollected(partial);
  input.budget?.setPages(pagesRead(collected));
  const pageProfiles = stageProfiles(partial);
  const siteFactMap = stageFactMap(partial, collected, pageProfiles);
  const intake = runIntake({
    collected,
    registry: input.registry,
    mode: input.mode,
    tierOverride: input.tierOverride,
    maxPages: input.maxPages,
  });
  const registryById = new Map(input.registry.map((e) => [e.id, e]));
  const verdicts = new Map<
    string,
    { status: ItemStatus; note: string | null; checkId: string }[]
  >();
  const pending: PendingResult[] = [];
  const checkerErrors: string[] = [];
  const addVerdict = (
    itemId: string,
    status: ItemStatus,
    note: string | null,
    checkId: string,
  ) => {
    const list = verdicts.get(itemId) ?? [];
    list.push({ status, note, checkId });
    verdicts.set(itemId, list);
  };

  const serp = await serpForRun(input, runtime, collected, pageProfiles);

  const applies = appliesWithSupp(intake.applicable);
  let llmBlocked: string | null = input.judge ? null : "no llm key";
  // WO-B19-009: per-check wall time, logged once (slowest first).
  const checkMs: Array<[string, number]> = [];
  const evaluate = async (check: HandbookCheck): Promise<CheckOutcome> => {
    if (check.class === "LLM" && llmBlocked)
      return { kind: "verdict", status: "BLOCKED", note: llmBlocked };
    const missing = missingInput(check, collected);
    if (missing) return missing;
    const ctx = {
      runId: input.runId,
      origin: input.origin,
      mode: input.mode,
      tier: intake.tier,
      siteProfile: intake.siteProfile,
      applicableItems: intake.applicable,
      collected,
      ...(pageProfiles ? { pageProfiles } : {}),
      ...(siteFactMap ? { siteFactMap } : {}),
      ...(serp ? { serpOriginality: serp } : {}),
      ...(check.class === "LLM" && input.judge ? { judge: input.judge } : {}),
      fetchOffsite: cappedFetch(runtime.fetchOffsite, CHECK_OFFSITE_FETCHES),
    };
    if (check.appliesTo && !check.appliesTo(ctx))
      return {
        kind: "verdict",
        status: "NA",
        note: "check does not apply to this site",
      };
    const startedAt = Date.now();
    try {
      const result = await check.run(ctx);
      checkMs.push([check.id, Date.now() - startedAt]);
      return { kind: "result", result };
    } catch (error) {
      if (error instanceof LlmBudgetError) {
        // ADR-019: stop LLM checks at the cap or a 402; no later one starts.
        llmBlocked = error.note;
        return { kind: "verdict", status: "BLOCKED", note: llmBlocked };
      }
      const code =
        error instanceof Error ? error.message.slice(0, 120) : "unknown";
      return { kind: "error", code };
    }
  };

  const outcomes = await scheduleChecks(
    input.checks,
    applies,
    evaluate,
    onCheck,
  );
  for (const [index, check] of input.checks.entries()) {
    const outcome = outcomes[index];
    if (!outcome) continue;
    const items = check.itemIds.filter(applies);
    if (outcome.kind === "verdict") {
      for (const id of items)
        addVerdict(id, outcome.status, outcome.note, check.id);
      continue;
    }
    if (outcome.kind === "error") {
      checkerErrors.push(`${check.id}: ${outcome.code}`);
      for (const id of items)
        addVerdict(id, "BLOCKED", `check error: ${outcome.code}`, check.id);
      continue;
    }
    const { result } = outcome;
    const violation = contractViolation(check, result, registryById);
    if (violation) {
      checkerErrors.push(`${check.id}: ${violation}`);
      for (const id of items)
        addVerdict(
          id,
          "BLOCKED",
          `check contract violation: ${violation}`,
          check.id,
        );
      continue;
    }
    for (const v of result.statuses) {
      if (applies(v.itemId))
        addVerdict(v.itemId, v.status, v.note ?? null, check.id);
    }
    // Findings on an item the site does not need (NA at intake) are dropped.
    pending.push({
      checkId: check.id,
      checkClass: check.class,
      result: {
        ...result,
        findings: result.findings.filter((f) => f.itemIds.some(applies)),
      },
    });
  }
  runtime.log("handbook.checks.timing", {
    totalMs: checkMs.reduce((sum, [, ms]) => sum + ms, 0),
    slowest: sort(checkMs, (a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, ms]) => `${id} ${ms}ms`),
  });

  if (intake.applicable.has("P1-04")) {
    const verdict = checkerReproduction(collected, pending, checkerErrors);
    addVerdict(
      "P1-04",
      verdict.status,
      verdict.note,
      "runner.checker-reproduction",
    );
  }

  const statuses = processVerdicts(
    reconcile(input.registry, intake, verdicts),
    pending,
    intake,
  );
  const { findings, evidence } = await materialize(
    input,
    runtime,
    scopeS1ToIndexable(applyScaledPrecedence(pending), collected),
    registryById,
  );
  if (siteFactMap)
    evidence.push(await factMapEvidence(input, runtime, siteFactMap));
  const copy = input.options?.copyQuality
    ? await runCopyQuality(input, runtime, collected, pageProfiles)
    : null;
  if (copy) evidence.push(copy.evidence);
  const supp18 = supp18Summary(
    pending.find((p) => p.checkId === SERP_ORIGINALITY_CHECK_ID)?.result,
  );
  evidence.push(
    await scaledContentEvidence(input, runtime, collected, findings, supp18),
  );
  return {
    intake,
    collected,
    statuses,
    findings,
    evidence,
    checkerErrors,
    ...(pageProfiles ? { pageProfiles } : {}),
    ...(copy ? { copyQuality: copy.section } : {}),
    ...(supp18 ? { supp18 } : {}),
  };
}

/** Off-site fetches one check may make (P5-03 reads a few cited sources). */
const CHECK_OFFSITE_FETCHES = 10;

/** A SafeFetch that throws after `limit` calls (contracts 1.3.0). */
function cappedFetch(fetch: SafeFetch, limit: number): SafeFetch {
  let used = 0;
  return async (...args) => {
    if (++used > limit)
      throw new Error(`off-site fetch limit (${limit}) reached for this check`);
    return fetch(...args);
  };
}

/** What collectors get for one run (K2): fetchers, log, body storage. */
export function collectorContext(
  input: RunInput,
  runtime: HandbookRuntime,
): CollectorContext {
  return {
    runId: input.runId,
    origin: input.origin,
    fetch: runtime.fetch,
    fetchOffsite: runtime.fetchOffsite,
    log: runtime.log,
    storeBody: async (kind, url, bytes, contentType) => {
      const key = await evidenceKey({
        projectId: runtime.projectId,
        runId: input.runId,
        kind,
        url,
        bytes,
        contentType,
      });
      return (await runtime.store.put(key, bytes, contentType)).key;
    },
  };
}

function reconcile(
  registry: readonly RegistryEntry[],
  intake: Intake,
  verdicts: Map<
    string,
    { status: ItemStatus; note: string | null; checkId: string }[]
  >,
): ItemStatusRow[] {
  const excluded = new Map(intake.excluded.map((e) => [e.itemId, e]));
  return registry.map((item) => {
    const skip = excluded.get(item.id);
    if (skip) return row(item.id, skip.status, skip.note, []);
    const list = verdicts.get(item.id);
    if (!list || list.length === 0) {
      return row(item.id, "DEFERRED", "no automated check yet", []);
    }
    const winner = sort(
      list,
      (a, b) =>
        ITEM_STATUS_PRECEDENCE.indexOf(a.status) -
        ITEM_STATUS_PRECEDENCE.indexOf(b.status),
    )[0];
    return row(
      item.id,
      winner?.status ?? "DEFERRED",
      winner?.note ?? null,
      list.map((v) => v.checkId),
    );
  });
}

function row(
  itemId: string,
  status: ItemStatus,
  note: string | null,
  checkIds: string[],
): ItemStatusRow {
  return { itemId, status, score: ITEM_SCORE[status], note, checkIds };
}
