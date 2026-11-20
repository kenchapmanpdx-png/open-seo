import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, expect, it, vi } from "vitest";
import { handbookFindings, handbookRuns } from "@/db/handbook-tables";
import { HandbookRepository } from "./HandbookRepository";

// SQLite dialect; HandbookRepository.listRuns.pg.test.ts runs the same case
// with the Postgres dialect's SQL.
const state = vi.hoisted(() => ({ database: null as DatabaseSync | null }));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/db", () => ({
  db: drizzle(async (query, params, method) => {
    if (!state.database) throw new Error("Database not initialized");
    const statement = state.database.prepare(query);
    const values = params.map((v: unknown): SQLInputValue => {
      if (v === null || typeof v === "string" || typeof v === "number")
        return v;
      throw new Error("Unexpected SQL parameter");
    });
    if (method === "run") {
      statement.run(...values);
      return { rows: [] };
    }
    return { rows: statement.all(...values).map((row) => Object.values(row)) };
  }),
}));

const columns = (table: Parameters<typeof getTableColumns>[0]) =>
  Object.values(getTableColumns(table))
    .map((c) => c.name)
    .join(", ");

beforeEach(() => {
  state.database?.close();
  state.database = new DatabaseSync(":memory:");
  state.database.exec(`
    CREATE TABLE handbook_run (${columns(handbookRuns)});
    CREATE TABLE handbook_finding (${columns(handbookFindings)});
    INSERT INTO handbook_run (id, project_id, started_at) VALUES
      ('run-a', 'p1', '2026-11-20T02:00:00Z'), ('run-b', 'p1', '2026-11-20T01:00:00Z');
    INSERT INTO handbook_finding (id, run_id) VALUES ('f1', 'run-a'), ('f2', 'run-a'), ('f3', 'run-a');
  `);
});

it("counts each run's findings (B13 E25: not always 0)", async () => {
  const runs = await HandbookRepository.listRuns("p1");
  expect(runs.map((r) => [r.id, r.findingsCount])).toEqual([
    ["run-a", 3],
    ["run-b", 0],
  ]);
});
