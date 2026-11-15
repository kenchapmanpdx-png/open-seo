import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { CcService } from "./ccService";

// Common Crawl baseline server functions (ADR-016 §4). `projectId` in each
// validator triggers project authorization; the service scopes by org too.

const projectId = z.string().min(1);

export const getCcBaseline = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) =>
    CcService.getBaseline({
      projectId: context.projectId,
      organizationId: context.organizationId,
    }),
  );

export const setCcEnabled = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId, enabled: z.boolean() }))
  .handler(async ({ data, context }) =>
    CcService.setTargetEnabled(
      { projectId: context.projectId, organizationId: context.organizationId },
      data.enabled,
    ),
  );
