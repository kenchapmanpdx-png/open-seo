import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import { getForkHealth } from "./health";

const TOKEN = "sidecar-token-value-0123456789";
const API_KEY = "sk-or-secret-value-0123456789";

const state = vi.hoisted(() => ({
  database: null as DatabaseSync | null,
  kv: new Map<string, string>(),
  dbDown: false,
  env: {} as Record<string, string | undefined>,
}));
vi.mock("cloudflare:workers", () => ({
  env: {
    KV: {
      get: async (key: string) => state.kv.get(key) ?? null,
      put: async (key: string, value: string) => void state.kv.set(key, value),
    },
  },
}));
vi.mock("@/db", () => ({
  db: drizzle(async (query, params, method) => {
    if (state.dbDown || !state.database) {
      throw new Error("connect ECONNREFUSED postgres://user:pw@host:6543/db");
    }
    const statement = state.database.prepare(query);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test SQL params are strings / numbers
    const values = params as SQLInputValue[];
    if (method === "run") {
      statement.run(...values);
      return { rows: [] };
    }
    return { rows: statement.all(...values).map((row) => Object.values(row)) };
  }),
}));
vi.mock("@/server/lib/runtime-env", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getOptionalEnvValue: async (name: string) => state.env[name],
  getWorkersEnv: async () => state.env,
}));

const NOW = Date.parse("2026-11-20T12:00:00Z");
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();
const exec = (sql: string, ...values: SQLInputValue[]) =>
  state.database?.prepare(sql).run(...values);

function sidecar(health: "ok" | "down") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (health === "down") throw new TypeError("fetch failed");
      return url.endsWith("/health")
        ? Response.json({
            ok: true,
            version: "1",
            chromium: "1",
            contractsVersion: CONTRACTS_VERSION,
          })
        : new Response(null, { status: 200 });
    }),
  );
}

beforeEach(() => {
  state.kv.clear();
  state.dbDown = false;
  state.env = {
    HANDBOOK_SIDECAR_TOKEN: TOKEN,
    OPENROUTER_API_KEY: API_KEY,
    OPENSEO_TEST_MODE: "1",
  };
  state.database?.close();
  state.database = new DatabaseSync(":memory:");
  state.database.exec(`
    CREATE TABLE projects (id text PRIMARY KEY);
    CREATE TABLE audits (id text PRIMARY KEY, status text, started_at text);
    CREATE TABLE handbook_run (
      id text PRIMARY KEY, status text, error_code text, finished_at text
    );
    CREATE TABLE handbook_run_lease (
      key text PRIMARY KEY, run_id text, expires_at text, renewed_at text
    );
    INSERT INTO projects VALUES ('p1');
  `);
  sidecar("ok");
});

describe("getForkHealth", () => {
  it("reports every check and never echoes an env value", async () => {
    exec(
      `INSERT INTO audits VALUES ('a1', 'running', ?), ('a2', 'completed', ?), ('a3', 'running', ?)`,
      ago(600),
      ago(600),
      ago(48 * 3600),
    );
    exec(
      `INSERT INTO handbook_run VALUES ('r1', 'failed', 'interrupted', ?), ('r2', 'failed', 'interrupted', ?), ('r3', 'running', NULL, NULL)`,
      ago(3600),
      ago(30 * 3600),
    );
    exec(
      `INSERT INTO handbook_run_lease VALUES ('machine', 'r3', ?, ?)`,
      ago(-60),
      ago(0),
    );
    state.kv.set(
      "fork:hb:beat:r3",
      JSON.stringify({ ts: NOW - 40_000, stage: "render", batch: 0 }),
    );
    state.kv.set("fork:health:tick", ago(120));

    const health = await getForkHealth(NOW);

    expect(health).toMatchObject({
      ok: true,
      testMode: true,
      checks: {
        db: { ok: true, serverConns: null, error: null },
        sidecar: { ok: true, version: CONTRACTS_VERSION, reason: null },
        llm: { configured: true },
        cron: { state: "ok", ageSec: 120 },
        handbook: { leaseHolder: "r3", beatAgeSec: 40, interrupted24h: 1 },
        audits: { running: 1, stale: 1 },
      },
      watchdog: null,
    });
    const body = JSON.stringify(health);
    expect(body).not.toContain(TOKEN);
    expect(body).not.toContain(API_KEY);
  });

  it("is not ok when the sidecar is unreachable", async () => {
    sidecar("down");
    const health = await getForkHealth(NOW);
    expect(health.ok).toBe(false);
    expect(health.checks.sidecar).toMatchObject({ ok: false, version: null });
    expect(health.checks.sidecar.reason).toContain("sidecar unreachable");
  });

  it("is not ok when the database fails, without leaking the URL", async () => {
    state.dbDown = true;
    const health = await getForkHealth(NOW);
    expect(health.ok).toBe(false);
    expect(health.checks.db).toMatchObject({ ok: false, ms: null });
    expect(health.checks.db.error).not.toContain("user:pw");
  });

  it("reads cron as unknown without a tick and stale after 15 minutes", async () => {
    expect((await getForkHealth(NOW)).checks.cron.state).toBe("unknown");
    state.kv.set("fork:health:tick", ago(901));
    expect((await getForkHealth(NOW)).checks.cron.state).toBe("stale");
  });
});
