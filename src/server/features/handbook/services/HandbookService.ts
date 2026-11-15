import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getOpenRouterAccess } from "@/server/lib/openrouter";
import { getOptionalEnvValue, getWorkersEnv } from "@/server/lib/runtime-env";
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
import {
  createSupabaseEvidenceStore,
  createSupabaseSignedUrl,
} from "@/server/features/handbook/engine/supabase-evidence-store";
import { LLM_BUDGET_ENV } from "@/server/features/handbook/contracts/llm";
import type { LlmCallLog } from "@/server/features/handbook/llm/judge";
import {
  createHandbookJudge,
  HANDBOOK_LLM_MODEL_ENV,
  parseBudgetUsd,
} from "@/server/features/handbook/llm/model";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import { getReportRows } from "@/server/features/handbook/repositories/HandbookReportRepository";
import {
  REPORT_JSON_VERSION,
  reportJsonSchema,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import { scoreReport } from "@/server/features/handbook/engine/report";
import { renderClientReportHtml } from "@/server/features/handbook/export/client-report";
import { ReportRepository } from "@/server/features/reports/repositories/ReportRepository";
import { AgencyService } from "@/server/features/agency/agencyService";
import { ReportService } from "@/server/features/reports/services/ReportService";
import { AppError } from "@/server/lib/errors";

const DEFAULT_MAX_PAGES = 200;
const SIGNED_URL_SECONDS = 300;

async function supabaseConfig() {
  const url = await getOptionalEnvValue("SUPABASE_URL");
  const serviceRoleKey = await getOptionalEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

async function evidenceStore(): Promise<EvidenceStore> {
  const config = await supabaseConfig();
  if (config) return createSupabaseEvidenceStore(config);
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

/**
 * A run plus its scored report.json, for the run page and the MCP tools.
 * Null when the run is not in `projectId` (tenant scoping).
 */
async function getRunDetail(projectId: string, runId: string) {
  const rows = await getReportRows(projectId, runId);
  if (!rows) return null;
  return { run: rows.run, report: buildReport(rows) };
}

/**
 * A stored run as K7 report.json (WO-B4-009), scored with K6. Tier evidence
 * and checker errors are not persisted, so they read "" and []. Null when
 * the run is not in `projectId`.
 */
async function getRunReport(
  projectId: string,
  runId: string,
): Promise<ReportJson | null> {
  const rows = await getReportRows(projectId, runId);
  return rows ? buildReport(rows) : null;
}

function buildReport(
  rows: NonNullable<Awaited<ReturnType<typeof getReportRows>>>,
): ReportJson {
  const { run } = rows;
  const phaseOf = new Map(REGISTRY.map((e) => [e.id, e.phase]));
  const codesByItem = new Map<string, string[]>();
  const codeOf = new Map(rows.findings.map((f) => [f.id, f.code]));
  for (const fi of rows.findingItems) {
    const code = codeOf.get(fi.findingId);
    if (code)
      codesByItem.set(fi.itemId, [...(codesByItem.get(fi.itemId) ?? []), code]);
  }
  const findings = rows.findings.map((f) => ({
    code: f.code,
    severity: f.severity,
    phase: f.phase,
    sectionRef: f.sectionRef ?? "",
    title: f.title,
    detail: f.detail,
    fix: f.fix,
    fixability: f.fixability,
    limitedReason: f.limitedReason,
    effort: f.effort,
    source: f.source,
    itemIds: rows.findingItems
      .filter((x) => x.findingId === f.id)
      .map((x) => x.itemId),
    urls: rows.findingUrls
      .filter((x) => x.findingId === f.id)
      .map((x) => x.url),
    evidence: rows.evidence
      .filter((e) => e.findingId === f.id)
      .map((e) => ({ kind: e.kind, url: e.url, excerpt: e.excerpt })),
  }));
  const s1 = findings.filter((f) => f.severity === "S1" && f.source !== "llm");
  const report = reportJsonSchema.parse({
    reportVersion: REPORT_JSON_VERSION,
    contractsVersion: run.contractsVersion,
    handbookVersion: run.handbookVersion,
    generatedAt: run.finishedAt ?? run.startedAt,
    site: {
      origin: run.origin,
      platform:
        rows.items
          .find((i) => i.itemId === "P0-03")
          ?.note?.match(/^platform: (.+?) \(/)?.[1] ?? null,
    },
    run: {
      id: run.id,
      mode: run.mode,
      tier: run.tier ?? "T1",
      tierEvidence: "",
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    },
    score: null,
    siteProfile: rows.siteProfile.map((sp) => ({
      code: sp.spCode,
      value: sp.value,
      evidence: sp.evidence,
      confidence: sp.confidence,
    })),
    findings,
    items: rows.items.map((i) => ({
      itemId: i.itemId,
      phase: phaseOf.get(i.itemId) ?? "",
      status: i.status,
      note: i.note,
      findingCodes: codesByItem.get(i.itemId) ?? [],
    })),
    release: {
      status:
        run.mode === "REVIEW"
          ? "NOT_APPLICABLE"
          : s1.length > 0
            ? "RELEASE_BLOCKED"
            : "CLEAR",
      blockingItemIds: [...new Set(s1.flatMap((f) => f.itemIds))],
    },
    checkerErrors: [],
    outsideScope: [],
  });
  return { ...report, score: scoreReport(report) };
}

/**
 * Saves the run's client report (WO-B4-008) into upstream Reports, so list,
 * view, print and delete come for free. Re-publishing a run updates the
 * report with the same title. `skill: "handbook-audit"` is the attribution
 * contract; the caller passes the authenticated user.
 */
async function publishToReports(input: {
  projectId: string;
  organizationId: string;
  userId: string;
  runId: string;
}) {
  const report = await getRunReport(input.projectId, input.runId);
  if (!report) throw new AppError("NOT_FOUND", "Handbook run not found");
  const host = new URL(report.site.origin).host;
  const title = `Handbook review — ${host} — ${report.generatedAt.slice(0, 10)} (${report.run.id.slice(0, 8)})`;
  const existing = await ReportRepository.findReportByTitle(
    input.projectId,
    title,
  );
  return ReportService.saveReport({
    projectId: input.projectId,
    organizationId: input.organizationId,
    ...(existing ? { reportId: existing.id } : {}),
    title,
    summary: `${report.score?.grade ?? "?"} · ${report.findings.length} findings`,
    html: renderClientReportHtml(report, REGISTRY, {
      brand: await AgencyService.getBrandForRender(input.organizationId),
    }),
    skill: "handbook-audit",
    createdBy: "handbook",
    createdByUserId: input.userId,
  });
}

/**
 * One evidence excerpt plus a short-lived signed URL to the full body.
 * Null when the evidence does not belong to `projectId` (tenant scoping).
 */
async function getEvidence(projectId: string, evidenceId: string) {
  const evidence = await HandbookRepository.getEvidence(projectId, evidenceId);
  if (!evidence) return null;
  const config = evidence.storageKey ? await supabaseConfig() : null;
  const bodyUrl =
    config && evidence.storageKey
      ? await createSupabaseSignedUrl(
          config,
          evidence.storageKey,
          SIGNED_URL_SECONDS,
        )
      : null;
  return { ...evidence, bodyUrl };
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
  const llmCalls: LlmCallLog[] = [];
  const access = getOpenRouterAccess((await getWorkersEnv()) ?? {});
  const judge = access
    ? createHandbookJudge({
        access,
        modelId: await getOptionalEnvValue(HANDBOOK_LLM_MODEL_ENV),
        budgetUsd: parseBudgetUsd(await getOptionalEnvValue(LLM_BUDGET_ENV)),
        log: async (call) => {
          llmCalls.push(call);
        },
      })
    : null;
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
        judge,
      },
      {
        projectId: input.projectId,
        fetch: createSafeFetch({
          allowedHosts: siblingHosts(new URL(input.origin).host),
        }),
        fetchOffsite: createSafeFetch({
          allowedHosts: "any",
          maxBytes: 256 * 1024,
        }),
        store: await evidenceStore(),
        log: (event, fields) => console.log(event, fields),
      },
    );
    await HandbookRepository.saveRunResult(input.runId, result);
    await HandbookRepository.saveLlmCalls(input.runId, llmCalls);
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
  getRunReport,
  publishToReports,
  listEvidence: (projectId: string, runId: string) =>
    HandbookRepository.listEvidence(projectId, runId),
  getEvidence,
  executeRun,
  listCrawledUrls: (auditId: string) =>
    HandbookRepository.listCrawledUrls(auditId),
} as const;
