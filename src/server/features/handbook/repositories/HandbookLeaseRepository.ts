import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { handbookRunLeases, handbookRuns } from "@/db/handbook-tables";

/**
 * Run queue (ADR-018, FULL-READ §7.3): one handbook run per machine. The
 * `handbook_run_lease` row keyed `machine` names the holder run; it expires
 * 2 h after its last renewal and an expired lease is taken over. Callers pass
 * a run id the workflow created; the lease row cascades with the run.
 */
const LEASE_KEY = "machine";
const LEASE_MS = 2 * 60 * 60 * 1000;

const expiry = (at: Date) => new Date(at.getTime() + LEASE_MS).toISOString();

/**
 * Take the lease when it is free, expired, or already ours (a replayed step).
 * One upsert, so two concurrent acquires cannot both win. Sets the run's
 * status to `running` or `queued` to match.
 */
async function acquire(runId: string, at = new Date()): Promise<boolean> {
  const nowIso = at.toISOString();
  await db
    .insert(handbookRunLeases)
    .values({
      key: LEASE_KEY,
      runId,
      expiresAt: expiry(at),
      renewedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: handbookRunLeases.key,
      set: {
        runId: sql`excluded.run_id`,
        expiresAt: sql`excluded.expires_at`,
        renewedAt: sql`excluded.renewed_at`,
      },
      setWhere: or(
        sql`${handbookRunLeases.expiresAt} < ${nowIso}`,
        eq(handbookRunLeases.runId, runId),
      ),
    });
  const holder = await currentHolder();
  const acquired = holder === runId;
  await db
    .update(handbookRuns)
    .set({ status: acquired ? "running" : "queued" })
    .where(eq(handbookRuns.id, runId));
  return acquired;
}

/** Push the holder's expiry out by 2 h; a non-holder's renew is a no-op. */
async function renew(runId: string, at = new Date()) {
  await db
    .update(handbookRunLeases)
    .set({ expiresAt: expiry(at), renewedAt: at.toISOString() })
    .where(
      and(
        eq(handbookRunLeases.key, LEASE_KEY),
        eq(handbookRunLeases.runId, runId),
      ),
    );
}

/** Free the lease; ignored unless `runId` holds it. */
async function release(runId: string) {
  await db
    .delete(handbookRunLeases)
    .where(
      and(
        eq(handbookRunLeases.key, LEASE_KEY),
        eq(handbookRunLeases.runId, runId),
      ),
    );
}

async function currentHolder(): Promise<string | null> {
  const rows = await db
    .select({ runId: handbookRunLeases.runId })
    .from(handbookRunLeases)
    .where(eq(handbookRunLeases.key, LEASE_KEY))
    .limit(1);
  return rows[0]?.runId ?? null;
}

export const HandbookLeaseRepository = {
  acquire,
  renew,
  release,
  currentHolder,
} as const;
