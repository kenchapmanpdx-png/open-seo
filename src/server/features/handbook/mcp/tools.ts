import { sort } from "remeda";
import { z } from "zod";
import {
  handbookAuditRunInput,
  handbookAuditRunOutput,
  handbookFindingsGetInput,
  handbookFindingsGetOutput,
  handbookStatusExportInput,
  handbookStatusExportOutput,
} from "@/server/features/handbook/contracts/mcp";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import { renderStatusMd } from "@/server/features/handbook/export/markdown";
import { REGISTRY } from "@/server/features/handbook/registry";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import { HandbookService } from "@/server/features/handbook/services/HandbookService";
import { aiTrafficSummarySchema } from "@/server/features/ai-traffic/contracts";
import { AiTrafficService } from "@/server/features/ai-traffic/aiTrafficService";
import { bingSummaryTool } from "@/server/features/bing/bingMcpTool";
import { AppError } from "@/server/lib/errors";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse, truncatePreview } from "@/server/mcp/formatters";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import type { OpenSeoToolDefinition, ToolSchema } from "@/server/mcp/server";
import { runSiteAuditTool } from "@/server/mcp/tools/site-audit-tools";
import { buildDashboardUrl } from "@/server/mcp/urls";

// Handbook MCP tools (K8, WO-B4-011). Every handler runs inside
// withMcpProjectAuth, and every read goes through the tenant-scoped service
// (projectId + runId), so a runId from another project reads as not found.

const runPath = (projectId: string, runId: string) =>
  `/p/${projectId}/handbook/${runId}`;

/** The run's scored report; the project's latest run when runId is omitted. */
async function loadReport(projectId: string, runId?: string) {
  const id = runId ?? (await HandbookService.listRuns(projectId))[0]?.id;
  const report = id ? await HandbookService.getRunReport(projectId, id) : null;
  if (!report)
    throw new AppError(
      "NOT_FOUND",
      runId
        ? `Handbook run ${runId} not found in this project.`
        : "No handbook runs exist for this project yet. Start one with handbook_audit_run.",
    );
  return report;
}

// ------------------------------------------------------- handbook_audit_run

type AuditRunArgs = z.infer<z.ZodObject<typeof handbookAuditRunInput>>;

/**
 * A handbook run is a phase of the site audit (ADR-001), so this starts a
 * site audit through run_site_audit (same billing, limits and refusals) and
 * returns the run id the handbook phase will write (`hb-<auditId>`).
 */
const auditRunTool = {
  name: "handbook_audit_run",
  config: {
    title: "Run handbook audit",
    description:
      "Start a handbook SEO/GEO audit of the project's website: a site audit crawl followed by the handbook checks. Needs the handbook enabled in the project's settings; the mode comes from those settings. Runs in the background: poll handbook_findings_get with the returned runId until it stops reporting not found.",
    inputSchema: handbookAuditRunInput,
    outputSchema: handbookAuditRunOutput.partial(),
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    },
  },
  handler: (args: AuditRunArgs, toolContext) =>
    withMcpProjectAuth(async (a: AuditRunArgs, context) => {
      const setting = await HandbookRepository.getProjectSetting(a.projectId);
      if (!setting?.enabled)
        throw new AppError(
          "VALIDATION_ERROR",
          "The handbook is off for this project. Turn it on in the project's Handbook settings, then try again.",
        );
      if (a.mode && a.mode !== setting.mode)
        throw new AppError(
          "VALIDATION_ERROR",
          `This project's handbook mode is ${setting.mode}. Change it in the Handbook settings to run ${a.mode}.`,
        );
      if (!context.project.domain)
        throw new AppError(
          "VALIDATION_ERROR",
          "This project has no website. Set one first.",
        );
      const started = await runSiteAuditTool.handler(
        {
          projectId: a.projectId,
          url: `https://${context.project.domain}`,
          maxPages: a.maxPages && Math.max(a.maxPages, 10),
        },
        toolContext,
      );
      const audit = z
        .object({ auditId: z.string() })
        .safeParse(started.structuredContent);
      // A refusal (capacity, concurrency) started nothing: pass it through.
      if (!audit.success) return started;
      const runId = `hb-${audit.data.auditId}`;
      const dashboardUrl = buildDashboardUrl(
        context.baseUrl,
        runPath(a.projectId, runId),
      );
      return mcpResponse({
        text: `Handbook audit started (run ${runId}, mode ${setting.mode}). The crawl runs first; poll handbook_findings_get with this runId until it returns the grade.`,
        meta: buildProjectMeta(
          context,
          a.projectId,
          runPath(a.projectId, runId),
        ),
        structuredContent: { runId, status: "queued", dashboardUrl },
      });
    })(args, toolContext),
} satisfies OpenSeoToolDefinition<typeof handbookAuditRunInput>;

