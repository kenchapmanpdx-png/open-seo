// Headless Bing AI Performance CSV import (ADR-014 §3, WO-B6-022).
//   pnpm exec tsx fork/scripts/bing-ai-import.ts <projectId> <file.csv>
//     [--site <bingSiteId>] [--period YYYY-MM-DD..YYYY-MM-DD]
// Writes to Supabase Postgres (SUPABASE_DB_URL from .env.local) with the same
// parser and row split as the app upload (`aiPerformanceCsv.ts`). The original
// file goes to Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// are set, else to fork/runs/evidence/. Same file twice → "duplicate", no writes.
// Nothing secret is printed.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";
import {
  parseAiPerformanceCsv,
  splitAiRows,
} from "../../src/server/features/bing/aiPerformanceCsv";
import { createSupabaseEvidenceStore } from "../../src/server/features/handbook/engine/supabase-evidence-store";
import { createFsEvidenceStore } from "./lib/fs-evidence-store";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { site: { type: "string" }, period: { type: "string" } },
});
const [projectId, file] = positionals;
if (!projectId || !file) {
  console.error(
    "usage: tsx fork/scripts/bing-ai-import.ts <projectId> <file.csv> [--site <id>] [--period start..end]",
  );
  process.exit(2);
}
const periodMatch = values.period
  ? /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(values.period)
  : null;
if (values.period && !periodMatch) {
  console.error("--period must be YYYY-MM-DD..YYYY-MM-DD");
  process.exit(2);
}
const period = periodMatch
  ? { start: periodMatch[1], end: periodMatch[2] }
  : undefined;

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_DATABASE_URL;
if (!dbUrl)
  throw new Error("SUPABASE_DB_URL (or POSTGRES_DATABASE_URL) is required");

const csv = readFileSync(file, "utf8");
const fileHash = createHash("sha256").update(csv).digest("hex");
const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });

try {
  const sites = await sql<{ id: string }[]>`
    select id from bing_site
    where project_id = ${projectId} ${values.site ? sql`and id = ${values.site}` : sql``}`;
  if (sites.length !== 1) {
    throw new Error(
      sites.length === 0
        ? "no Bing site bound to this project"
        : "project has several Bing sites; pass --site <id>",
    );
  }
  const siteId = sites[0].id;

  const [previous] = await sql<{ id: string }[]>`
    select id from bing_ai_import where site_id = ${siteId} and file_hash = ${fileHash}`;
  if (previous) {
    console.log(JSON.stringify({ duplicate: true, importId: previous.id }));
    process.exit(0);
  }

  const parsed = parseAiPerformanceCsv(csv);
  const { days, queries, unstored } = splitAiRows(parsed.rows, period);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const store =
    supabaseUrl && serviceRoleKey
      ? createSupabaseEvidenceStore({ url: supabaseUrl, serviceRoleKey })
      : createFsEvidenceStore("fork/runs/evidence");
  const slug = basename(file, ".csv")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const stored = await store.put(
    `${projectId}/bing-ai-import/${fileHash.slice(0, 16)}-${slug || "export"}.csv`,
    new TextEncoder().encode(csv),
    "text/csv",
  );

  const importId = randomUUID();
  await sql.begin(async (tx) => {
    for (const row of days) {
      await tx`
        insert into bing_ai_citation_day (site_id, day, citations, cited_pages)
        values (${siteId}, ${row.day}, ${row.citations}, ${row.citedPages})
        on conflict (site_id, day) do update
          set citations = excluded.citations, cited_pages = excluded.cited_pages`;
    }
    for (const row of queries) {
      await tx`
        insert into bing_ai_grounding_query (site_id, period_start, period_end, query, citations)
        values (${siteId}, ${row.periodStart}, ${row.periodEnd}, ${row.query}, ${row.citations})
        on conflict (site_id, period_start, period_end, query) do update
          set citations = excluded.citations`;
    }
    await tx`
      insert into bing_ai_import (id, site_id, imported_by, file_hash, evidence_path, rows_read, rows_upserted)
      values (${importId}, ${siteId}, 'cli', ${fileHash}, ${stored.key},
              ${parsed.rowsRead}, ${days.length + queries.length})`;
  });

  console.log(
    JSON.stringify({
      duplicate: false,
      importId,
      rowsRead: parsed.rowsRead,
      rowsUpserted: days.length + queries.length,
      invalidRows: parsed.invalidRows,
      unstoredRows: unstored,
      unknownColumns: parsed.unknownColumns,
      evidence: stored.key,
    }),
  );
} finally {
  await sql.end();
}
