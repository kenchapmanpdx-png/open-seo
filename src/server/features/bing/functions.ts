import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { BingService } from "./bingService";

// Bing server functions (ADR-014 §4). `projectId` in each validator triggers
// project authorization; the service scopes by organization too.

const projectId = z.string().min(1);
const MAX_CSV_BYTES = 5_000_000;

const scopeOf = (context: { projectId: string; organizationId: string }) => ({
  projectId: context.projectId,
  organizationId: context.organizationId,
});

export const getBing = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) => {
    const scope = scopeOf(context);
    const [page, summary] = await Promise.all([
      BingService.getPage(scope),
      BingService.getSummary(scope),
    ]);
    return { ...page, summary };
  });

export const setBingApiKey = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId, key: z.string().trim().min(8).max(200) }))
  .handler(async ({ data, context }) =>
    BingService.setKey(scopeOf(context), data.key),
  );

export const deleteBingApiKey = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) => BingService.deleteKey(scopeOf(context)));

export const listBingSites = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId }))
  .handler(async ({ context }) =>
    BingService.listBindableSites(scopeOf(context)),
  );

export const bindBingSite = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId, siteUrl: z.string().url() }))
  .handler(async ({ data, context }) =>
    BingService.bindSite({ ...scopeOf(context), siteUrl: data.siteUrl }),
  );

export const unbindBingSite = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(z.object({ projectId, siteId: z.string().min(1) }))
  .handler(async ({ data, context }) =>
    BingService.unbindSite({ ...scopeOf(context), siteId: data.siteId }),
  );

export const importBingAiCsv = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    z.object({
      projectId,
      fileName: z.string().min(1).max(200),
      csv: z.string().min(1).max(MAX_CSV_BYTES),
    }),
  )
  .handler(async ({ data, context }) =>
    BingService.importCsv({
      ...scopeOf(context),
      userId: context.userId,
      fileName: data.fileName,
      csv: data.csv,
    }),
  );
