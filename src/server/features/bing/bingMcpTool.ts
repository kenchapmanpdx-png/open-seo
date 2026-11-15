import type { z } from "zod";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import type { OpenSeoToolDefinition } from "@/server/mcp/server";
import { BingService } from "./bingService";
import { bingSummarySchema } from "./contracts";

// WO-B6-023 (ADR-014 §4): read-only Bing summary; registered in the fork's
// `registerHandbookTools`.

const bingInput = { projectId: projectIdSchema } as const;
type BingArgs = z.infer<z.ZodObject<typeof bingInput>>;

export const bingSummaryTool = {
  name: "bing_summary",
  config: {
    title: "Bing summary",
    description:
      "Bing Webmaster Tools state for the project's bound site: verification, last daily sync (and its error), clicks and impressions for the last 28 days, blocking crawl issues, and Copilot citations from the last imported AI Performance CSV. Uses no credits.",
    inputSchema: bingInput,
    outputSchema: bingSummarySchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  handler: withMcpProjectAuth(async (args: BingArgs, context) => {
    const summary = await BingService.getSummary({
      projectId: args.projectId,
      organizationId: context.auth.organizationId,
    });
    const text = summary.siteUrl
      ? [
          `Bing site ${summary.siteUrl} (${summary.verified ? "verified" : "not verified"})`,
          `Last sync: ${summary.lastSyncAt ?? "never"}${summary.lastError ? ` · error: ${summary.lastError}` : ""}`,
          `28 days: ${summary.clicks28d ?? "—"} clicks, ${summary.impressions28d ?? "—"} impressions`,
          `Blocking crawl issues: ${summary.blockingCrawlIssues}`,
          `AI citations (28 days): ${summary.aiCitations28d ?? "—"} · last CSV import: ${summary.aiLastImportAt ?? "never"}`,
        ].join("\n")
      : "No Bing Webmaster Tools site is bound to this project.";
    return mcpResponse({
      text,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/handbook/bing`,
      ),
      structuredContent: summary,
    });
  }),
} satisfies OpenSeoToolDefinition<typeof bingInput>;
