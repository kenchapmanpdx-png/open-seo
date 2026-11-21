// Fork health (B13 WO-B13-011, ADR-028). One snapshot of what the local
// install needs to work: database, render sidecar, LLM key, cron ticks,
// Handbook lease and heartbeat, running audits, plus the last report the
// external watchdog posted. Read by `GET /api/fork-health`, the watchdog and
// the fork status chip. Statuses and short reasons only; never an env value.
import { env } from "cloudflare:workers";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { audits, projects } from "@/db/schema";
import { handbookRuns } from "@/db/handbook-tables";
import {
  probeSidecar,
  sidecarConfigFromEnv,
} from "@/server/features/handbook/collectors/sidecar-config";
import {
  SIDECAR_TOKEN_ENV,
  SIDECAR_URL_ENV,
} from "@/server/features/handbook/contracts/sidecar";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import { LIGHTHOUSE_ENV } from "@/server/features/handbook/engine/depth";
import { HandbookKv } from "@/server/features/handbook/ops/kv";
import { HandbookLeaseRepository } from "@/server/features/handbook/repositories/HandbookLeaseRepository";
import { getOpenRouterAccess } from "@/server/lib/openrouter";
import { getOptionalEnvValue, getWorkersEnv } from "@/server/lib/runtime-env";

const CHECK_TIMEOUT_MS = 5_000;
const CRON_STALE_AFTER_S = 900;
const AUDIT_STALE_AFTER_MS = 12 * 3600 * 1000;
const TICK_KEY = "fork:health:tick";
const WATCHDOG_KEY = "fork:health:watchdog";
const WATCHDOG_TTL_S = 7 * 24 * 3600;

export const watchdogReportSchema = z.strictObject({
  at: z.string().max(40),
  level: z.enum(["ok", "warn", "fail"]),
  note: z.string().max(400),
  selftest: z
    .strictObject({ at: z.string().max(40), ok: z.boolean() })
    .nullable(),
  backupAgeH: z.number().nullable(),
  diskFreeGb: z.number().nullable(),
  buildFailed: z.boolean(),
});
type WatchdogReport = z.infer<typeof watchdogReportSchema>;

export type ForkHealth = {
  ok: boolean;
  checkedAt: string;
  testMode: boolean;
  checks: {
    db: {
      ok: boolean;
      ms: number | null;
      serverConns: number | null;
      error: string | null;
    };
    sidecar: { ok: boolean; version: string | null; reason: string | null };
    llm: { configured: boolean };
    cron: {
      state: "ok" | "stale" | "unknown";
      lastTickAt: string | null;
      ageSec: number | null;
    };
    handbook: {
      leaseHolder: string | null;
      beatAgeSec: number | null;
      interrupted24h: number;
    };
    audits: { running: number; stale: number };
  };
  watchdog: WatchdogReport | null;
};

/** Rejects after 5 s so one hung dependency cannot hang the whole report. */
function within<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("timeout after 5 s")),
        CHECK_TIMEOUT_MS,
      ),
    ),
  ]);
}

/** A secondary check that fails reads as its fallback; the cause is logged. */
function soft<T>(name: string, promise: Promise<T>, fallback: T): Promise<T> {
  return within(promise).catch((error: unknown) => {
    console.warn("fork.health.check-failed", {
      check: name,
      error: errorText(error),
    });
    return fallback;
  });
}

/** Short, credential-free error text (driver messages can echo a URL). */
function errorText(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/postgres(ql)?:\/\/\S+/g, "postgres://[redacted]")
    .slice(0, 200);
}

/** Postgres only: this role's server connections (own session excluded). */
async function serverConns(): Promise<number | null> {
  if ((await getOptionalEnvValue("DATABASE_PROVIDER")) !== "postgres") {
    return null;
  }
  const rows = await db
    .select({
      n: sql<number>`(select count(*)::int from pg_stat_activity where usename = current_user and pid <> pg_backend_pid())`,
    })
    .from(projects)
    .limit(1);
  return rows[0]?.n ?? null;
}

async function checkDb(): Promise<ForkHealth["checks"]["db"]> {
  const started = Date.now();
  try {
    await within(db.select({ id: projects.id }).from(projects).limit(1));
    const ms = Date.now() - started;
    const conns = await soft("serverConns", serverConns(), null);
    return { ok: true, ms, serverConns: conns, error: null };
  } catch (error) {
    return { ok: false, ms: null, serverConns: null, error: errorText(error) };
  }
}

