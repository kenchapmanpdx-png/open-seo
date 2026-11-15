import { sort } from "remeda";
import { getDomain } from "tldts";
import { AppError } from "@/server/lib/errors";
import {
  getProjectDomain,
  listDomains,
  listSummaries,
  listTargets,
  upsertTarget,
} from "./ccRepository";
import { compareReleaseIds, formatReleaseWindow } from "./release";

// Common Crawl baseline (ADR-016 §4): referring domains this vs previous
// release, new/lost linking domains (set difference), top linking domains, and
// the competitor gap (linking to a competitor, not to the project). DATA mode
// only; never used by REVIEW audits (EP-7).

type Scope = { projectId: string; organizationId: string };
type LinkRow = { linkingDomain: string; numHosts: number };

const TOP = 50;

const byHosts = (a: LinkRow, b: LinkRow) =>
  b.numHosts - a.numHosts || a.linkingDomain.localeCompare(b.linkingDomain);
const top = (rows: LinkRow[]) =>
  sort(rows, byHosts)
    .slice(0, TOP)
    .map((r) => ({ domain: r.linkingDomain, numHosts: r.numHosts }));

function registrable(domain: string | null | undefined) {
  return domain ? (getDomain(domain.trim().toLowerCase()) ?? null) : null;
}

async function ownDomain(scope: Scope) {
  const project = await getProjectDomain(scope.projectId, scope.organizationId);
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");
  return registrable(project.domain);
}

async function getBaseline(scope: Scope) {
  const domain = await ownDomain(scope);
  const targets = await listTargets(scope.projectId, scope.organizationId);
  const own = targets.find((t) => t.domain === domain);
  const competitors = targets.filter((t) => t.domain !== domain && t.enabled);
  const summaries = await listSummaries(targets.map((t) => t.id));

  const ownSummaries = sort(
    summaries.filter((s) => s.targetId === own?.id),
    (a, b) => compareReleaseIds(b.releaseId, a.releaseId),
  );
  const [latest, previous] = ownSummaries;
  const competitorSummaries = latest
    ? summaries.filter(
        (s) =>
          s.releaseId === latest.releaseId &&
          competitors.some((c) => c.id === s.targetId),
      )
    : [];

  const domainRows = await listDomains(
    [latest, previous, ...competitorSummaries]
      .filter((s) => s !== undefined)
      .map((s) => s.id),
  );
  const rowsOf = (summaryId: string | undefined) =>
    domainRows.filter((r) => r.summaryId === summaryId);
  const current = rowsOf(latest?.id);
  const before = rowsOf(previous?.id);
  const currentSet = new Set(current.map((r) => r.linkingDomain));
  const beforeSet = new Set(before.map((r) => r.linkingDomain));
  const added = previous
    ? current.filter((r) => !beforeSet.has(r.linkingDomain))
    : [];
  const lost = previous
    ? before.filter((r) => !currentSet.has(r.linkingDomain))
    : [];

  // Competitor gap: domains linking to ≥1 competitor and not to the project.
  const gap = new Map<string, { numHosts: number; competitors: string[] }>();
  for (const summary of competitorSummaries) {
    const competitor = competitors.find((c) => c.id === summary.targetId);
    for (const row of rowsOf(summary.id)) {
      if (currentSet.has(row.linkingDomain) || row.linkingDomain === domain)
        continue;
      const entry = gap.get(row.linkingDomain) ?? {
        numHosts: row.numHosts,
        competitors: [],
      };
      if (competitor) entry.competitors.push(competitor.domain);
      gap.set(row.linkingDomain, entry);
    }
  }
  const competitorGap = sort(
    [...gap].map(([linkingDomain, entry]) => ({ linkingDomain, ...entry })),
    (a, b) => b.competitors.length - a.competitors.length || byHosts(a, b),
  )
    .slice(0, TOP)
    .map(({ linkingDomain, numHosts, competitors: linked }) => ({
      domain: linkingDomain,
      numHosts,
      competitors: linked,
    }));

  return {
    projectId: scope.projectId,
    domain: domain ?? "",
    enabled: own?.enabled ?? false,
    releaseId: latest?.releaseId ?? null,
    releaseWindow: latest ? formatReleaseWindow(latest.releaseId) : null,
    previousReleaseId: previous?.releaseId ?? null,
    previousReleaseWindow: previous
      ? formatReleaseWindow(previous.releaseId)
      : null,
    referringDomains: latest?.referringDomains ?? 0,
    previousReferringDomains: previous?.referringDomains ?? null,
    newDomains: added.length,
    lostDomains: lost.length,
    topLinkingDomains: top(current),
    newLinkingDomains: top(added),
    lostLinkingDomains: top(lost),
    competitorGap,
    competitors: competitors.map((c) => c.domain),
  };
}

async function setTargetEnabled(scope: Scope, enabled: boolean) {
  const domain = await ownDomain(scope);
  if (!domain)
    throw new AppError(
      "VALIDATION_ERROR",
      "Set a project domain before enabling Common Crawl.",
    );
  await upsertTarget({ ...scope, domain, enabled });
}

export const CcService = { getBaseline, setTargetEnabled };
