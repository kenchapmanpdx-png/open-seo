import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import { executeInBatches } from "@/db/runBatch";
import { auditPages } from "@/db/schema";
import {
  handbookBotFetches,
  handbookEvidence,
  handbookFindingItems,
  handbookFindings,
  handbookFindingUrls,
  handbookItemStatuses,
  handbookLlmCalls,
  handbookPageSnapshots,
  handbookProjectSettings,
  handbookRuns,
  handbookSiteProfiles,
  handbookTemplates,
  handbookTemplateSamples,
} from "@/db/handbook-tables";
import { sha256Hex } from "@/server/lib/audit/ids";
import type {
  HandbookMode,
  RunStatus,
  SiteTier,
} from "@/server/features/handbook/contracts/status";
import type { RunResult } from "@/server/features/handbook/engine/runner";
import type { Coverage } from "@/server/features/handbook/contracts/collectors";
import type { HandbookDepth } from "@/server/features/handbook/contracts/exports";
import type { LlmCallLog } from "@/server/features/handbook/llm/judge";

/**
 * Handbook persistence (ADR-002). Every caller-keyed read filters by
 * `project_id` through `handbook_run`. Writes use deterministic ids +
 * `onConflictDoNothing`, so a retried Workflow step completes a partial
 * write instead of duplicating it.
 */
export type HandbookRun = typeof handbookRuns.$inferSelect;
export type HandbookProjectSetting =
  typeof handbookProjectSettings.$inferSelect;

/** sha256(runId | natural key) → 26 chars (ADR-002). */
async function rowId(runId: string, ...key: string[]) {
  return (await sha256Hex([runId, ...key].join("|"))).slice(0, 26);
}

