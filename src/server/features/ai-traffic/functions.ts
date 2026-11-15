import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { AiTrafficService } from "./aiTrafficService";

// AI traffic server functions (ADR-013 §4). `projectId` in each validator
// triggers project authorization; the service scopes by organization too.

const projectScopeSchema = z.object({ projectId: z.string().min(1) });

export const getAiTraffic = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectScopeSchema)
  .handler(async ({ context }) => {
    const scope = {
      projectId: context.projectId,
      organizationId: context.organizationId,
    };
    const [sites, summary] = await Promise.all([
      AiTrafficService.listSites(scope),
      AiTrafficService.getSummary(scope),
    ]);
    return { available: AiTrafficService.isAvailable(), sites, summary };
  });

export const addAiTrafficSite = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId: z.string().min(1),
      vercelProjectId: z
        .string()
        .trim()
        .regex(/^prj_[A-Za-z0-9]+$/, "Vercel project ids start with prj_"),
      hosts: z.array(z.string().trim().max(253)).max(20),
    }),
  )
  .handler(async ({ data, context }) =>
    AiTrafficService.addSite({
      projectId: context.projectId,
      organizationId: context.organizationId,
      vercelProjectId: data.vercelProjectId,
      hosts: data.hosts,
    }),
  );

export const removeAiTrafficSite = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({ projectId: z.string().min(1), siteId: z.string().min(1) }),
  )
  .handler(async ({ data, context }) =>
    AiTrafficService.removeSite({
      projectId: context.projectId,
      organizationId: context.organizationId,
      siteId: data.siteId,
    }),
  );
