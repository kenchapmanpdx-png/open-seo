import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditService } from "@/server/features/audit/services/AuditService";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import {
  readWorkflowStatus,
  terminateStuckWorkflow,
} from "@/server/lib/startWorkflow";
import { reconcileHandbookRuns } from "./handbook-reconciler";

const state = vi.hoisted(() => ({
  database: null as DatabaseSync | null,
  kv: new Map<string, string>(),
  kvDown: false,
}));
vi.mock("cloudflare:workers", () => ({
  env: {
    SITE_AUDIT_WORKFLOW: {},
    KV: {
      get: async (key: string) => {
        if (state.kvDown) throw new Error("kv down");
        return state.kv.get(key) ?? null;
      },
      put: async (key: string, value: string) => {
        if (state.kvDown) throw new Error("kv down");
        state.kv.set(key, value);
      },
    },
  },
}));
vi.mock("@/db", () => ({
  db: drizzle(async (query, params, method) => {
    if (!state.database) throw new Error("Database not initialized");
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
vi.mock("@/server/lib/startWorkflow", () => ({
  readWorkflowStatus: vi.fn(),
  terminateStuckWorkflow: vi.fn(),
}));
vi.mock("@/server/features/audit/services/AuditService", () => ({
  AuditService: { startAudit: vi.fn(), resolveAuditLimitTier: vi.fn() },
}));
vi.mock("@/server/lib/audit/rendering-policy", () => ({
  isAuditRenderingAllowed: async () => false,
}));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: vi.fn(),
}));

const NOW = Date.parse("2026-11-20T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function exec(sql: string, ...values: SQLInputValue[]) {
  state.database?.prepare(sql).run(...values);
}
const row = (sql: string, ...values: SQLInputValue[]) =>
  state.database?.prepare(sql).get(...values);

function addAudit(
  id: string,
  opts: {
    status?: string;
    errorCode?: string | null;
    startedMin?: number;
    completedMin?: number | null;
  } = {},
) {
  exec(
    `INSERT INTO audits VALUES (?, 'p1', 'https://example.com/', 'u1', ?, ?, ?, ?, ?, ?)`,
    id,
    JSON.stringify({ maxPages: 25, lighthouseStrategy: "none" }),
    opts.status ?? "completed",
    opts.errorCode ?? null,
    id,
    ago(opts.startedMin ?? 60),
    opts.completedMin === null ? null : ago(opts.completedMin ?? 40),
  );
}

function addRun(
  id: string,
  auditId: string,
  opts: {
    status?: string;
    errorCode?: string | null;
    startedMin?: number;
    finishedMin?: number;
  } = {},
) {
  exec(
    `INSERT INTO handbook_run VALUES (?, 'p1', ?, ?, ?, NULL, ?, ?)`,
    id,
    auditId,
    opts.status ?? "running",
    opts.errorCode ?? null,
    ago(opts.startedMin ?? 30),
    opts.finishedMin === undefined ? null : ago(opts.finishedMin),
  );
}

const beat = (runId: string, minutesAgo: number) =>
  state.kv.set(
    `fork:hb:beat:${runId}`,
    JSON.stringify({
      ts: NOW - minutesAgo * 60_000,
      stage: "render",
      batch: 0,
    }),
  );
const holdLease = (runId: string) =>
  exec(
    `INSERT INTO handbook_run_lease VALUES ('machine', ?, ?, ?)`,
    runId,
    ago(-60),
    ago(1),
  );
const runRow = (id: string) =>
  row(`SELECT status, error_code FROM handbook_run WHERE id = ?`, id);
const leaseHolder = () =>
  row(`SELECT run_id FROM handbook_run_lease WHERE key = 'machine'`)?.run_id;
const note = (auditId: string) => state.kv.get(`fork:hb:rerun:${auditId}`);

beforeEach(() => {
  state.kv.clear();
  state.kvDown = false;
  state.database?.close();
  state.database = new DatabaseSync(":memory:");
  state.database.exec(`
    CREATE TABLE projects (id text PRIMARY KEY, organization_id text NOT NULL);
    CREATE TABLE audits (
      id text PRIMARY KEY, project_id text, start_url text,
      started_by_user_id text, config text, status text, error_code text,
      workflow_instance_id text, started_at text, completed_at text
    );
    CREATE TABLE handbook_run (
      id text PRIMARY KEY, project_id text, audit_id text, status text,
      error_code text, tier text, started_at text, finished_at text
    );
    CREATE TABLE handbook_run_lease (
      key text PRIMARY KEY, run_id text, expires_at text, renewed_at text
    );
    INSERT INTO projects VALUES ('p1', 'org-1');
  `);
  vi.mocked(readWorkflowStatus).mockResolvedValue({ status: "running" });
  vi.mocked(getOptionalEnvValue).mockResolvedValue(undefined);
  vi.mocked(AuditService.startAudit).mockResolvedValue({
    auditId: "00000000-0000-4000-8000-000000000001",
  });
  vi.mocked(AuditService.resolveAuditLimitTier).mockResolvedValue(
    "self_hosted",
  );
});

describe("handbook reconciler: stuck runs", () => {
  it("leaves a run with a fresh beat alone", async () => {
    addAudit("a1");
    addRun("hb-a1", "a1");
    beat("hb-a1", 2);
    await reconcileHandbookRuns(NOW);
    expect(runRow("hb-a1")).toMatchObject({ status: "running" });
    expect(terminateStuckWorkflow).not.toHaveBeenCalled();
  });

  it("leaves a young run without a beat alone", async () => {
    addAudit("a1");
    addRun("hb-a1", "a1", { startedMin: 5 });
    await reconcileHandbookRuns(NOW);
    expect(runRow("hb-a1")).toMatchObject({ status: "running" });
  });

  it("terminates a running instance whose beat stopped, fails the run and frees the lease", async () => {
    addAudit("a1");
    addRun("hb-a1", "a1");
    beat("hb-a1", 15);
    holdLease("hb-a1");
    await reconcileHandbookRuns(NOW);
    expect(terminateStuckWorkflow).toHaveBeenCalledWith(
      expect.anything(),
      "a1",
    );
    expect(runRow("hb-a1")).toMatchObject({
      status: "failed",
      error_code: "interrupted",
    });
    expect(leaseHolder()).toBeUndefined();
  });

  it("does not terminate an instance that is already gone", async () => {
    vi.mocked(readWorkflowStatus).mockResolvedValue("missing");
    addAudit("a1");
    addRun("hb-a1", "a1");
    await reconcileHandbookRuns(NOW);
    expect(terminateStuckWorkflow).not.toHaveBeenCalled();
    expect(runRow("hb-a1")).toMatchObject({ status: "failed" });
  });

  it("does nothing while KV is down", async () => {
    state.kvDown = true;
    addAudit("a1");
    addRun("hb-a1", "a1");
    await reconcileHandbookRuns(NOW);
    expect(runRow("hb-a1")).toMatchObject({ status: "running" });
  });

  it("releases a lease whose holder is no longer running", async () => {
    addAudit("a1");
    addRun("hb-a1", "a1", { status: "completed", finishedMin: 5 });
    holdLease("hb-a1");
    await reconcileHandbookRuns(NOW);
    expect(leaseHolder()).toBeUndefined();
  });
});

describe("handbook reconciler: automatic re-run", () => {
  const interrupted = () => {
    addAudit("a1");
    addRun("hb-a1", "a1", {
      status: "failed",
      errorCode: "interrupted",
      finishedMin: 5,
    });
  };

  it("re-runs the audit of an interrupted run with its stored config", async () => {
    interrupted();
    await reconcileHandbookRuns(NOW);
    expect(AuditService.startAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "u1",
        billingCustomer: {
          organizationId: "org-1",
          userId: "u1",
          userEmail: "",
        },
        startUrl: "https://example.com/",
        maxPages: 25,
        lighthouseStrategy: "none",
        renderJavaScript: false,
        limitTier: "self_hosted",
      }),
    );
    expect(JSON.parse(note("a1") ?? "{}")).toMatchObject({
      newAuditId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it.each([
    [
      "auto re-run off",
      () => vi.mocked(getOptionalEnvValue).mockResolvedValue("0"),
    ],
    [
      "another audit running",
      () => addAudit("a-other", { status: "running", completedMin: null }),
    ],
    ["a newer audit", () => addAudit("a2", { startedMin: 10 })],
    [
      "a second failure in the window",
      () => addAudit("a0", { status: "failed", startedMin: 120 }),
    ],
  ])("does not re-run with %s", async (_rule, arrange) => {
    interrupted();
    arrange();
    await reconcileHandbookRuns(NOW);
    expect(AuditService.startAudit).not.toHaveBeenCalled();
    expect(JSON.parse(note("a1") ?? "{}")).toHaveProperty("blockedBy");
  });

  it("re-runs a transient audit failure only after the cooldown", async () => {
    addAudit("a1", {
      status: "failed",
      errorCode: "db_error",
      completedMin: 5,
    });
    await reconcileHandbookRuns(NOW);
    expect(AuditService.startAudit).not.toHaveBeenCalled();
    exec(`UPDATE audits SET completed_at = ? WHERE id = 'a1'`, ago(11));
    await reconcileHandbookRuns(NOW);
    expect(AuditService.startAudit).toHaveBeenCalledTimes(1);
  });

  it("never re-runs a failure that repeats", async () => {
    addAudit("a1", { status: "failed", errorCode: "oom", completedMin: 20 });
    await reconcileHandbookRuns(NOW);
    expect(AuditService.startAudit).not.toHaveBeenCalled();
  });

  it("starts nothing while the database ping fails", async () => {
    interrupted();
    state.database?.exec("DROP TABLE projects");
    await reconcileHandbookRuns(NOW);
    expect(AuditService.startAudit).not.toHaveBeenCalled();
    expect(note("a1")).toBeUndefined();
  });
});