async function getProjectSetting(
  projectId: string,
): Promise<HandbookProjectSetting | null> {
  const rows = await db
    .select()
    .from(handbookProjectSettings)
    .where(eq(handbookProjectSettings.projectId, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertProjectSetting(input: {
  projectId: string;
  enabled: boolean;
  mode: HandbookMode;
  tierOverride: SiteTier | null;
  copyQuality: boolean;
  serpOriginality: boolean;
}) {
  const updatedAt = new Date().toISOString();
  await db
    .insert(handbookProjectSettings)
    .values({ ...input, updatedAt })
    .onConflictDoUpdate({
      target: handbookProjectSettings.projectId,
      set: {
        enabled: input.enabled,
        mode: input.mode,
        tierOverride: input.tierOverride,
        copyQuality: input.copyQuality,
        serpOriginality: input.serpOriginality,
        updatedAt,
      },
    });
}

async function createRun(input: {
  id: string;
  projectId: string;
  organizationId: string;
  auditId: string | null;
  origin: string;
  handbookVersion: string;
  contractsVersion: string;
  mode: HandbookMode;
  /** Absent = DB default `quick` (outcome reruns). */
  depth?: HandbookDepth;
}) {
  await db
    .insert(handbookRuns)
    .values({ ...input, status: "running" })
    .onConflictDoNothing();
}

async function finishRun(input: {
  projectId: string;
  runId: string;
  status: RunStatus;
  tier?: SiteTier | null;
  errorCode?: string | null;
  coverage?: Coverage;
}) {
  await db
    .update(handbookRuns)
    .set({
      status: input.status,
      tier: input.tier ?? null,
      errorCode: input.errorCode ?? null,
      ...(input.coverage
        ? {
            coverageDiscovered: input.coverage.discovered,
            coverageRead: input.coverage.read,
            coverageCapped: input.coverage.capped,
          }
        : {}),
      finishedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(handbookRuns.id, input.runId),
        eq(handbookRuns.projectId, input.projectId),
      ),
    );
}

async function listRuns(projectId: string, limit = 20) {
  return db
    .select({
      ...getTableColumns(handbookRuns),
      findingsCount:
        sql<number>`(select count(*) from ${handbookFindings} where ${handbookFindings.runId} = ${handbookRuns.id})`.mapWith(
          Number,
        ),
    })
    .from(handbookRuns)
    .where(eq(handbookRuns.projectId, projectId))
    .orderBy(desc(handbookRuns.startedAt))
    .limit(limit);
}

async function getRun(projectId: string, runId: string) {
  const rows = await db
    .select()
    .from(handbookRuns)
    .where(
      and(eq(handbookRuns.id, runId), eq(handbookRuns.projectId, projectId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function listItemStatuses(projectId: string, runId: string) {
  return db
    .select({
      itemId: handbookItemStatuses.itemId,
      status: handbookItemStatuses.status,
      score: handbookItemStatuses.score,
      note: handbookItemStatuses.note,
    })
    .from(handbookItemStatuses)
    .innerJoin(handbookRuns, eq(handbookRuns.id, handbookItemStatuses.runId))
    .where(
      and(
        eq(handbookItemStatuses.runId, runId),
        eq(handbookRuns.projectId, projectId),
      ),
    );
}

const evidenceColumns = {
  id: handbookEvidence.id,
  findingId: handbookEvidence.findingId,
  itemId: handbookEvidence.itemId,
  kind: handbookEvidence.kind,
  url: handbookEvidence.url,
  storageKey: handbookEvidence.storageKey,
  excerpt: handbookEvidence.excerpt,
  byteSize: handbookEvidence.byteSize,
  contentType: handbookEvidence.contentType,
};

/** A run's evidence excerpts (bodies stay in the evidence store). */
async function listEvidence(projectId: string, runId: string, limit = 500) {
  return db
    .select(evidenceColumns)
    .from(handbookEvidence)
    .innerJoin(handbookRuns, eq(handbookRuns.id, handbookEvidence.runId))
    .where(
      and(
        eq(handbookEvidence.runId, runId),
        eq(handbookRuns.projectId, projectId),
      ),
    )
    .orderBy(handbookEvidence.itemId, handbookEvidence.url)
    .limit(limit);
}

/** One evidence row, only when its run belongs to `projectId`. */
async function getEvidence(projectId: string, evidenceId: string) {
  const rows = await db
    .select(evidenceColumns)
    .from(handbookEvidence)
    .innerJoin(handbookRuns, eq(handbookRuns.id, handbookEvidence.runId))
    .where(
      and(
        eq(handbookEvidence.id, evidenceId),
        eq(handbookRuns.projectId, projectId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** URLs the upstream crawl fetched with 200 (workflow seed list, ADR-001). */
async function listCrawledUrls(auditId: string) {
  const rows = await db
    .select({ url: auditPages.url })
    .from(auditPages)
    .where(
      and(eq(auditPages.auditId, auditId), eq(auditPages.statusCode, 200)),
    );
  return rows.map((r) => r.url);
}

/** Persist one run's engine output (idempotent). */
async function saveRunResult(runId: string, result: RunResult) {
  const { intake, collected } = result;
  await executeInBatches(intake.siteProfile, (tx, sp) =>
    tx
      .insert(handbookSiteProfiles)
      .values({
        runId,
        spCode: sp.code,
        value: sp.value,
        evidence: sp.evidence,
        confidence: sp.confidence,
      })
      .onConflictDoNothing(),
  );

  const templates =
    collected.templates.status === "ok" ? collected.templates.templates : [];
  const templateIds = new Map<string, string>();
  for (const t of templates)
    templateIds.set(t.key, await rowId(runId, "template", t.key));
  await executeInBatches([...templates], (tx, t) =>
    tx
      .insert(handbookTemplates)
      .values({
        id: templateIds.get(t.key) ?? "",
        runId,
        templateKey: t.key,
        urlPattern: t.urlPattern,
        skeletonHash: t.skeletonHash,
        pageCount: t.urls.length,
      })
      .onConflictDoNothing(),
  );
  const samples = templates.flatMap((t) =>
    t.samples.map((s) => ({ templateId: templateIds.get(t.key) ?? "", ...s })),
  );
  await executeInBatches(samples, (tx, s) =>
    tx.insert(handbookTemplateSamples).values(s).onConflictDoNothing(),
  );

  const templateOf = new Map(
    templates.flatMap((t) =>
      t.urls.map((u) => [u, templateIds.get(t.key) ?? null] as const),
    ),
  );
  const snapshots =
    collected.pages.status === "ok" ? collected.pages.snapshots : [];
  const snapshotRows = await Promise.all(
    snapshots.map(async (s) => ({
      id: await rowId(runId, "page", s.url),
      runId,
      url: s.url,
      finalUrl: s.finalUrl,
      templateId: templateOf.get(s.url) ?? null,
      status: s.status,
      contentType: s.contentType,
      rawKey: s.rawKey,
      wordsRaw: s.wordsRaw,
    })),
  );
  await executeInBatches(snapshotRows, (tx, row) =>
    tx.insert(handbookPageSnapshots).values(row).onConflictDoNothing(),
  );

  await executeInBatches(result.statuses, (tx, s) =>
    tx
      .insert(handbookItemStatuses)
      .values({
        runId,
        itemId: s.itemId,
        status: s.status,
        score: s.score,
        note: s.note,
      })
      .onConflictDoNothing(),
  );

  await saveFindings(runId, result);

  const fetches =
    collected.botFetch.status === "ok" ? collected.botFetch.fetches : [];
  const fetchRows = await Promise.all(
    fetches.map(async (f) => ({
      id: await rowId(runId, "bot", f.url, f.bot),
      runId,
      ...f,
    })),
  );
  await executeInBatches(fetchRows, (tx, row) =>
    tx.insert(handbookBotFetches).values(row).onConflictDoNothing(),
  );
}

async function saveFindings(runId: string, result: RunResult) {
  const findingIds = new Map<string, string>();
  for (const f of result.findings)
    findingIds.set(f.code, await rowId(runId, "finding", f.code));
  const id = (code: string) => findingIds.get(code) ?? "";
  await executeInBatches(result.findings, (tx, f) =>
    tx
      .insert(handbookFindings)
      .values({
        id: id(f.code),
        runId,
        code: f.code,
        phase: f.phase,
        sectionRef: f.sectionRef,
        severity: f.severity,
        severityReason: f.severityReason ?? null,
        class: f.class,
        title: f.title,
        detail: f.detail,
        fix: f.fix,
        fixability: f.fixability,
        limitedReason: f.limitedReason ?? null,
        effort: f.effort,
        templateKey: f.templateKey ?? null,
        source: f.source,
      })
      .onConflictDoNothing(),
  );
  const items = result.findings.flatMap((f) =>
    [...new Set(f.itemIds)].map((itemId) => ({
      findingId: id(f.code),
      itemId,
    })),
  );
  await executeInBatches(items, (tx, row) =>
    tx.insert(handbookFindingItems).values(row).onConflictDoNothing(),
  );
  const urls = result.findings.flatMap((f) =>
    [...new Set(f.urls)].map((url) => ({ findingId: id(f.code), url })),
  );
  await executeInBatches(urls, (tx, row) =>
    tx.insert(handbookFindingUrls).values(row).onConflictDoNothing(),
  );
  await executeInBatches(result.evidence, (tx, e) =>
    tx
      .insert(handbookEvidence)
      .values({
        id: e.id,
        runId,
        findingId: e.findingCode ? id(e.findingCode) : null,
        itemId: e.itemId,
        kind: e.kind,
        url: e.url,
        storageKey: e.storageKey,
        excerpt: e.excerpt,
        sha256: e.sha256,
        byteSize: e.byteSize,
        contentType: e.contentType,
      })
      .onConflictDoNothing(),
  );
}

/** K5 call log (ADR-007) + the run's total LLM cost (idempotent). */
async function saveLlmCalls(runId: string, calls: readonly LlmCallLog[]) {
  const rows = await Promise.all(
    calls.map(async (c, i) => ({
      id: await rowId(runId, "llm", String(i)),
      runId,
      ...c,
    })),
  );
  await executeInBatches(rows, (tx, row) =>
    tx.insert(handbookLlmCalls).values(row).onConflictDoNothing(),
  );
  await db
    .update(handbookRuns)
    .set({ llmCostUsd: calls.reduce((sum, c) => sum + c.costUsd, 0) })
    .where(eq(handbookRuns.id, runId));
}

export const HandbookRepository = {
  getProjectSetting,
  upsertProjectSetting,
  createRun,
  finishRun,
  listRuns,
  getRun,
  listItemStatuses,
  listEvidence,
  getEvidence,
  listCrawledUrls,
  saveRunResult,
  saveLlmCalls,
} as const;
