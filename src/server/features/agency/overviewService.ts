import { AiTrafficService } from "@/server/features/ai-traffic/aiTrafficService";
import { listRuns } from "@/server/features/handbook/repositories/HandbookReportRepository";
import { HandbookService } from "@/server/features/handbook/services/HandbookService";
import {
  getByokIntervalDays,
  latestByokMentions,
  latestUpstreamMentions,
  sumByokRuns,
  sumHandbookLlmUsd,
} from "./OverviewRepository";

// One-screen project overview (B7 R1): handbook grade + findings, AI
// traffic, AI answer mentions, and a monthly cost estimate for the costs the
// fork can see (handbook LLM judge, BYOK answers). DataForSEO-backed upstream
// features bill through upstream credits and are not in the estimate.

type Scope = { projectId: string; organizationId: string };

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30;

const rate = (m: { answers: number; mentioned: number } | null) =>
  m && m.answers > 0 ? { ...m, rate: m.mentioned / m.answers } : null;

async function latestHandbook(projectId: string) {
  const runs = await listRuns(projectId, 20);
  const latest = runs.find((r) => r.status === "completed");
  if (!latest) return null;
  const detail = await HandbookService.getRunDetail(projectId, latest.id);
  if (!detail) return null;
  const bySeverity: Record<string, number> = {};
  for (const f of detail.report.findings)
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  return {
    runId: latest.id,
    finishedAt: latest.finishedAt,
    grade: detail.report.score?.grade ?? null,
    score: detail.report.score?.final ?? null,
    findings: detail.report.findings.length,
    bySeverity,
    blocked: detail.report.items.filter((i) => i.status === "BLOCKED").length,
  };
}

const sumHits = (rows: { hits: number }[]) =>
  rows.reduce((n, r) => n + r.hits, 0);

async function aiTraffic(scope: Scope, now: Date) {
  if (!AiTrafficService.isAvailable()) return null;
  const sites = await AiTrafficService.listSites(scope);
  if (sites.length === 0) return null;
  const summary = await AiTrafficService.getSummary(scope, now);
  return {
    from: summary.from,
    to: summary.to,
    referrals: sumHits(summary.referrals),
    userFetches: sumHits(summary.userFetches),
    crawlersVerified: sumHits(
      summary.crawlers.filter((r) => r.verification === "verified"),
    ),
    crawlersTotal: sumHits(summary.crawlers),
  };
}

async function monthlyCost(scope: Scope, now: Date) {
  const since = new Date(now.getTime() - MONTH_DAYS * DAY_MS).toISOString();
  const [llmUsd, byok, intervalDays] = await Promise.all([
    sumHandbookLlmUsd(scope.projectId, scope.organizationId, since),
    sumByokRuns(scope.projectId, scope.organizationId, since),
    getByokIntervalDays(scope.projectId, scope.organizationId),
  ]);
  const byokUsd = byok.micros / 1_000_000;
  // Scheduled BYOK runs: last-30-day average cost per run × runs per month.
  const byokProjectedUsd =
    intervalDays && byok.runs > 0
      ? (byokUsd / byok.runs) * (MONTH_DAYS / intervalDays)
      : null;
  return {
    last30Days: { handbookLlmUsd: llmUsd, byokUsd, byokRuns: byok.runs },
    byokScheduleDays: intervalDays,
    estimateUsd: llmUsd + (byokProjectedUsd ?? byokUsd),
    excludes:
      "DataForSEO usage (keywords, audits, upstream AI visibility) is billed through OpenSEO credits; hosting is shared across projects.",
  };
}

export const OverviewService = {
  async get(scope: Scope, now = new Date()) {
    const [handbook, traffic, upstream, byok, cost] = await Promise.all([
      latestHandbook(scope.projectId),
      aiTraffic(scope, now),
      latestUpstreamMentions(scope.projectId, scope.organizationId),
      latestByokMentions(scope.projectId, scope.organizationId),
      monthlyCost(scope, now),
    ]);
    return {
      handbook,
      aiTraffic: traffic,
      aiAnswers: { upstream: rate(upstream), byok: rate(byok) },
      cost,
    };
  },
};
