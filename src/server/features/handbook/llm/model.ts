import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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
};
// Unknown model: budget with a high price so the cap still holds.
const FALLBACK_PRICE: ModelPrice = { input: 15, output: 75 };

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
  return createJudge({
    model: openrouter.chat(modelId),
    modelId,
    price: PRICES[modelId] ?? FALLBACK_PRICE,
    budgetUsd: options.budgetUsd,
    rubrics: RUBRICS,
    log: options.log,
  });
}
