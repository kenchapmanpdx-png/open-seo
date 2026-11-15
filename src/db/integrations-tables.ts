import { getDatabaseProvider } from "./provider";
import * as sqliteIntegrations from "./integrations.schema";
import * as pgIntegrations from "./pg/integrations.schema";

// Provider-aware fork integration tables (ADR-013…017), same pattern as
// ./handbook-tables.ts. Typed as the SQLite definitions;
// ./integrations-schema-parity.test.ts guards the cast.
const runtime =
  getDatabaseProvider() === "postgres" ? pgIntegrations : sqliteIntegrations;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- guarded by integrations-schema-parity.test.ts
const schema = runtime as unknown as typeof sqliteIntegrations;

export const {
  aiTrafficSites,
  aiTrafficSiteHosts,
  aiTrafficEvents,
  aiTrafficClasses,
  aiTrafficDaily,
  aiTrafficDiscards,
  bingCredentials,
  bingSites,
  bingSyncState,
  bingDailyTraffic,
  bingQueryWeeks,
  bingPageWeeks,
  bingCrawlIssues,
  bingAiImports,
  bingAiCitationDays,
  bingAiGroundingQueries,
  byokAiCredentials,
  byokAiTrackerProviders,
  byokAiSchedules,
  byokAiRuns,
  byokAiAnswers,
  byokAiSources,
  byokAiMatches,
  aiWebQueries,
  aiSourceCategories,
  ccReleases,
  ccTargets,
  ccBacklinkSummaries,
  ccBacklinkDomains,
  agencyClients,
  agencyBrands,
  outcomeBatches,
  outcomeBatchClasses,
  outcomeChecks,
  outcomeMetrics,
} = schema;
