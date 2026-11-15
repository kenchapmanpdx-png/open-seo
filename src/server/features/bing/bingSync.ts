import { getBingKey } from "@/server/features/handbook/secrets/CredentialRepository";
import {
  projectExists,
  recordSyncResult,
  listAllSites,
  setVerified,
  upsertCrawlIssues,
  upsertDailyTraffic,
  upsertPageWeeks,
  upsertQueryWeeks,
  upsertSite,
  type CrawlIssueRow,
  type DailyTrafficRow,
  type QueryWeekRow,
} from "./BingRepository";
import {
  bingDateToDay,
  bingPositionOrNull,
  getCrawlIssues,
  getPageStats,
  getQueryStats,
  getRankAndTrafficStats,
  getSites,
} from "./bingClient";
import type { BingCrawlIssue, BingQueryStats } from "./bingTypes";

// Bing site binding + daily sync (ADR-014 §1–2). The key comes from the
// organization's credential (or the local env fallback); no key → skip.

const SITES_PER_RUN = 50;
const MAX_ERROR_LENGTH = 500;

/** Sites the organization's Bing key can see; binding picks from this list. */
export async function listBindableSites(organizationId: string) {
  const resolved = await getBingKey(organizationId);
  if (!resolved) return null;
  const sites = await getSites(resolved.key);
  return sites.map((site) => ({
    siteUrl: site.Url,
    verified: site.IsVerified ?? false,
  }));
}

/** Bind a project to a site exactly as BWT lists it (no free text). */
export async function bindSite(input: {
  projectId: string;
  organizationId: string;
  siteUrl: string;
}) {
  if (!(await projectExists(input.projectId, input.organizationId))) {
    throw new Error("Project not found");
  }
  const sites = await listBindableSites(input.organizationId);
  if (!sites) throw new Error("No Bing Webmaster Tools API key configured");
  const site = sites.find((candidate) => candidate.siteUrl === input.siteUrl);
  if (!site)
    throw new Error("Site is not in this Bing Webmaster Tools account");
  return upsertSite({ ...input, verified: site.verified });
}

/** Monday (UTC) of the week a day falls in. */
function weekStartOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** Bing weekly rows → one row per (week, key); a repeat within a week replaces the earlier one. */
function toWeekRows(rows: BingQueryStats[]) {
  const byKey = new Map<
    string,
    Omit<QueryWeekRow, "query"> & { label: string }
  >();
  for (const row of rows) {
    const day = bingDateToDay(row.Date);
    if (!day || !row.Query) continue;
    const weekStart = weekStartOf(day);
    byKey.set(`${weekStart}\u0000${row.Query}`, {
      label: row.Query,
      weekStart,
      impressions: row.Impressions,
      clicks: row.Clicks,
      avgImpressionPosition: bingPositionOrNull(row.AvgImpressionPosition),
      avgClickPosition: bingPositionOrNull(row.AvgClickPosition),
    });
  }
  return [...byKey.values()];
}

function toCrawlIssueRows(issues: BingCrawlIssue[]): CrawlIssueRow[] {
  const byKey = new Map<string, CrawlIssueRow>();
  for (const issue of issues) {
    const issueType =
      issue.IssueType?.trim() ||
      (issue.Issues != null ? String(issue.Issues) : "Unknown");
    byKey.set(`${issue.Url}\u0000${issueType}`, {
      url: issue.Url,
      issueType,
      httpCode: issue.HttpCode,
    });
  }
  return [...byKey.values()];
}

async function syncSite(
  site: { id: string; siteUrl: string },
  key: string,
  today: string,
) {
  // Fetch everything first, one call at a time (Bing throttles bursts): a
  // throttle stops this site before any write.
  const sites = await getSites(key);
  const traffic = await getRankAndTrafficStats(key, site.siteUrl);
  const queries = await getQueryStats(key, site.siteUrl);
  const pages = await getPageStats(key, site.siteUrl);
  const issues = await getCrawlIssues(key, site.siteUrl);

  const listed = sites.find((candidate) => candidate.Url === site.siteUrl);
  if (listed) await setVerified(site.id, listed.IsVerified ?? false);

  const daily: DailyTrafficRow[] = [];
  for (const row of traffic) {
    const day = bingDateToDay(row.Date);
    if (day)
      daily.push({ day, impressions: row.Impressions, clicks: row.Clicks });
  }
  await upsertDailyTraffic(site.id, daily);
  await upsertQueryWeeks(
    site.id,
    toWeekRows(queries).map(({ label, ...row }) => ({ ...row, query: label })),
  );
  await upsertPageWeeks(
    site.id,
    toWeekRows(pages).map(({ label, ...row }) => ({ ...row, page: label })),
  );
  await upsertCrawlIssues(site.id, toCrawlIssueRows(issues), today);
}

/** Daily cron: sync every bound site with its organization's key. */
export async function syncAllBingSites(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const at = now.toISOString();
  const keys = new Map<string, string | null>();
  const result = { synced: 0, skipped: 0, failed: 0 };

  for (const site of await listAllSites(SITES_PER_RUN)) {
    if (!keys.has(site.organizationId)) {
      const resolved = await getBingKey(site.organizationId);
      keys.set(site.organizationId, resolved?.key ?? null);
    }
    const key = keys.get(site.organizationId);
    if (!key) {
      await recordSyncResult(site.id, { ok: false, at, error: "no key" });
      result.skipped += 1;
      continue;
    }
    try {
      await syncSite(site, key, today);
      await recordSyncResult(site.id, { ok: true, at });
      result.synced += 1;
    } catch (err) {
      // Includes a throttle: the client already retried and cooled the key down.
      const message = err instanceof Error ? err.message : String(err);
      await recordSyncResult(site.id, {
        ok: false,
        at,
        error: message.slice(0, MAX_ERROR_LENGTH),
      });
      result.failed += 1;
    }
  }
  return result;
}

export const bingDailySyncJob = {
  name: "bing:daily-sync",
  run: () => syncAllBingSites(),
};
