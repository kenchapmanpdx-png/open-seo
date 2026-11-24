import { executeInBatches } from "@/db/runBatch";
import { getDatabaseProvider } from "@/db/provider";

/**
 * Multi-row inserts for run results (WO-B19-009, WO-B20-004): one statement
 * per chunk of rows instead of one per row, and every table of a save in one
 * `executeInBatches` call (one transaction per 100 statements on Postgres, one
 * D1 batch). On Postgres every statement and every BEGIN / COMMIT is a
 * sequential round trip (~300 ms to Supabase), so a 50-page run spent 45 s
 * saving rows table by table and row by row. Chunks stay under the
 * bound-parameter limit: 100 per statement on D1 / SQLite, a generous 10,000
 * on Postgres (limit 65,535).
 */
const PARAMS_PER_STATEMENT = { d1: 100, postgres: 10_000 } as const;

type Tx = Parameters<Parameters<typeof executeInBatches>[1]>[0];
type InsertStatement = {
  rows: number;
  run: (tx: Tx) => Promise<unknown>;
};

/** The chunked insert statements for one table's rows (run them with `insertAll`). */
export function insertRows<R extends object>(
  rows: readonly R[],
  insert: (tx: Tx, chunk: R[]) => Promise<unknown>,
): InsertStatement[] {
  if (rows.length === 0) return [];
  const columns = Math.max(...rows.map((r) => Object.keys(r).length), 1);
  const limit =
    PARAMS_PER_STATEMENT[
      getDatabaseProvider() === "postgres" ? "postgres" : "d1"
    ];
  const size = Math.max(1, Math.floor(limit / columns));
  const statements: InsertStatement[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    statements.push({ rows: chunk.length, run: (tx) => insert(tx, chunk) });
  }
  return statements;
}

/** Run statements of several tables together, in order; returns the rows written. */
export async function insertAll(
  statements: InsertStatement[],
): Promise<number> {
  if (statements.length === 0) return 0;
  await executeInBatches(statements, (tx, statement) => statement.run(tx));
  return statements.reduce((n, s) => n + s.rows, 0);
}

export async function insertMany<R extends object>(
  rows: readonly R[],
  insert: (tx: Tx, chunk: R[]) => Promise<unknown>,
): Promise<void> {
  await insertAll(insertRows(rows, insert));
}
