import type { z } from "zod";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import type { OpenSeoToolDefinition } from "@/server/mcp/server";
import { CcService } from "./ccService";
import { ccBacklinkSummarySchema } from "./contracts";

// WO-B6-042 (ADR-016 §4): read-only Common Crawl backlink baseline; registered
// in the fork's `registerHandbookTools`.

const ccInput = { projectId: projectIdSchema } as const;
type CcArgs = z.infer<z.ZodObject<typeof ccInput>>;

export const ccBacklinksTool = {
  name: "cc_backlinks_get",
  config: {
    title: "Common Crawl backlink baseline",
    description:
      "Domain-level backlink baseline from the Common Crawl hyperlink graph (imported monthly, 3-month release windows): referring domains this vs the previous release, new and lost linking domains, top linking domains by host count, and the competitor gap (domains linking to tracked competitors but not to the project). No URLs, anchors or nofollow data. Uses no credits.",
    inputSchema: ccInput,
    outputSchema: ccBacklinkSummarySchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  handler: withMcpProjectAuth(async (args: CcArgs, context) => {
    const baseline = await CcService.getBaseline({
      projectId: args.projectId,
      organizationId: context.auth.organizationId,
    });
    const text = baseline.releaseId
      ? [
          `Common Crawl ${baseline.releaseWindow} (${baseline.releaseId}) for ${baseline.domain}`,
          `Referring domains: ${baseline.referringDomains}${baseline.previousReferringDomains === null ? "" : ` (previous release ${baseline.previousReferringDomains}; +${baseline.newDomains} new, −${baseline.lostDomains} lost)`}`,
          `Top linking domains: ${baseline.topLinkingDomains
            .slice(0, 10)
            .map((d) => d.domain)
            .join(", ")}`,
          `Competitor gap: ${baseline.competitorGap.length} domains link to ${baseline.competitors.join(", ") || "no tracked competitors"} but not to the project`,
        ].join("\n")
      : `No Common Crawl import for ${baseline.domain || "this project"} yet${baseline.enabled ? "" : " (not enabled)"}.`;
    return mcpResponse({
      text,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/handbook/backlinks-cc`,
      ),
      structuredContent: baseline,
    });
  }),
} satisfies OpenSeoToolDefinition<typeof ccInput>;
