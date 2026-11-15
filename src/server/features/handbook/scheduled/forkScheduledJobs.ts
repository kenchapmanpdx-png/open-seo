// Fork cron jobs (B5 R4b; ADR-011 tick, ADR-013…017 jobs). Called once per
// cron invocation from the registration hook in src/server.ts, before the
// upstream jobs. Every job is isolated: a failure is logged and never
// reaches the upstream scheduled handler. B6 work orders add jobs here.

import {
  aiTrafficDailyJob,
  aiTrafficTickJob,
} from "@/server/features/ai-traffic/aiTrafficJobs";
import { categorizeSourcesJob } from "@/server/features/ai-visibility/citations/categorizeUpstreamSources";
import { bingDailySyncJob } from "@/server/features/bing/bingSync";

const EVERY_FIVE_MINUTES = "*/5 * * * *";
const DAILY = "17 3 * * *";

type ForkJob = { name: string; run: () => Promise<unknown> };

const FORK_SCHEDULED_JOBS: Record<string, ForkJob[]> = {
  [EVERY_FIVE_MINUTES]: [aiTrafficTickJob, categorizeSourcesJob],
  [DAILY]: [aiTrafficDailyJob, bingDailySyncJob],
};

export async function runForkScheduledJobs(
  cron: string,
  jobs: Record<string, ForkJob[]> = FORK_SCHEDULED_JOBS,
): Promise<void> {
  for (const job of jobs[cron] ?? []) {
    try {
      await job.run();
    } catch (err) {
      console.error(`[fork-cron] ${job.name} failed:`, err);
    }
  }
}
