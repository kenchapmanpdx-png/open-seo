import { z } from "zod";
import { buildProjectMeta } from "@/server/mcp/context";
import { mcpResponse } from "@/server/mcp/formatters";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { projectIdSchema } from "@/server/mcp/schemas";
import type { OpenSeoToolDefinition } from "@/server/mcp/server";
import { ByokViewService } from "./byokViewService";
import { aiVisibilityComparisonRowSchema } from "./contracts";

// WO-B6-033 (ADR-015 §1): read-only DataForSEO-vs-BYOK comparison; registered
// in the fork's `registerHandbookTools`.

const comparisonInput = { projectId: projectIdSchema } as const;
type ComparisonArgs = z.infer<z.ZodObject<typeof comparisonInput>>;

const comparisonOutput = z.looseObject({
  byokRunId: z.string().nullable(),
  upstreamRunId: z.string().nullable(),
  rows: z.array(aiVisibilityComparisonRowSchema),
});

export const byokComparisonTool = {
  name: "byok_ai_comparison",
  config: {
    title: "AI visibility: DataForSEO vs own API keys",
    description:
      "Compares the latest AI visibility run made with the organization's own provider keys (OpenAI, Anthropic, Gemini, Perplexity) against the closest-dated DataForSEO run, per prompt and engine: own-brand mention, citation, first-mention offset, source count and category mix, and BYOK fan-out query count. Uses no credits.",
    inputSchema: comparisonInput,
    outputSchema: comparisonOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  handler: withMcpProjectAuth(async (args: ComparisonArgs, context) => {
    const result = await ByokViewService.getComparison({
      projectId: args.projectId,
      organizationId: context.auth.organizationId,
    });
    const rows = result?.rows ?? [];
    const count = (pick: (row: (typeof rows)[number]) => boolean) =>
      rows.filter(pick).length;
    const text = result
      ? [
          `BYOK run ${result.byokRun.id} (${result.byokRun.startedAt}) vs DataForSEO run ${result.upstreamRun?.id ?? "none"}`,
          `${rows.length} prompt × provider rows · mentioned: BYOK ${count((r) => !!r.byok?.mentioned)}, DataForSEO ${count((r) => !!r.dataforseo?.mentioned)} · cited: BYOK ${count((r) => !!r.byok?.cited)}, DataForSEO ${count((r) => !!r.dataforseo?.cited)}`,
        ].join("\n")
      : "No completed BYOK run for this project yet.";
    return mcpResponse({
      text,
      meta: buildProjectMeta(
        context,
        args.projectId,
        `/p/${args.projectId}/handbook/ai-visibility-byok`,
      ),
      structuredContent: {
        byokRunId: result?.byokRun.id ?? null,
        upstreamRunId: result?.upstreamRun?.id ?? null,
        rows,
      },
    });
  }),
} satisfies OpenSeoToolDefinition<typeof comparisonInput>;
