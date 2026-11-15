import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { ByokViewService } from "./byokViewService";
import { BYOK_PROVIDERS } from "./contracts";

// BYOK AI visibility server functions (ADR-015). `projectId` in each validator
// triggers project authorization; the service scopes by organization too.

const projectId = z.string().min(1);
const provider = z.enum(BYOK_PROVIDERS);

const scopeOf = (context: { projectId: string; organizationId: string }) => ({
  projectId: context.projectId,
  organizationId: context.organizationId,
});

export const getByokPage = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) => ByokViewService.getPage(scopeOf(context)));

export const setByokApiKey = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId,
      provider,
      key: z.string().trim().min(8).max(400).nullable(),
    }),
  )
  .handler(async ({ data, context }) =>
    ByokViewService.setKey(scopeOf(context), data.provider, data.key),
  );

export const setByokProvider = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId,
      provider,
      model: z
        .string()
        .trim()
        .regex(/^[\w.:/-]{1,100}$/)
        .nullable(),
    }),
  )
  .handler(async ({ data, context }) =>
    ByokViewService.setProvider(scopeOf(context), data.provider, data.model),
  );

export const setByokSchedule = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId,
      intervalDays: z.number().int().min(1).max(90).nullable(),
    }),
  )
  .handler(async ({ data, context }) =>
    ByokViewService.setSchedule(scopeOf(context), data.intervalDays),
  );

export const runByokNow = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) => ByokViewService.runNow(scopeOf(context)));
