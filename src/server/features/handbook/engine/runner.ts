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
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import {
  ITEM_STATUS_PRECEDENCE,
  type HandbookMode,
  type ItemStatus,
  type SiteTier,
} from "@/server/features/handbook/contracts/status";
import { ITEM_SCORE } from "@/server/features/handbook/contracts/scoring";
import { normalizeUrl } from "../checks/support";
import { LlmBudgetError } from "../llm/judge";
import { appliesWithSupp, SUPP_BY_ID } from "../registry-supp";
import { runIntake, type Intake } from "./intake";
import { processVerdicts } from "./process-items";
import { evidenceKey, materialize } from "./evidence";
import {
  completeCollected,
  createMemoryStageStore,
  createMemoryStageTracker,
  resolveRunMaxMinutes,
  runStagedHandbook,
  type StageContext,
} from "./stages";
import { collectRunStage } from "./render-pass";

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
  /** K5 judge; absent (no OpenRouter access) → LLM items BLOCKED `no llm key`. */
  judge?: Judge | null;
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
      collect: (stage, prior) => collectRunStage(input, ctx, stage, prior),
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
): Promise<RunResult> {
  const collected = completeCollected(partial);
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

  const applies = appliesWithSupp(intake.applicable);
  let llmBlocked: string | null = input.judge ? null : "no llm key";
  for (const check of input.checks) {
    const items = check.itemIds.filter(applies);
    if (items.length === 0) continue;
    if (check.class === "LLM" && llmBlocked) {
      for (const id of items) addVerdict(id, "BLOCKED", llmBlocked, check.id);
      continue;
    }
    const missing = check.requires.find(
      (key) => collected[key]?.status !== "ok",
    );
    if (missing) {
      const value = collected[missing];
      const reason =
        value && value.status === "unavailable"
          ? value.reason
          : "not collected";
      for (const id of items)
        addVerdict(
          id,
          "BLOCKED",
          `${missing} unavailable: ${reason}`,
          check.id,
        );
      continue;
    }
    const ctx = {
      runId: input.runId,
      origin: input.origin,
      mode: input.mode,
      tier: intake.tier,
      siteProfile: intake.siteProfile,
      applicableItems: intake.applicable,
      collected,
      ...(check.class === "LLM" && input.judge ? { judge: input.judge } : {}),
      fetchOffsite: cappedFetch(runtime.fetchOffsite, CHECK_OFFSITE_FETCHES),
    };
    if (check.appliesTo && !check.appliesTo(ctx)) {
      for (const id of items)
        addVerdict(id, "NA", "check does not apply to this site", check.id);
      continue;
    }
    let result: CheckResult;
    try {
      result = await check.run(ctx);
    } catch (error) {
      if (error instanceof LlmBudgetError) {
        // ADR-007: stop LLM checks at the cap; the rest are BLOCKED too.
        llmBlocked = "llm budget";
        for (const id of items) addVerdict(id, "BLOCKED", llmBlocked, check.id);
        continue;
      }
      const code =
        error instanceof Error ? error.message.slice(0, 120) : "unknown";
      checkerErrors.push(`${check.id}: ${code}`);
      for (const id of items)
        addVerdict(id, "BLOCKED", `check error: ${code}`, check.id);
      continue;
    }
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
    pending,
    registryById,
  );
  return { intake, collected, statuses, findings, evidence, checkerErrors };
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

function contractViolation(
  check: HandbookCheck,
  result: CheckResult,
  registry: ReadonlyMap<string, RegistryEntry>,
): string | null {
  const refs = new Set(result.evidence.map((e) => e.ref));
  const owned = new Set(check.itemIds);
  for (const v of result.statuses) {
    if (!owned.has(v.itemId)) return `verdict for foreign item ${v.itemId}`;
    if (v.status === "PASS" && !v.evidenceRefs.some((r) => refs.has(r))) {
      return `PASS on ${v.itemId} without evidence`;
    }
  }
  for (const f of result.findings) {
    if (f.itemIds.length === 0 || f.itemIds.some((id) => !owned.has(id))) {
      return `finding "${f.title}" cites items outside the check`;
    }
    if (!f.evidenceRefs.some((r) => refs.has(r)))
      return `finding "${f.title}" without evidence`;
    const id = f.itemIds[0] ?? "";
    const primary = registry.get(id) ?? SUPP_BY_ID.get(id);
    if (
      primary &&
      f.severity !== primary.severityDefault &&
      !f.severityReason
    ) {
      return `finding "${f.title}" changes severity without a reason`;
    }
    if (f.fixability === "LIMITED" && !f.limitedReason) {
      return `LIMITED finding "${f.title}" without limitedReason`;
    }
  }
  return null;
}

/** Evidence that comes from a third-party checker rather than a direct fetch. */
const CHECKER_KINDS = new Set<EvidenceDraft["kind"]>([
  "lighthouse",
  "axe",
  "crux",
]);

/**
 * P1-04 (handbook §0 "Checkers are evidence, not findings"): every finding
 * that rests only on checker output (Lighthouse, axe, CrUX) must cite URLs the
 * crawler fetched directly; collector and check errors are logged in
 * `checkerErrors` and listed in the report.
 */
function checkerReproduction(
  collected: CollectedData,
  pending: readonly PendingResult[],
  checkerErrors: readonly string[],
): { status: ItemStatus; note: string } {
  const pages = collected.pages;
  if (pages.status !== "ok")
    return { status: "BLOCKED", note: "pages unavailable: no direct fetches" };
  const fetched = new Set(pages.snapshots.map((s) => normalizeUrl(s.url)));
  let checkerOnly = 0;
  const unreproduced = new Set<string>();
  for (const { result } of pending) {
    const kindOf = new Map(result.evidence.map((e) => [e.ref, e.kind]));
    for (const finding of result.findings) {
      const kinds = finding.evidenceRefs.map((ref) => kindOf.get(ref));
      if (kinds.length === 0 || !kinds.every((k) => k && CHECKER_KINDS.has(k)))
        continue;
      checkerOnly += 1;
      for (const url of finding.urls)
        if (!fetched.has(normalizeUrl(url))) unreproduced.add(url);
    }
  }
  const errors = `${checkerErrors.length} checker error(s) logged`;
  if (unreproduced.size > 0)
    return {
      status: "OPEN",
      note: `checker-only findings cite URLs never fetched directly: ${[...unreproduced].slice(0, 5).join(", ")}; ${errors}`,
    };
  return {
    status: "PASS",
    note: `${checkerOnly} checker-only finding(s), every URL also fetched directly; ${errors}`,
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
