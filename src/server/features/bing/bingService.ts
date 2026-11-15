import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { createSupabaseEvidenceStore } from "@/server/features/handbook/engine/supabase-evidence-store";
import {
  deleteBingKey,
  getBingKey,
  setBingKey,
  toKeyStatus,
} from "@/server/features/handbook/secrets/CredentialRepository";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import {
  deleteSite,
  lastAiImportAt,
  latestWeekStart,
  listAiCitationDays,
  listCrawlIssues,
  listDailyTraffic,
  listProjectSites,
  projectExists,
  topGroundingQueries,
  topPages,
  topQueries,
} from "./BingRepository";
import { importAiPerformanceCsv } from "./aiPerformanceImport";
import { getSites, isBlockingCrawlIssue } from "./bingClient";
import { bindSite, listBindableSites } from "./bingSync";

// Bing tab + MCP `bing_summary` (ADR-014 §4). Every call resolves the site
// through the project + organization scope; the key never leaves the server.

type Scope = { projectId: string; organizationId: string };

const DAY_MS = 86_400_000;
const TRAFFIC_DAYS = 90;
const SUMMARY_DAYS = 28;
const TOP_ROWS = 20;
const CRAWL_ISSUE_ROWS = 200;

const dayBefore = (now: Date, days: number) =>
  new Date(now.getTime() - (days - 1) * DAY_MS).toISOString().slice(0, 10);

async function assertProject({ projectId, organizationId }: Scope) {
  if (!(await projectExists(projectId, organizationId)))
    throw new AppError("NOT_FOUND", "Project not found.");
}

/** The project's first bound site (one per project in practice). */
async function currentSite(scope: Scope) {
  await assertProject(scope);
  const [site] = await listProjectSites(scope.projectId, scope.organizationId);
  return site ?? null;
}

async function evidenceStore(): Promise<EvidenceStore> {
  const url = await getOptionalEnvValue("SUPABASE_URL");
  const serviceRoleKey = await getOptionalEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (url && serviceRoleKey)
    return createSupabaseEvidenceStore({ url, serviceRoleKey });
  // ADR-003 fallback: the import row is kept; the file body is not persisted.
  console.warn("bing: Supabase storage not configured; CSV body not persisted");
  return createMemoryEvidenceStore();
}

const sum = (values: number[]) => values.reduce((total, n) => total + n, 0);

export const BingService = {
  async getPage(scope: Scope, now = new Date()) {
    const keyStatus = toKeyStatus(await getBingKey(scope.organizationId));
    const site = await currentSite(scope);
    if (!site) return { keyStatus, site: null, data: null };

    const latestWeek = await latestWeekStart(site.id);
    // Latest 4 weekly buckets (week_start is a Monday).
    const fromWeek = latestWeek
      ? new Date(Date.parse(`${latestWeek}T00:00:00Z`) - 21 * DAY_MS)
          .toISOString()
          .slice(0, 10)
      : "9999-12-31";
    const fromDay = dayBefore(now, TRAFFIC_DAYS);
    const [traffic, queries, pages, issues, aiDays, grounding, lastImport] =
      await Promise.all([
        listDailyTraffic(site.id, fromDay),
        topQueries(site.id, fromWeek, TOP_ROWS),
        topPages(site.id, fromWeek, TOP_ROWS),
        listCrawlIssues(site.id, CRAWL_ISSUE_ROWS),
        listAiCitationDays(site.id, fromDay),
        topGroundingQueries(site.id, fromDay, TOP_ROWS),
        lastAiImportAt(site.id),
      ]);
    const labelled = issues.map((issue) => ({
      ...issue,
      blocking: isBlockingCrawlIssue(issue.issueType),
    }));
    const crawlIssues = [
      ...labelled.filter((issue) => issue.blocking),
      ...labelled.filter((issue) => !issue.blocking),
    ];
    return {
      keyStatus,
      site,
      data: {
        traffic,
        queries,
        pages,
        crawlIssues,
        aiDays,
        grounding,
        lastImport,
      },
    };
  },

  /** K10 `bingSummarySchema` (UI header + MCP). */
  async getSummary(scope: Scope, now = new Date()) {
    const site = await currentSite(scope);
    const empty = {
      projectId: scope.projectId,
      siteUrl: null,
      verified: null,
      lastSyncAt: null,
      lastError: null,
      clicks28d: null,
      impressions28d: null,
      blockingCrawlIssues: 0,
      aiCitations28d: null,
      aiLastImportAt: null,
    };
    if (!site) return empty;
    const fromDay = dayBefore(now, SUMMARY_DAYS);
    const [traffic, issues, aiDays, lastImport] = await Promise.all([
      listDailyTraffic(site.id, fromDay),
      listCrawlIssues(site.id, CRAWL_ISSUE_ROWS),
      listAiCitationDays(site.id, fromDay),
      lastAiImportAt(site.id),
    ]);
    return {
      ...empty,
      siteUrl: site.siteUrl,
      verified: site.verified,
      lastSyncAt: site.lastSuccessAt,
      lastError: site.lastError,
      clicks28d: traffic.length ? sum(traffic.map((row) => row.clicks)) : null,
      impressions28d: traffic.length
        ? sum(traffic.map((row) => row.impressions))
        : null,
      blockingCrawlIssues: issues.filter((issue) =>
        isBlockingCrawlIssue(issue.issueType),
      ).length,
      aiCitations28d: aiDays.length
        ? sum(aiDays.map((row) => row.citations))
        : null,
      aiLastImportAt: lastImport,
    };
  },

  /** Validates the key against BWT before storing it. */
  async setKey(scope: Scope, key: string) {
    await assertProject(scope);
    try {
      await getSites(key);
    } catch {
      throw new AppError("VALIDATION_ERROR", "Bing rejected this API key.");
    }
    await setBingKey(scope.organizationId, key);
  },

  async deleteKey(scope: Scope) {
    await assertProject(scope);
    await deleteBingKey(scope.organizationId);
  },

  async listBindableSites(scope: Scope) {
    await assertProject(scope);
    return (await listBindableSites(scope.organizationId)) ?? [];
  },

  async bindSite(scope: Scope & { siteUrl: string }) {
    try {
      return await bindSite(scope);
    } catch (error) {
      throw new AppError(
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Could not bind the site.",
      );
    }
  },

  async unbindSite(scope: Scope & { siteId: string }) {
    await assertProject(scope);
    await deleteSite(scope.siteId, scope.projectId, scope.organizationId);
  },

  async importCsv(
    scope: Scope & { userId: string; fileName: string; csv: string },
  ) {
    await assertProject(scope);
    return importAiPerformanceCsv({
      projectId: scope.projectId,
      organizationId: scope.organizationId,
      importedBy: scope.userId,
      fileName: scope.fileName,
      csv: scope.csv,
      store: await evidenceStore(),
    });
  },
};
