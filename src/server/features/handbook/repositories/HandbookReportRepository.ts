import { and, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import {
  handbookFindingItems,
  handbookFindings,
  handbookFindingUrls,
  handbookRuns,
  handbookSiteProfiles,
} from "@/db/handbook-tables";
import { HandbookRepository } from "./HandbookRepository";

/**
 * Everything a run's report.json needs (WO-B4-009), each query joined to
 * `handbook_run` on `projectId` (tenant scope). Null when the run is not in
 * the project.
 */
export async function getReportRows(projectId: string, runId: string) {
  const run = await HandbookRepository.getRun(projectId, runId);
  if (!run) return null;
  // Every query joins handbook_run, so filtering on it scopes all of them.
  const inRun = and(
    eq(handbookRuns.id, runId),
    eq(handbookRuns.projectId, projectId),
  );
  const [siteProfile, items, findings, findingItems, findingUrls, evidence] =
    await Promise.all([
      db
        .select(getTableColumns(handbookSiteProfiles))
        .from(handbookSiteProfiles)
        .innerJoin(
          handbookRuns,
          eq(handbookRuns.id, handbookSiteProfiles.runId),
        )
        .where(inRun)
        .orderBy(handbookSiteProfiles.spCode),
      HandbookRepository.listItemStatuses(projectId, runId),
      db
        .select(getTableColumns(handbookFindings))
        .from(handbookFindings)
        .innerJoin(handbookRuns, eq(handbookRuns.id, handbookFindings.runId))
        .where(inRun)
        .orderBy(handbookFindings.code),
      db
        .select(getTableColumns(handbookFindingItems))
        .from(handbookFindingItems)
        .innerJoin(
          handbookFindings,
          eq(handbookFindings.id, handbookFindingItems.findingId),
        )
        .innerJoin(handbookRuns, eq(handbookRuns.id, handbookFindings.runId))
        .where(inRun),
      db
        .select(getTableColumns(handbookFindingUrls))
        .from(handbookFindingUrls)
        .innerJoin(
          handbookFindings,
          eq(handbookFindings.id, handbookFindingUrls.findingId),
        )
        .innerJoin(handbookRuns, eq(handbookRuns.id, handbookFindings.runId))
        .where(inRun),
      HandbookRepository.listEvidence(projectId, runId, 2_000),
    ]);
  return {
    run,
    siteProfile,
    items,
    findings,
    findingItems,
    findingUrls,
    evidence,
  };
}
