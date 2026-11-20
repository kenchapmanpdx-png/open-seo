// `run-local.sh ops backfill-grades` (fork/DEPENDABILITY.md WO-B13-008).
// Completed Handbook runs without a stored grade → score with the run page's
// code path (`scoreRun`) and save it. Idempotent; prints run ids and the count.
import { withPgClient } from "@/db";
import { backfillGrades } from "@/server/features/handbook/services/HandbookScore";

if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL not set (run through run-local.sh ops)");
  process.exit(1);
}

const { found, updated } = await withPgClient(backfillGrades);
for (const u of updated)
  console.log(`${u.runId} grade=${u.grade} score=${u.final}`);
console.log(`backfill-grades: ${updated.length} of ${found} updated`);
// withPgClient never ends its client (Workers model); exit explicitly.
process.exit(0);