// ---------------------------------------------------- handbook_findings_get

type FindingsArgs = z.infer<z.ZodObject<typeof handbookFindingsGetInput>>;

// Caps that keep a 45-finding run's reply under 20 KB (text + structured).
const EXCERPT_CHARS = 200;
const FIX_CHARS = 160;
const TOP_FIXES = 10;

/** Compact grade + findings view: the agent's main read of a run. */
export const findingsGetTool = {
  name: "handbook_findings_get",
  config: {
    title: "Get handbook findings",
    description:
      "Read a handbook run: grade, phase scores, and findings (S1 most severe) with the fix for each and one evidence excerpt. Omit runId for the latest run. Filter by severity or by the status of the checklist items a finding is linked to. The grade only compares with runs on the same handbook version.",
    inputSchema: handbookFindingsGetInput,
    outputSchema: handbookFindingsGetOutput.extend({
      status: z.string(),
      capReason: z.string().nullable(),
      phases: z.array(
        z.looseObject({ phase: z.string(), score: z.number().nullable() }),
      ),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  handler: withMcpProjectAuth(async (args: FindingsArgs, context) => {
    const report = await loadReport(args.projectId, args.runId);
    const itemStatus = new Map(report.items.map((i) => [i.itemId, i.status]));
    const matching = sort(
      report.findings
        .filter((f) => !args.severity || args.severity.includes(f.severity))
        .filter(
          (f) =>
            !args.status ||
            f.itemIds.some((id) => {
              const status = itemStatus.get(id);
              return status !== undefined && args.status?.includes(status);
            }),
        ),
      (a, b) =>
        a.severity.localeCompare(b.severity) || a.code.localeCompare(b.code),
    );
    const findings = matching.slice(0, args.limit);
    const { score } = report;
    const status = report.run.finishedAt ? "completed" : "running";
    return mcpResponse({
      text: findingsText(report, findings, matching.length),
      meta: buildProjectMeta(
        context,
        args.projectId,
        runPath(args.projectId, report.run.id),
      ),
      structuredContent: {
        runId: report.run.id,
        handbookVersion: report.handbookVersion,
        status,
        grade: score?.grade ?? null,
        score: score?.final ?? null,
        capReason: score?.capReason ?? null,
        phases: (score?.phases ?? []).map((p) => ({
          phase: p.phase,
          score: p.score,
        })),
        findings: findings.map((f) => ({
          code: f.code,
          severity: f.severity,
          title: f.title,
          itemIds: f.itemIds,
          urls: f.urls.slice(0, 1),
          fix: truncatePreview(f.fix, FIX_CHARS),
          fixability: f.fixability,
        })),
        truncated: matching.length > findings.length,
      },
    });
  }),
} satisfies OpenSeoToolDefinition<typeof handbookFindingsGetInput>;

function findingsText(
  report: ReportJson,
  findings: ReportJson["findings"],
  total: number,
) {
  const { score } = report;
  const lines = [
    `Handbook run ${report.run.id} · ${report.site.origin} · ${report.run.mode} · handbook v${report.handbookVersion}`,
    score
      ? `Grade ${score.grade} (${score.final}/100)${score.capReason ? `, capped from ${score.uncapped}: ${score.capReason}` : ""}. Phases: ${score.phases.map((p) => `${p.phase} ${p.score ?? "—"}`).join(", ")}`
      : "Not scored yet.",
    `${total} matching finding(s); top fixes first:`,
  ];
  // Text covers the top fixes only; structuredContent lists every returned
  // finding. Keeps the reply under ~20 KB (WO-B4-011).
  for (const f of findings.slice(0, TOP_FIXES)) {
    lines.push(
      `${f.code} ${f.severity}${f.source === "llm" ? " (AI-reviewed)" : ""} ${f.title} — fix: ${truncatePreview(f.fix, FIX_CHARS)}`,
    );
    const evidence = f.evidence[0];
    if (evidence)
      lines.push(
        `  evidence (${evidence.kind}) ${evidence.url}: ${truncatePreview(evidence.excerpt, EXCERPT_CHARS)}`,
      );
  }
  if (findings.length > TOP_FIXES)
    lines.push(
      `${findings.length - TOP_FIXES} more in structuredContent.findings.`,
    );
  if (total > findings.length)
    lines.push(
      `${total - findings.length} more not returned; raise limit or filter.`,
    );
  return lines.join("\n");
}

// --------------------------------------------------- handbook_status_export

type ExportArgs = z.infer<z.ZodObject<typeof handbookStatusExportInput>>;

const statusExportTool = {
  name: "handbook_status_export",
  config: {
    title: "Export handbook status",
    description:
      "Export a handbook run as seo-geo-status.md (the handbook's status file) or report.json (machine-readable). Omit runId for the latest run.",
    inputSchema: handbookStatusExportInput,
    outputSchema: handbookStatusExportOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  handler: withMcpProjectAuth(async (args: ExportArgs, context) => {
    const report = await loadReport(args.projectId, args.runId);
    const content =
      args.format === "report-json"
        ? JSON.stringify(report)
        : renderStatusMd(report, REGISTRY);
    return mcpResponse({
      text: content,
      meta: buildProjectMeta(
        context,
        args.projectId,
        runPath(args.projectId, report.run.id),
      ),
      structuredContent: {
        runId: report.run.id,
        format: args.format,
        content,
      },
    });
  }),
} satisfies OpenSeoToolDefinition<typeof handbookStatusExportInput>;

// -------------------------------------------------- handbook_report_publish

const publishInput = {
  projectId: projectIdSchema,
  runId: z.string().min(1).describe("Handbook run ID."),
} as const;
type PublishArgs = z.infer<z.ZodObject<typeof publishInput>>;

/** Not in K8: added by WO-B4-011 (publish flow for the skill). */
const reportPublishTool = {
  name: "handbook_report_publish",
  config: {
    title: "Save handbook client report",
    description:
      "Save a completed handbook run's client report into the project's Reports (private; re-publishing the same run replaces it). Uses no credits.",
    inputSchema: publishInput,
    outputSchema: z.looseObject({ reportId: z.string(), url: z.string() }),
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: true,
    },
  },
  handler: withMcpProjectAuth(async (args: PublishArgs, context) => {
    const saved = await HandbookService.publishToReports({
      projectId: args.projectId,
      organizationId: context.auth.organizationId,
      userId: context.auth.userId,
      runId: args.runId,
    });
    const path = `/p/${args.projectId}/reports/${saved.reportId}`;
    const url = buildDashboardUrl(context.baseUrl, path);
    return mcpResponse({
      text: `${saved.created ? "Saved" : "Replaced"} report "${saved.title}". Open it at ${url}.`,
      meta: buildProjectMeta(context, args.projectId, path),
      structuredContent: { reportId: saved.reportId, url },
    });
  }),
} satisfies OpenSeoToolDefinition<typeof publishInput>;

// ------------------------------------------------------- ai_traffic_summary

const aiTrafficInput = { projectId: projectIdSchema } as const;
type AiTrafficArgs = z.infer<z.ZodObject<typeof aiTrafficInput>>;

function countLine(
  label: string,
  rows: Array<{
    product: string;
    verification: string | null;
    hits: number;
  }>,
) {
  return `${label}: ${
    rows
      .map(
        (row) =>
          `${row.product}${row.verification ? ` (${row.verification})` : ""} ${row.hits}`,
      )
      .join(", ") || "none"
  }`;
}

/** WO-B6-014 (ADR-013 §4): AI crawler / agent / referral hits, last 28 days. */
const aiTrafficSummaryTool = {
  name: "ai_traffic_summary",
  config: {
    title: "AI traffic summary",
    description:
      "AI crawler hits (by operator, purpose and IP verification), AI user fetches, AI referral visits and the most-hit paths for the last 28 days, from the project's Vercel log drain. Only 'verified' hits come from the operator's published IP ranges. Uses no credits.",
    inputSchema: aiTrafficInput,
    outputSchema: aiTrafficSummarySchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  handler: withMcpProjectAuth(async (args: AiTrafficArgs, context) => {
    const summary = await AiTrafficService.getSummary({
      projectId: args.projectId,
      organizationId: context.auth.organizationId,
    });
    return mcpResponse({
      text: [
        `AI traffic ${summary.from} → ${summary.to}`,
        countLine("Crawlers", summary.crawlers),
        countLine("User fetches", summary.userFetches),
        countLine("Referrals", summary.referrals),
        `Non-AI requests discarded at the edge: ${summary.discarded}`,
      ].join("\n"),
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/handbook/ai-traffic`,
      ),
      structuredContent: summary,
    });
  }),
} satisfies OpenSeoToolDefinition<typeof aiTrafficInput>;

/**
 * Registers the handbook tools with the caller's `register` (the same
 * callback `registerOpenSeoTools` receives). Hooked up in B5.
 */
export function registerHandbookTools(
  register: <Input extends ToolSchema>(
    tool: OpenSeoToolDefinition<Input>,
  ) => void,
) {
  register(auditRunTool);
  register(findingsGetTool);
  register(statusExportTool);
  register(reportPublishTool);
  register(aiTrafficSummaryTool);
  register(bingSummaryTool);
}