async function checkSidecar(): Promise<ForkHealth["checks"]["sidecar"]> {
  const config = sidecarConfigFromEnv(
    {
      token: await getOptionalEnvValue(SIDECAR_TOKEN_ENV),
      url: await getOptionalEnvValue(SIDECAR_URL_ENV),
      lighthouse: await getOptionalEnvValue(LIGHTHOUSE_ENV),
      concurrency: undefined,
    },
    "full",
  );
  // probeSidecar never throws and bounds each request at 3 s.
  const reason = await probeSidecar(config);
  // A passing probe proves the sidecar's contracts version equals ours.
  return reason
    ? { ok: false, version: null, reason }
    : { ok: true, version: CONTRACTS_VERSION, reason: null };
}

async function checkCron(now: number): Promise<ForkHealth["checks"]["cron"]> {
  const raw = await soft("cron", env.KV.get(TICK_KEY), null);
  const at = raw ? Date.parse(raw) : Number.NaN;
  if (Number.isNaN(at))
    return { state: "unknown", lastTickAt: null, ageSec: null };
  const ageSec = Math.max(0, Math.round((now - at) / 1000));
  return {
    state: ageSec > CRON_STALE_AFTER_S ? "stale" : "ok",
    lastTickAt: new Date(at).toISOString(),
    ageSec,
  };
}

async function checkHandbook(
  now: number,
): Promise<ForkHealth["checks"]["handbook"]> {
  const leaseHolder = await soft(
    "lease",
    HandbookLeaseRepository.currentHolder(),
    null,
  );
  const beat = leaseHolder
    ? await soft("beat", HandbookKv.getBeat(leaseHolder), null)
    : null;
  const since = new Date(now - 24 * 3600 * 1000).toISOString();
  const interrupted = await soft(
    "interrupted24h",
    db
      .select({ n: count() })
      .from(handbookRuns)
      .where(
        and(
          eq(handbookRuns.status, "failed"),
          eq(handbookRuns.errorCode, "interrupted"),
          gte(handbookRuns.finishedAt, since),
        ),
      ),
    [],
  );
  return {
    leaseHolder,
    beatAgeSec: beat ? Math.max(0, Math.round((now - beat.ts) / 1000)) : null,
    interrupted24h: interrupted[0]?.n ?? 0,
  };
}

/**
 * Audits with status `running`. One started more than 12 h ago is `stale`
 * (an upstream audit left running, e.g. one stuck since 2026-11-18): it does
 * not count as activity, so the self-test and the idle checks are not
 * blocked forever.
 */
async function countRunningAudits(
  now: number,
): Promise<ForkHealth["checks"]["audits"]> {
  const rows = await soft(
    "audits",
    db
      .select({ startedAt: audits.startedAt })
      .from(audits)
      .where(eq(audits.status, "running")),
    [],
  );
  const stale = rows.filter(
    (r) => now - Date.parse(r.startedAt) > AUDIT_STALE_AFTER_MS,
  ).length;
  return { running: rows.length - stale, stale };
}

async function readWatchdog(): Promise<WatchdogReport | null> {
  try {
    const raw = await within(env.KV.get(WATCHDOG_KEY));
    if (!raw) return null;
    const parsed = watchdogReportSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function getForkHealth(now = Date.now()): Promise<ForkHealth> {
  // Database checks run one after another: the request has one client, and
  // queued queries would eat each other's 5-s budget.
  const dbChecks = async () => {
    const dbCheck = await checkDb();
    if (!dbCheck.ok) {
      return {
        dbCheck,
        handbook: { leaseHolder: null, beatAgeSec: null, interrupted24h: 0 },
        running: { running: 0, stale: 0 },
      };
    }
    const handbook = await checkHandbook(now);
    const running = await countRunningAudits(now);
    return { dbCheck, handbook, running };
  };
  const [{ dbCheck, handbook, running }, sidecar, cron, watchdog, testMode] =
    await Promise.all([
      dbChecks(),
      checkSidecar(),
      checkCron(now),
      readWatchdog(),
      getOptionalEnvValue("OPENSEO_TEST_MODE"),
    ]);
  let llmConfigured = false;
  try {
    llmConfigured = getOpenRouterAccess((await getWorkersEnv()) ?? {}) !== null;
  } catch {
    // Gateway attribution error: report the key as not usable.
  }
  return {
    ok: dbCheck.ok && sidecar.ok,
    checkedAt: new Date(now).toISOString(),
    testMode: testMode === "1",
    checks: {
      db: dbCheck,
      sidecar,
      llm: { configured: llmConfigured },
      cron,
      handbook,
      audits: running,
    },
    watchdog,
  };
}

export async function saveWatchdogReport(report: WatchdogReport) {
  await env.KV.put(WATCHDOG_KEY, JSON.stringify(report), {
    expirationTtl: WATCHDOG_TTL_S,
  });
}

/** 5-minute cron job: proves the scheduled handler still fires. */
export const healthTickJob = {
  name: "health-tick",
  run: () => env.KV.put(TICK_KEY, new Date().toISOString()),
};
