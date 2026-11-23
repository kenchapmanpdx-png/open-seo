// The Check a site choices govern the whole check (B18 WO-B18-014 / 015):
// the Handbook reads no more pages than the linked site audit was set to
// (Quick 50, Whole site 500) and skips the sections it left out. Runs
// without an audit keep the Handbook cap and read everything. `maxMinutes`
// is the crawl page-loop budget (WO-B18-011).
import { parseAuditConfig } from "@/server/lib/audit/types";
import { getRunAudit } from "@/server/features/handbook/repositories/HandbookReportRepository";
import {
  CRAWL_MAX_MINUTES_ENV,
  resolveCrawlMaxMinutes,
} from "@/server/features/handbook/engine/stages";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

export async function runScope(
  input: { projectId: string; auditId: string | null },
  handbookMax: number,
): Promise<{ maxPages: number; excludePaths: string[]; maxMinutes: number }> {
  const config = input.auditId
    ? parseAuditConfig(
        (await getRunAudit(input.projectId, input.auditId))?.config ?? null,
      )
    : null;
  return {
    maxPages: config ? Math.min(handbookMax, config.maxPages) : handbookMax,
    excludePaths: config?.excludePaths ?? [],
    maxMinutes: resolveCrawlMaxMinutes(
      await getOptionalEnvValue(CRAWL_MAX_MINUTES_ENV),
    ),
  };
}
