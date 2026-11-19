import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { handbookEvidence, handbookRuns } from "@/db/handbook-tables";
import {
  EVIDENCE_RETAIN_RUNS,
  type EvidenceStore,
} from "@/server/features/handbook/contracts/evidence-store";
import {
  createSupabaseEvidenceStore,
  readSupabaseStorageBytes,
} from "@/server/features/handbook/engine/supabase-evidence-store";
import { supabaseConfig } from "@/server/features/handbook/services/HandbookRunService";

// Evidence retention (FULL-READ §7.4), daily in forkScheduledJobs.ts: full
// bodies stay for the newest 2 runs per project; older finished runs keep
// their findings and inline excerpts, and lose stored bodies + stage blobs.

/** Runs pruned per tick, so one tick stays well under the subrequest cap. */
const MAX_RUNS_PER_TICK = 25;
const QUOTA_BYTES = 1024 ** 3; // Supabase free-tier Storage (1 GB).
const WARN_RATIO = 0.8;
/** Last usage check, read by the run page banner (no settings column exists). */
const STORAGE_STATUS_KEY = "_status/storage.json";

type RunRow = {
  id: string;
  projectId: string;
  startedAt: string;
  finishedAt: string | null;
  /** At least one evidence row still points at a stored body. */
  hasBodies: boolean;
};

type RetentionDeps = {
  store: EvidenceStore;
  listRuns: () => Promise<RunRow[]>;
  clearStorageKeys: (runId: string) => Promise<void>;
  readUsageBytes: () => Promise<number | null>;
};

export function createEvidenceRetentionJob(
  deps: () => Promise<RetentionDeps | null>,
) {
  return {
    name: "handbook-evidence-retention",
    async run() {
      const d = await deps();
      if (!d) return { skipped: "no Supabase Storage configured" };
      const runs = await d.listRuns();
      const keep = newestPerProject(runs, EVIDENCE_RETAIN_RUNS);
      const prune = runs
        .filter((r) => r.hasBodies && r.finishedAt !== null && !keep.has(r.id))
        .slice(0, MAX_RUNS_PER_TICK);
      for (const run of prune) {
        await d.store.deleteRun(run.projectId, run.id);
        await d.clearStorageKeys(run.id);
      }

      const usedBytes = await d.readUsageBytes();
      const ratio = usedBytes === null ? null : usedBytes / QUOTA_BYTES;
      const warn = ratio !== null && ratio >= WARN_RATIO;
      const message = warn
        ? `Evidence storage is at ${Math.round((ratio ?? 0) * 100)} % of the 1 GB Supabase quota. Older runs keep findings and excerpts; full bodies are kept for the last ${EVIDENCE_RETAIN_RUNS} runs per project.`
        : null;
      if (warn) console.warn(`[handbook] ${message}`);
      if (usedBytes === null)
        console.warn("[handbook] evidence storage usage unreadable");
      await d.store.put(
        STORAGE_STATUS_KEY,
        new TextEncoder().encode(
          JSON.stringify({
            usedBytes,
            quotaBytes: QUOTA_BYTES,
            warn,
            message,
            checkedAt: new Date().toISOString(),
          }),
        ),
        "application/json",
      );
      return { pruned: prune.length, usedBytes, warn };
    },
  };
}

async function listRuns(): Promise<RunRow[]> {
  return db
    .select({
      id: handbookRuns.id,
      projectId: handbookRuns.projectId,
      startedAt: handbookRuns.startedAt,
      finishedAt: handbookRuns.finishedAt,
      hasBodies:
        sql<boolean>`exists (select 1 from ${handbookEvidence} where ${handbookEvidence.runId} = ${handbookRuns.id} and ${handbookEvidence.storageKey} is not null)`.mapWith(
          Boolean,
        ),
    })
    .from(handbookRuns);
}

function newestPerProject(rows: RunRow[], n: number): Set<string> {
  const newestFirst = [...rows];
  newestFirst.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const kept = new Map<string, number>();
  const keep = new Set<string>();
  for (const r of newestFirst) {
    const count = kept.get(r.projectId) ?? 0;
    if (count < n) keep.add(r.id);
    kept.set(r.projectId, count + 1);
  }
  return keep;
}

async function clearStorageKeys(runId: string) {
  await db
    .update(handbookEvidence)
    .set({ storageKey: null })
    .where(
      and(
        eq(handbookEvidence.runId, runId),
        isNotNull(handbookEvidence.storageKey),
      ),
    );
}

export const evidenceRetentionJob = createEvidenceRetentionJob(async () => {
  const config = await supabaseConfig();
  if (!config) return null;
  return {
    store: createSupabaseEvidenceStore(config),
    listRuns,
    clearStorageKeys,
    readUsageBytes: () => readSupabaseStorageBytes(config),
  };
});
