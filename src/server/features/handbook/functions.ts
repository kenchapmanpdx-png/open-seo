import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { HandbookService } from "@/server/features/handbook/services/HandbookService";
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
