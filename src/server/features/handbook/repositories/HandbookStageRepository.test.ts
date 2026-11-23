import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HandbookStageRepository } from "./HandbookStageRepository";

const state = vi.hoisted(() => ({ database: null as DatabaseSync | null }));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/db", () => ({
  db: drizzle(async (query, params, method) => {
    if (!state.database) throw new Error("Database not initialized");
    const statement = state.database.prepare(query);
    const values = params.map((value: unknown): SQLInputValue => {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number"
      )
        return value;
      throw new Error("Unexpected SQL parameter");
    });
    if (method === "run") {
      statement.run(...values);
      return { rows: [] };
    }
    return { rows: statement.all(...values).map((row) => Object.values(row)) };
  }),
}));

beforeEach(() => {
  state.database?.close();
  state.database = new DatabaseSync(":memory:");
  state.database.exec(`
    CREATE TABLE handbook_run (id text PRIMARY KEY, status text NOT NULL);
    CREATE TABLE handbook_run_stage (
      run_id text NOT NULL, stage text NOT NULL, batch integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'pending', attempt integer NOT NULL DEFAULT 0,
      items_total integer NOT NULL DEFAULT 0, items_done integer NOT NULL DEFAULT 0,
      error text, started_at text, finished_at text,
      PRIMARY KEY (run_id, stage, batch)
    );
    CREATE TABLE handbook_llm_call (run_id text, cost_usd real);
    CREATE TABLE handbook_page_profile (run_id text, cost_usd real);
    CREATE TABLE handbook_bot_fetch (run_id text);
    INSERT INTO handbook_run VALUES ('run-a', 'running');
  `);
});

describe("handbook stage rows", () => {
  it("a late attempt cannot mark its unit done after the run failed", async () => {
    const tracker = HandbookStageRepository.forRun("run-a");
    await tracker.start("crawl", 0);
    state.database?.exec("UPDATE handbook_run SET status = 'failed'");
    await tracker.finish("crawl", 0, 500);
    expect(await tracker.get("crawl", 0)).toMatchObject({ status: "running" });
    await expect(tracker.start("render", 0)).rejects.toThrow("not live");
  });

  it("live AI cost counts judge calls and the run's own map-stage profiles", async () => {
    state.database?.exec(`
      INSERT INTO handbook_llm_call VALUES ('run-a', 0.25), ('run-b', 9);
      INSERT INTO handbook_page_profile VALUES ('run-a', 0.1), ('old', 5);
    `);
    const rows = await HandbookStageRepository.progressRows("run-a");
    expect(rows.llmCostUsd).toBeCloseTo(0.35);
  });
});
