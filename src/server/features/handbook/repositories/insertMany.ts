import { executeInBatches } from "@/db/runBatch";
import { getDatabaseProvider } from "@/db/provider";

/**
 * Multi-row inserts for run results (WO-B19-009): one statement per chunk of
 * rows instead of one per row. On Postgres every statement in a run batch is
 * a sequential round trip (~300 ms to Supabase), so a 500-page run spent
 * most of its `checks` stage saving rows one at a time. Chunks stay under
 * the bound-parameter limit: 100 per statement on D1 / SQLite, a generous
 * 10,000 on Postgres (limit 65,535).
 */
const PARAMS_PER_STATEMENT = { d1: 100, postgres: 10_000 } as const;

export async function insertMany<R extends object>(
  rows: readonly R[],
  insert: (
    tx: Parameters<Parameters<typeof executeInBatches>[1]>[0],
    chunk: R[],
  ) => Promise<unknown>,
): Promise<void> {
  if (rows.length === 0) return;
  const columns = Math.max(...rows.map((r) => Object.keys(r).length), 1);
  const limit =
    PARAMS_PER_STATEMENT[
      getDatabaseProvider() === "postgres" ? "postgres" : "d1"
    ];
  const size = Math.max(1, Math.floor(limit / columns));
  const chunks: R[][] = [];
  for (let i = 0; i < rows.length; i += size)
    chunks.push(rows.slice(i, i + size));
  await executeInBatches(chunks, insert);
}
