import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import {
  HANDBOOK_VERSION,
  REGISTRY,
} from "@/server/features/handbook/registry";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import type {
  HandbookMode,
  SiteTier,
} from "@/server/features/handbook/contracts/status";
import { createDefaultCollectors } from "@/server/features/handbook/collectors";
import { HANDBOOK_CHECKS } from "@/server/features/handbook/checks";
import { runHandbook } from "@/server/features/handbook/engine/runner";
import {
  createSafeFetch,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { createSupabaseEvidenceStore } from "@/server/features/handbook/engine/supabase-evidence-store";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";

const DEFAULT_MAX_PAGES = 200;

async function evidenceStore(): Promise<EvidenceStore> {
  const url = await getOptionalEnvValue("SUPABASE_URL");
  const key = await getOptionalEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (url && key)
    return createSupabaseEvidenceStore({ url, serviceRoleKey: key });
  // ADR-003 fallback: excerpts still land in handbook_evidence; bodies are dropped.
  console.warn(
    "handbook: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing; evidence bodies not persisted",
  );
  return createMemoryEvidenceStore();
}

async function getSettings(projectId: string) {
  const row = await HandbookRepository.getProjectSetting(projectId);
  return {
    enabled: row?.enabled ?? false,
    mode: row?.mode ?? ("AUDIT" as const),
    tierOverride: row?.tierOverride ?? null,
  };
}

async function updateSettings(input: {
  projectId: string;
  enabled: boolean;
  mode: HandbookMode;
  tierOverride: SiteTier | null;
}) {
  await HandbookRepository.upsertProjectSetting(input);
  return getSettings(input.projectId);
}

async function getRunDetail(projectId: string, runId: string) {
  const run = await HandbookRepository.getRun(projectId, runId);
  if (!run) return null;
  const [items, findings] = await Promise.all([
    HandbookRepository.listItemStatuses(projectId, runId),
    HandbookRepository.listFindings(projectId, runId),
  ]);
  return { run, items, findings };
}

/**
 * One full handbook run for a project, persisted (ADR-001 workflow adapter).
 * `seedUrls` = the upstream crawl's URLs; the crawl still follows links up to
 * the cap so pages upstream skipped are covered too.
 */
async function executeRun(input: {
  runId: string;
  projectId: string;
  auditId: string | null;
  origin: string;
  seedUrls: readonly string[];
  mode: HandbookMode;
  tierOverride: SiteTier | null;
}) {
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project) throw new Error("handbook: project not found");
  await HandbookRepository.createRun({
    id: input.runId,
    projectId: input.projectId,
    organizationId: project.organizationId,
    auditId: input.auditId,
    origin: input.origin,
    handbookVersion: HANDBOOK_VERSION,
    contractsVersion: CONTRACTS_VERSION,
    mode: input.mode,
  });
  try {
    const result = await runHandbook(
      {
        runId: input.runId,
        origin: input.origin,
        mode: input.mode,
        tierOverride: input.tierOverride,
        registry: REGISTRY,
        collectors: createDefaultCollectors({
          seedUrls: input.seedUrls,
          followLinks: true,
          maxPages: DEFAULT_MAX_PAGES,
        }),
        checks: HANDBOOK_CHECKS,
        maxPages: DEFAULT_MAX_PAGES,
      },
      {
        projectId: input.projectId,
        fetch: createSafeFetch({
          allowedHosts: siblingHosts(new URL(input.origin).host),
        }),
        store: await evidenceStore(),
        log: (event, fields) => console.log(event, fields),
      },
    );
    await HandbookRepository.saveRunResult(input.runId, result);
    await HandbookRepository.finishRun({
      projectId: input.projectId,
      runId: input.runId,
      status: "completed",
      tier: result.intake.tier,
    });
    return {
      runId: input.runId,
      findings: result.findings.length,
      items: result.statuses.length,
    };
  } catch (error) {
    await HandbookRepository.finishRun({
      projectId: input.projectId,
      runId: input.runId,
      status: "failed",
      errorCode:
        error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    throw error;
  }
}

export const HandbookService = {
  getSettings,
  updateSettings,
  listRuns: (projectId: string) => HandbookRepository.listRuns(projectId),
  getRunDetail,
  executeRun,
  listCrawledUrls: (auditId: string) =>
    HandbookRepository.listCrawledUrls(auditId),
} as const;
