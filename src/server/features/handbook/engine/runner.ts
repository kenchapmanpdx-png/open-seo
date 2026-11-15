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
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import {
  ITEM_STATUS_PRECEDENCE,
  type HandbookMode,
  type ItemStatus,
  type SiteTier,
} from "@/server/features/handbook/contracts/status";
import { ITEM_SCORE } from "@/server/features/handbook/contracts/scoring";
import { runIntake, type Intake } from "./intake";
import { evidenceKey, materialize } from "./evidence";

/**
 * Runtime-agnostic handbook run (ADR-001): collectors → intake → checks →
 * reconcile. The workflow adapter and the CLI both call `runHandbook`; it
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

export async function runHandbook(
  input: RunInput,
  runtime: HandbookRuntime,
): Promise<RunResult> {
  const collected = await runCollectors(input, runtime);
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

  for (const check of input.checks) {
    const items = check.itemIds.filter((id) => intake.applicable.has(id));
    if (items.length === 0) continue;
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
      if (intake.applicable.has(v.itemId))
        addVerdict(v.itemId, v.status, v.note ?? null, check.id);
    }
    // Findings on an item the site does not need (NA at intake) are dropped.
    pending.push({
      checkId: check.id,
      checkClass: check.class,
      result: {
        ...result,
        findings: result.findings.filter((f) =>
          f.itemIds.some((id) => intake.applicable.has(id)),
        ),
      },
    });
  }

  const statuses = reconcile(input.registry, intake, verdicts);
  const { findings, evidence } = await materialize(
    input,
    runtime,
    pending,
    registryById,
  );
  return { intake, collected, statuses, findings, evidence, checkerErrors };
}

async function runCollectors(
  input: RunInput,
  runtime: HandbookRuntime,
): Promise<CollectedData> {
  const collected: Partial<CollectedData> = {};
  const ctx: CollectorContext = {
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
  for (const collector of input.collectors) {
    try {
      const value = await collector.collect(ctx, collected);
      Object.assign(collected, { [collector.key]: value });
    } catch (error) {
      runtime.log("handbook.collector.error", {
        key: collector.key,
        error: String(error),
      });
      Object.assign(collected, {
        [collector.key]: {
          status: "unavailable",
          reason: `collector error: ${String(error).slice(0, 200)}`,
        },
      });
    }
  }
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
    const primary = registry.get(f.itemIds[0] ?? "");
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
