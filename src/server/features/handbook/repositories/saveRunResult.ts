import {
  handbookBotFetches,
  handbookEvidence,
  handbookFindingItems,
  handbookFindings,
  handbookFindingUrls,
  handbookItemStatuses,
  handbookPageSnapshots,
  handbookSiteProfiles,
  handbookTemplates,
  handbookTemplateSamples,
} from "@/db/handbook-tables";
import { sha256Hex } from "@/server/lib/audit/ids";
import type { RunResult } from "@/server/features/handbook/engine/runner";
import { insertAll, insertRows } from "./insertMany";

/** sha256(runId | natural key) → 26 chars (ADR-002). */
export async function rowId(runId: string, ...key: string[]) {
  return (await sha256Hex([runId, ...key].join("|"))).slice(0, 26);
}

/**
 * Persist one run's engine output (idempotent). Every table's rows are built
 * first and written in one `insertAll` call (WO-B20-004): one transaction on
 * Postgres instead of one per table plus one statement per bot fetch.
 */
export async function saveRunResult(runId: string, result: RunResult) {
  const { intake, collected } = result;
  const siteProfiles = insertRows(
    intake.siteProfile.map((sp) => ({
      runId,
      spCode: sp.code,
      value: sp.value,
      evidence: sp.evidence,
      confidence: sp.confidence,
    })),
    (tx, rows) =>
      tx.insert(handbookSiteProfiles).values(rows).onConflictDoNothing(),
  );

  const templates =
    collected.templates.status === "ok" ? collected.templates.templates : [];
  const templateIds = new Map<string, string>();
  for (const t of templates)
    templateIds.set(t.key, await rowId(runId, "template", t.key));
  const templateRows = insertRows(
    templates.map((t) => ({
      id: templateIds.get(t.key) ?? "",
      runId,
      templateKey: t.key,
      urlPattern: t.urlPattern,
      skeletonHash: t.skeletonHash,
      pageCount: t.urls.length,
    })),
    (tx, rows) =>
      tx.insert(handbookTemplates).values(rows).onConflictDoNothing(),
  );
  const samples = insertRows(
    templates.flatMap((t) =>
      t.samples.map((s) => ({
        templateId: templateIds.get(t.key) ?? "",
        ...s,
      })),
    ),
    (tx, rows) =>
      tx.insert(handbookTemplateSamples).values(rows).onConflictDoNothing(),
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
  const pageRows = insertRows(snapshotRows, (tx, rows) =>
    tx.insert(handbookPageSnapshots).values(rows).onConflictDoNothing(),
  );

  const statuses = insertRows(
    result.statuses.map((s) => ({
      runId,
      itemId: s.itemId,
      status: s.status,
      score: s.score,
      note: s.note,
    })),
    (tx, rows) =>
      tx.insert(handbookItemStatuses).values(rows).onConflictDoNothing(),
  );

  const fetches =
    collected.botFetch.status === "ok" ? collected.botFetch.fetches : [];
  const fetchRows = await Promise.all(
    fetches.map(async (f) => ({
      id: await rowId(runId, "bot", f.url, f.bot),
      runId,
      ...f,
    })),
  );
  const botFetches = insertRows(fetchRows, (tx, rows) =>
    tx.insert(handbookBotFetches).values(rows).onConflictDoNothing(),
  );

  return insertAll([
    ...siteProfiles,
    ...templateRows,
    ...samples,
    ...pageRows,
    ...statuses,
    ...(await findingStatements(runId, result)),
    ...botFetches,
  ]);
}

async function findingStatements(runId: string, result: RunResult) {
  const findingIds = new Map<string, string>();
  for (const f of result.findings)
    findingIds.set(f.code, await rowId(runId, "finding", f.code));
  const id = (code: string) => findingIds.get(code) ?? "";
  const findings = insertRows(
    result.findings.map((f) => ({
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
    })),
    (tx, rows) =>
      tx.insert(handbookFindings).values(rows).onConflictDoNothing(),
  );
  const items = insertRows(
    result.findings.flatMap((f) =>
      [...new Set(f.itemIds)].map((itemId) => ({
        findingId: id(f.code),
        itemId,
      })),
    ),
    (tx, rows) =>
      tx.insert(handbookFindingItems).values(rows).onConflictDoNothing(),
  );
  const urls = insertRows(
    result.findings.flatMap((f) =>
      [...new Set(f.urls)].map((url) => ({ findingId: id(f.code), url })),
    ),
    (tx, rows) =>
      tx.insert(handbookFindingUrls).values(rows).onConflictDoNothing(),
  );
  const evidence = insertRows(
    result.evidence.map((e) => ({
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
    })),
    (tx, rows) =>
      tx.insert(handbookEvidence).values(rows).onConflictDoNothing(),
  );
  return [...findings, ...items, ...urls, ...evidence];
}
