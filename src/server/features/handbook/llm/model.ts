import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { wrapLanguageModel } from "ai";
import type { OpenRouterAccess } from "@/server/lib/openrouter";
import {
  LLM_DEFAULT_BUDGET_USD,
  type Judge,
} from "@/server/features/handbook/contracts/llm";
import { createJudge, type LlmCallLog, type ModelPrice } from "./judge";
import { RUBRICS } from "./rubrics";

/**
 * OpenRouter wiring for the K5 judge (ADR-007). The handbook has its own
 * model variable so it never changes SAM's `OPENROUTER_MODEL`.
 */
export const HANDBOOK_LLM_MODEL_ENV = "HANDBOOK_LLM_MODEL";
const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

/** USD per million tokens, OpenRouter list prices on 2026-11-14. */
const PRICES: Record<string, ModelPrice> = {
  "anthropic/claude-sonnet-5.5": { input: 2, output: 10 },
  "anthropic/claude-haiku-5.5": { input: 0.1, output: 0.5 },
  "anthropic/claude-opus-5.5": { input: 4, output: 20 },
  // Same models by their Anthropic API ids (OPENROUTER_BASE_URL pointed at
  // Anthropic's OpenAI-compatible endpoint).
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
// Unknown model: budget with a high price so the cap still holds.
const FALLBACK_PRICE: ModelPrice = { input: 15, output: 75 };

/**
 * JSON-schema keywords some OpenAI-compatible endpoints (Anthropic's) reject
 * in `response_format`. Stripped from the request schema only; the AI SDK
 * still validates the parsed output against the full Zod schema.
 */
const UNSUPPORTED_SCHEMA_KEYWORDS = new Set([
  "maxItems",
  "minItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
]);

function stripUnsupportedKeywords(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripUnsupportedKeywords);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => !UNSUPPORTED_SCHEMA_KEYWORDS.has(key))
      .map(([key, value]) => [key, stripUnsupportedKeywords(value)]),
  );
}

export function parseBudgetUsd(raw: string | undefined): number {
  const value = Number(raw);
  return raw && Number.isFinite(value) && value > 0
    ? value
    : LLM_DEFAULT_BUDGET_USD;
}

export function createHandbookJudge(options: {
  access: OpenRouterAccess;
  modelId?: string;
  budgetUsd: number;
  log: (call: LlmCallLog) => Promise<void>;
}): Judge {
  const modelId = options.modelId || DEFAULT_MODEL;
  const openrouter =
    "apiKey" in options.access
      ? createOpenRouter({
          apiKey: options.access.apiKey,
          baseURL: options.access.baseURL,
        })
      : createOpenRouter({
          apiKey: "gateway-managed",
          baseURL: "https://every-app-gateway.invalid/api/ai/openrouter/api/v1",
          fetch: options.access.gatewayFetch,
        });
  const model = wrapLanguageModel({
    model: openrouter.chat(modelId),
    middleware: {
      specificationVersion: "v3",
      transformParams: async ({ params }) => {
        const format = params.responseFormat;
        if (format?.type !== "json" || !format.schema) return params;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the same schema with validation keywords removed
        const schema = stripUnsupportedKeywords(
          format.schema,
        ) as typeof format.schema;
        return { ...params, responseFormat: { ...format, schema } };
      },
    },
  });
  return createJudge({
    model,
    modelId,
    price: PRICES[modelId] ?? FALLBACK_PRICE,
    budgetUsd: options.budgetUsd,
    rubrics: RUBRICS,
    log: options.log,
  });
}
