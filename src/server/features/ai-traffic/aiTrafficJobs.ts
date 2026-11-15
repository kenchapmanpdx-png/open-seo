import { getDatabaseProvider } from "@/db/provider";
import {
  deleteEventsObservedBefore,
  deleteStaleClasses,
  insertClasses,
  listRollupSource,
  listUnclassifiedEvents,
  replaceDaily,
  type DailyRow,
} from "./AiTrafficRepository";
import { countsAsAiUserFetchHit } from "./browser-agents";
import { classifyTrafficEvent } from "./classifier";
import { RULES_VERSION } from "./rules";

// AI traffic cron jobs (ADR-013 §3), registered in forkScheduledJobs.ts.

const CLASSIFY_BATCH = 5_000;
const RECLASSIFY_BATCH = 5_000;
const RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Every 5 minutes: classify new events, then rebuild today's and yesterday's rollup. */
export async function classifyAndRollup(now = new Date()) {
  const events = await listUnclassifiedEvents(CLASSIFY_BATCH);
  await insertClasses(
    events.map((event) => ({
      eventId: event.id,
      traffic: classifyTrafficEvent(event),
    })),
  );

  const days = [isoDay(new Date(now.getTime() - DAY_MS)), isoDay(now)];
  const rows = new Map<
    string,
    DailyRow & { hits: number; paths: Set<string> }
  >();
  for (const event of await listRollupSource(days[0])) {
    // A browser agent's own resource fetches are not user fetches (Canonry).
    if (
      event.kind === "user_fetch" &&
      !countsAsAiUserFetchHit(event.ruleId ?? "", event)
    )
      continue;
    const ruleId = event.ruleId ?? "";
    const verification = event.verification ?? "";
    const key = [
      event.siteId,
      event.day,
      event.kind,
      ruleId,
      verification,
    ].join("\u0000");
    const row = rows.get(key) ?? {
      siteId: event.siteId,
      day: event.day,
      kind: event.kind,
      ruleId,
      verification,
      hits: 0,
      distinctPaths: 0,
      paths: new Set<string>(),
    };
    row.hits += 1;
    row.paths.add(event.path);
    rows.set(key, row);
  }
  await replaceDaily(
    days,
    [...rows.values()].map(({ paths, ...row }) => ({
      ...row,
      distinctPaths: paths.size,
    })),
  );
  return { classified: events.length, rollupRows: rows.size };
}

/** Daily: 90-day raw retention (classes cascade), then queue re-classification after a rules change. */
export async function pruneAndReclassify(now = new Date()) {
  await deleteEventsObservedBefore(
    new Date(now.getTime() - RETENTION_DAYS * DAY_MS).toISOString(),
  );
  return {
    unclassified: await deleteStaleClasses(RULES_VERSION, RECLASSIFY_BATCH),
  };
}

// The receiver writes to Supabase only; SQLite deployments have the tables
// but never any events (ADR-013 §3).
const postgresOnly = (run: () => Promise<unknown>) => async () =>
  getDatabaseProvider() === "postgres" ? run() : undefined;

export const aiTrafficTickJob = {
  name: "ai-traffic:classify-rollup",
  run: postgresOnly(() => classifyAndRollup()),
};

export const aiTrafficDailyJob = {
  name: "ai-traffic:retention-reclassify",
  run: postgresOnly(() => pruneAndReclassify()),
};
