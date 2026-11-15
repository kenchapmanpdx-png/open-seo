import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { AgencyService } from "./agencyService";
import { renderFollowupsMd } from "@/server/features/handbook/export/followups";
import {
  HANDBOOK_VERSION,
  REGISTRY,
} from "@/server/features/handbook/registry";
import { agencyBrandSchema, agencyClientSchema } from "./contracts";
import { OutcomeService } from "./outcomeService";
import { OverviewService } from "./overviewService";

// Agency settings server functions (ADR-017 §1–2). `projectId` in each
// validator triggers project authorization; the service scopes by org too.

const projectId = z.string().min(1);
// Base64 of a logo; larger logos are accepted but not stored (text fallback).
const MAX_LOGO_BASE64 = 2_000_000;

export const getAgencySettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) =>
    AgencyService.getSettings({
      projectId: context.projectId,
      organizationId: context.organizationId,
    }),
  );

export const saveAgencyBrand = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    agencyBrandSchema.extend({
      projectId,
      logo: z
        .object({
          contentType: z.string().max(40),
          base64: z.base64().max(MAX_LOGO_BASE64),
        })
        .nullable(),
      removeLogo: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { projectId: _projectId, ...brand } = data;
    return AgencyService.saveBrand(
      {
        projectId: context.projectId,
        organizationId: context.organizationId,
        userId: context.userId,
      },
      brand,
    );
  });

export const saveAgencyClient = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(agencyClientSchema)
  .handler(async ({ data, context }) => {
    const { projectId: _projectId, ...client } = data;
    return AgencyService.saveClient(
      { projectId: context.projectId, organizationId: context.organizationId },
      client,
    );
  });

// Outcome record (ADR-017 §3): record a fix batch from a run's findings, and
// export `seo-followups.md`.

export const recordOutcomeFixBatch = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId,
      runId: z.string().min(1),
      // Empty = every finding of the run.
      findingCodes: z.array(z.string().min(1).max(80)).max(500),
    }),
  )
  .handler(async ({ data, context }) =>
    OutcomeService.recordFixBatch(
      { projectId: context.projectId, organizationId: context.organizationId },
      { runId: data.runId, findingCodes: data.findingCodes },
    ),
  );

export const getOutcomeFollowupsMd = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) =>
    renderFollowupsMd(
      await OutcomeService.getOutcomeRecord({
        projectId: context.projectId,
        organizationId: context.organizationId,
      }),
      REGISTRY,
      HANDBOOK_VERSION,
    ),
  );

export const getProjectOverview = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) =>
    OverviewService.get({
      projectId: context.projectId,
      organizationId: context.organizationId,
    }),
  );
