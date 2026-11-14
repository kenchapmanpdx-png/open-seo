import { z } from "zod";

/**
 * K5 — LLM judge (ADR-007). Design frozen in B1, implemented in B3.
 * Page text is untrusted: fixed rubric prompt, text as data, no tools,
 * schema-validated output, quotes verified as substrings of fetched text.
 */

export const llmVerdictSchema = z.object({
  verdict: z.enum(["pass", "fail", "unsure"]),
  quotes: z
    .array(z.object({ url: z.string().url(), text: z.string().min(1) }))
    .max(10),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(1_000),
});
export type LlmVerdict = z.infer<typeof llmVerdictSchema>;

export type JudgeInput = {
  itemId: string;
  rubricId: string;
  /** Fetched page texts the judge may quote from, keyed by URL. */
  pages: ReadonlyArray<{ url: string; text: string }>;
  /** Extra structured facts (e.g. cross-page fact table rows). */
  facts?: Record<string, unknown>;
  model?: string;
};

export type JudgeResult = LlmVerdict & {
  quotesVerified: boolean;
  call: {
    model: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    promptSha256: string;
  };
};

export type Judge = (input: JudgeInput) => Promise<JudgeResult>;

export type QuoteVerifier = (
  quote: { url: string; text: string },
  pages: ReadonlyArray<{ url: string; text: string }>,
) => boolean;

export const LLM_BUDGET_ENV = "HANDBOOK_LLM_BUDGET_USD";
export const LLM_DEFAULT_BUDGET_USD = 1;
