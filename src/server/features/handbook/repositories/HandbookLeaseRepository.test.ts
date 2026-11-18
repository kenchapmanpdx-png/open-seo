import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HandbookLeaseRepository } from "./HandbookLeaseRepository";

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

const status = (runId: string) =>
  state.database
    ?.prepare("SELECT status FROM handbook_run WHERE id = ?")
    .get(runId)?.status;

beforeEach(() => {
  state.database?.close();
  state.database = new DatabaseSync(":memory:");
  state.database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE handbook_run (id text PRIMARY KEY, status text NOT NULL DEFAULT 'running');
    CREATE TABLE handbook_run_lease (
      key text PRIMARY KEY NOT NULL,
      run_id text NOT NULL REFERENCES handbook_run(id) ON DELETE cascade,
      expires_at text NOT NULL,
      renewed_at text DEFAULT (current_timestamp) NOT NULL
    );
    INSERT INTO handbook_run (id) VALUES ('run-a'), ('run-b');
  `);
});

const t0 = new Date("2026-11-18T10:00:00Z");

describe("handbook run lease", () => {
  it("lets one run hold the machine; the second waits queued", async () => {
    expect(await HandbookLeaseRepository.acquire("run-a", t0)).toBe(true);
    expect(await HandbookLeaseRepository.acquire("run-b", t0)).toBe(false);
    expect(status("run-a")).toBe("running");
    expect(status("run-b")).toBe("queued");
    // A replayed acquire by the holder still holds.
    expect(await HandbookLeaseRepository.acquire("run-a", t0)).toBe(true);
  });

  it("hands an expired lease to the next run, and renewal postpones expiry", async () => {
    await HandbookLeaseRepository.acquire("run-a", t0);
    const later = new Date(t0.getTime() + 90 * 60 * 1000);
    await HandbookLeaseRepository.renew("run-a", later);
    const past2h = new Date(t0.getTime() + 2.5 * 60 * 60 * 1000);
    expect(await HandbookLeaseRepository.acquire("run-b", past2h)).toBe(false);
    const past3h = new Date(t0.getTime() + 3.6 * 60 * 60 * 1000);
    expect(await HandbookLeaseRepository.acquire("run-b", past3h)).toBe(true);
    expect(await HandbookLeaseRepository.currentHolder()).toBe("run-b");
  });

  it("ignores a release by a run that does not hold the lease", async () => {
    await HandbookLeaseRepository.acquire("run-a", t0);
    await HandbookLeaseRepository.release("run-b");
    expect(await HandbookLeaseRepository.currentHolder()).toBe("run-a");
    await HandbookLeaseRepository.release("run-a");
    expect(await HandbookLeaseRepository.acquire("run-b", t0)).toBe(true);
  });
});
