import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { HandbookService } from "@/server/features/handbook/services/HandbookService";
import { renderStatusMd } from "@/server/features/handbook/export/markdown";
import { REGISTRY } from "@/server/features/handbook/registry";
import { AppError } from "@/server/lib/errors";
import {
  handbookModeSchema,
  siteTierSchema,
} from "@/server/features/handbook/contracts/status";

// Handbook server functions (ADR-009 tenant rule): `projectId` in each
// validator triggers project authorization; the service never authorizes.

const projectScopeSchema = z.object({ projectId: z.string().min(1) });

export const getHandbookSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectScopeSchema)
  .handler(async ({ context }) =>
    HandbookService.getSettings(context.projectId),
  );

export const updateHandbookSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId: z.string().min(1),
      enabled: z.boolean(),
      // REVIEW is an external read-only assessment, not a project setting.
      mode: handbookModeSchema.exclude(["REVIEW"]),
      tierOverride: siteTierSchema.nullable(),
    }),
  )
  .handler(async ({ data, context }) =>
    HandbookService.updateSettings({
      projectId: context.projectId,
      enabled: data.enabled,
      mode: data.mode,
      tierOverride: data.tierOverride,
    }),
  );

export const listHandbookRuns = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectScopeSchema)
  .handler(async ({ context }) => HandbookService.listRuns(context.projectId));

export const getHandbookRun = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({ projectId: z.string().min(1), runId: z.string().min(1) }),
  )
  .handler(async ({ data, context }) =>
    HandbookService.getRunDetail(context.projectId, data.runId),
  );

export const listHandbookEvidence = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({ projectId: z.string().min(1), runId: z.string().min(1) }),
  )
  .handler(async ({ data, context }) =>
    HandbookService.listEvidence(context.projectId, data.runId),
  );

export const getHandbookEvidence = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({ projectId: z.string().min(1), evidenceId: z.string().min(1) }),
  )
  .handler(async ({ data, context }) =>
    HandbookService.getEvidence(context.projectId, data.evidenceId),
  );

const runScopeSchema = z.object({
  projectId: z.string().min(1),
  runId: z.string().min(1),
});

/** report.json + seo-geo-status.md of one run, for downloads (WO-B4-009). */
export const getHandbookRunExports = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(runScopeSchema)
  .handler(async ({ data, context }) => {
    const report = await HandbookService.getRunReport(
      context.projectId,
      data.runId,
    );
    if (!report) throw new AppError("NOT_FOUND", "Handbook run not found");
    return {
      reportJson: JSON.stringify(report, null, 2),
      statusMd: renderStatusMd(report, REGISTRY),
    };
  });

/** Saves the run's client report into the project's Reports (WO-B4-009). */
export const publishHandbookReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(runScopeSchema)
  .handler(async ({ data, context }) =>
    HandbookService.publishToReports({
      projectId: context.projectId,
      organizationId: context.organizationId,
      userId: context.userId,
      runId: data.runId,
    }),
  );

/** Live stage / pages / escalations / spend for the run page (WO-B9-024). */
export const getHandbookRunProgress = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(runScopeSchema)
  .handler(async ({ data, context }) => {
    const progress = await HandbookService.getRunProgress(
      context.projectId,
      data.runId,
    );
    if (!progress) throw new AppError("NOT_FOUND", "Handbook run not found");
    return progress;
  });
