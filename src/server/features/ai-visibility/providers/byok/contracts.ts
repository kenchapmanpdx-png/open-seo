import { z } from "zod";

/**
 * K11 — BYOK AI visibility (ADR-015). Citation categories and page types are
 * Elmo's (`packages/lib/src/citations/domain-categories.ts`, MIT,
 * © 2026 Blue Whale Software, LLC).
 */

export const BYOK_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "perplexity",
] as const;
export type ByokProviderId = (typeof BYOK_PROVIDERS)[number];

// Upstream `ai_observations.engine` ↔ BYOK provider, for the comparison view.
export const ENGINE_FOR_PROVIDER = {
  openai: "chatgpt",
  anthropic: "claude",
  gemini: "gemini",
  perplexity: "perplexity",
} as const satisfies Record<ByokProviderId, string>;

export const CITATION_CATEGORIES = [
  "brand",
  "competitor",
  "editorial",
  "reviews",
  "ecommerce",
  "social",
  "developer",
  "pr",
  "reference",
  "institutional",
  "other",
] as const;

export const CITATION_PAGE_TYPES = [
  "homepage",
  "article",
  "listicle",
  "howto",
  "comparison",
  "review",
  "product",
  "doc",
  "forum",
  "video",
  "info",
  "search",
  "shopping",
  "other",
] as const;

const citationSchema = z.object({
  url: z.string().url(),
  domain: z.string().min(1),
  title: z.string().nullable(),
  position: z.number().int().nonnegative(),
});

export const byokAnswerSchema = z.object({
  provider: z.enum(BYOK_PROVIDERS),
  model: z.string().min(1),
  modelVersion: z.string().nullable(),
  answerMarkdown: z.string().nullable(),
  answerText: z.string(),
  citations: z.array(citationSchema),
  // Provider order; `[]` when the provider does not expose its searches.
  webQueries: z.array(z.string()),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    searchCalls: z.number().int().nonnegative(),
  }),
});
export type ByokAnswer = z.infer<typeof byokAnswerSchema>;

export const byokRunRequestSchema = z.object({
  projectId: z.string().min(1),
  providers: z.array(z.enum(BYOK_PROVIDERS)).min(1),
  promptIds: z.array(z.string().min(1)).max(200).optional(),
});

// One prompt × engine cell of the DataForSEO-vs-BYOK comparison.
export const aiVisibilityComparisonRowSchema = z.looseObject({
  promptId: z.string(),
  engine: z.string(),
  provider: z.enum(BYOK_PROVIDERS),
  dataforseo: z
    .looseObject({
      runId: z.string(),
      mentioned: z.boolean(),
      cited: z.boolean(),
      sources: z.number().int(),
    })
    .nullable(),
  byok: z
    .looseObject({
      runId: z.string(),
      mentioned: z.boolean(),
      cited: z.boolean(),
      sources: z.number().int(),
      fanoutQueries: z.number().int(),
    })
    .nullable(),
});
