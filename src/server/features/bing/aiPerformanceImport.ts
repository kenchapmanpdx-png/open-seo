import { and, eq, sql } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import {
  bingAiCitationDays,
  bingAiGroundingQueries,
  bingAiImports,
  bingSites,
} from "@/db/integrations-tables";
import { runBatch } from "@/db/runBatch";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import { sha256Hex } from "@/server/lib/audit/ids";
import {
  parseAiPerformanceCsv,
  splitAiRows,
  type AiCitationDayRow,
  type AiGroundingQueryRow,
} from "./aiPerformanceCsv";

// Bing AI Performance CSV import (ADR-014 §3). The original file goes to the
// evidence store and a `bing_ai_import` row records it; the same file again
// is a no-op. Rows upsert into the citation-day and grounding-query tables.

const ROWS_PER_STATEMENT = 20; // ≤ 5 columns × 20 = 100 D1 parameters
const STATEMENTS_PER_BATCH = 20;
const excluded = (column: string) => sql.raw(`excluded.${column}`);

export type AiImportInput = {
  projectId: string;
  organizationId: string;
  importedBy: string;
  /** Required when the project has more than one bound Bing site. */
  siteId?: string;
  fileName: string;
  csv: string;
  /** Period of an export whose grounding-query rows carry no date. */
  period?: { start: string; end: string };
  store: EvidenceStore;
};

export type AiImportResult =
  | { duplicate: true; importId: string }
  | {
      duplicate: false;
      importId: string;
      rowsRead: number;
      rowsUpserted: number;
      invalidRows: number;
      /** Query rows without a date or `period`, and page-only rows (no table). */
      unstoredRows: number;
      unknownColumns: string[];
    };

async function resolveSiteId(input: AiImportInput) {
  const sites = await db
    .select({ id: bingSites.id })
    .from(bingSites)
    .where(
      and(
        eq(bingSites.projectId, input.projectId),
        eq(bingSites.organizationId, input.organizationId),
        input.siteId ? eq(bingSites.id, input.siteId) : undefined,
      ),
    );
  if (sites.length === 0) throw new Error("No Bing site bound to this project");
  if (sites.length > 1)
    throw new Error("Choose which Bing site to import into");
  return sites[0].id;
}

async function upsertRows(
  siteId: string,
  days: AiCitationDayRow[],
  queries: AiGroundingQueryRow[],
) {
  for (const part of chunk(
    chunk(days, ROWS_PER_STATEMENT),
    STATEMENTS_PER_BATCH,
  )) {
    await runBatch((tx) =>
      part.map((group) =>
        tx
          .insert(bingAiCitationDays)
          .values(group.map((row) => ({ siteId, ...row })))
          .onConflictDoUpdate({
            target: [bingAiCitationDays.siteId, bingAiCitationDays.day],
            set: {
              citations: excluded("citations"),
              citedPages: excluded("cited_pages"),
            },
          }),
      ),
    );
  }
  for (const part of chunk(
    chunk(queries, ROWS_PER_STATEMENT),
    STATEMENTS_PER_BATCH,
  )) {
    await runBatch((tx) =>
      part.map((group) =>
        tx
          .insert(bingAiGroundingQueries)
          .values(group.map((row) => ({ siteId, ...row })))
          .onConflictDoUpdate({
            target: [
              bingAiGroundingQueries.siteId,
              bingAiGroundingQueries.periodStart,
              bingAiGroundingQueries.periodEnd,
              bingAiGroundingQueries.query,
            ],
            set: { citations: excluded("citations") },
          }),
      ),
    );
  }
}

const slug = (fileName: string) =>
  fileName
    .toLowerCase()
    .replace(/\.csv$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "export";

export async function importAiPerformanceCsv(
  input: AiImportInput,
): Promise<AiImportResult> {
  const siteId = await resolveSiteId(input);
  const fileHash = await sha256Hex(input.csv);
  const [previous] = await db
    .select({ id: bingAiImports.id })
    .from(bingAiImports)
    .where(
      and(
        eq(bingAiImports.siteId, siteId),
        eq(bingAiImports.fileHash, fileHash),
      ),
    )
    .limit(1);
  if (previous) return { duplicate: true, importId: previous.id };

  const parsed = parseAiPerformanceCsv(input.csv);
  const { days, queries, unstored } = splitAiRows(parsed.rows, input.period);

  const stored = await input.store.put(
    `${input.projectId}/bing-ai-import/${fileHash.slice(0, 16)}-${slug(input.fileName)}.csv`,
    new TextEncoder().encode(input.csv),
    "text/csv",
  );
  await upsertRows(siteId, days, queries);

  const importId = crypto.randomUUID();
  await db.insert(bingAiImports).values({
    id: importId,
    siteId,
    importedBy: input.importedBy,
    fileHash,
    evidencePath: stored.key,
    rowsRead: parsed.rowsRead,
    rowsUpserted: days.length + queries.length,
  });
  return {
    duplicate: false,
    importId,
    rowsRead: parsed.rowsRead,
    rowsUpserted: days.length + queries.length,
    invalidRows: parsed.invalidRows,
    unstoredRows: unstored,
    unknownColumns: parsed.unknownColumns,
  };
}
