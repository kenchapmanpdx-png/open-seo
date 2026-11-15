import { getDatabaseProvider } from "@/db/provider";
import { AppError } from "@/server/lib/errors";
import {
  deleteSite,
  insertSite,
  listSites,
  projectExists,
  sumDaily,
  sumDiscards,
  topAiPaths,
} from "./AiTrafficRepository";
import { CRAWLER_VERIFICATION } from "./contracts";
import { DEFAULT_AI_CRAWLER_RULES, DEFAULT_AI_REFERRER_RULES } from "./rules";

// AI traffic read + site binding (ADR-013 §4). Callers pass the organization
// from their authenticated context; every query is scoped by it.

const WINDOW_DAYS = 28;
const TOP_PATHS = 20;

type Scope = { projectId: string; organizationId: string };

async function assertProject({ projectId, organizationId }: Scope) {
  if (!(await projectExists(projectId, organizationId)))
    throw new AppError("NOT_FOUND", "Project not found.");
}

const CRAWLER_RULES = new Map(DEFAULT_AI_CRAWLER_RULES.map((r) => [r.id, r]));
const REFERRER_RULES = new Map(
  DEFAULT_AI_REFERRER_RULES.map((r) => [r.domain, r]),
);

function describeRule(kind: string, ruleId: string) {
  if (kind === "referral") {
    const rule = REFERRER_RULES.get(ruleId);
    return {
      operator: rule?.operator ?? ruleId,
      product: rule?.product ?? ruleId,
      purpose: null,
    };
  }
  const rule = CRAWLER_RULES.get(ruleId);
  return {
    operator: rule?.operator ?? ruleId,
    product: rule?.product ?? ruleId,
    purpose: rule?.purpose ?? null,
  };
}

const toVerification = (value: string) =>
  CRAWLER_VERIFICATION.find((known) => known === value) ?? null;

export const AiTrafficService = {
  /** Supabase only: the drain receiver never writes to a SQLite deployment. */
  isAvailable: () => getDatabaseProvider() === "postgres",

  async listSites(scope: Scope) {
    await assertProject(scope);
    return listSites(scope.projectId, scope.organizationId);
  },

  async addSite(scope: Scope & { vercelProjectId: string; hosts: string[] }) {
    await assertProject(scope);
    const hosts = [
      ...new Set(
        scope.hosts.map((h) => h.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    return insertSite({ ...scope, hosts });
  },

  async removeSite(scope: Scope & { siteId: string }) {
    await assertProject(scope);
    await deleteSite(scope.siteId, scope.projectId, scope.organizationId);
  },

  async getSummary(scope: Scope, now = new Date()) {
    await assertProject(scope);
    const from = new Date(now.getTime() - (WINDOW_DAYS - 1) * 86_400_000);
    const fromDay = from.toISOString().slice(0, 10);
    const [daily, topPaths, discarded] = await Promise.all([
      sumDaily(scope.projectId, scope.organizationId, fromDay),
      topAiPaths(scope.projectId, scope.organizationId, fromDay, TOP_PATHS),
      sumDiscards(scope.projectId, scope.organizationId, fromDay),
    ]);
    const rows = (kind: string) =>
      daily
        .filter((row) => row.kind === kind)
        .map((row) => ({
          ...describeRule(kind, row.ruleId),
          verification: toVerification(row.verification),
          hits: row.hits,
        }))
        .sort((a, b) => b.hits - a.hits);
    // Shape of K9 `aiTrafficSummarySchema` (strict here; MCP output stays loose).
    return {
      projectId: scope.projectId,
      from: fromDay,
      to: now.toISOString().slice(0, 10),
      crawlers: rows("crawler"),
      userFetches: rows("user_fetch"),
      referrals: rows("referral"),
      topPaths,
      discarded,
    };
  },
};
