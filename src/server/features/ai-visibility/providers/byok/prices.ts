import type { ByokAnswer, ByokProviderId } from "./contracts";

// BYOK price table (USD). Used for the per-run budget cap (ADR-015 §2) and the
// stored `cost_usd_micros`; never billed through upstream credits.
// Prices as of 2026-11-14. Anthropic token rates from Anthropic's model table
// (cached 2026-11-03), web search $10 / 1,000. Other providers: list prices as
// last published to us, not re-verified live (no keys) — refresh on the first
// live run. An unknown model falls back to the provider's most expensive row,
// so the budget cap errs on the safe side.

type Price = { inputPerM: number; outputPerM: number; perSearch: number };

const PRICES: Record<ByokProviderId, Record<string, Price>> = {
  openai: {
    "gpt-6-luna": { inputPerM: 2.5, outputPerM: 15, perSearch: 0.01 },
    "gpt-5-mini": { inputPerM: 0.25, outputPerM: 2, perSearch: 0.01 },
  },
  anthropic: {
    "claude-opus-5-5": { inputPerM: 4, outputPerM: 20, perSearch: 0.01 },
    "claude-sonnet-5-5": { inputPerM: 2, outputPerM: 10, perSearch: 0.01 },
    "claude-haiku-5-5": { inputPerM: 0.1, outputPerM: 0.5, perSearch: 0.01 },
  },
  gemini: {
    "gemini-2.5-flash": { inputPerM: 0.3, outputPerM: 2.5, perSearch: 0.035 },
    "gemini-2.5-pro": { inputPerM: 1.25, outputPerM: 10, perSearch: 0.035 },
  },
  perplexity: {
    sonar: { inputPerM: 1, outputPerM: 1, perSearch: 0.005 },
    "sonar-pro": { inputPerM: 3, outputPerM: 15, perSearch: 0.006 },
  },
};

function priceFor(provider: ByokProviderId, model: string): Price {
  const rows = PRICES[provider];
  const exact = rows[model];
  if (exact) return exact;
  const all = Object.values(rows);
  return all.reduce((max, row) =>
    row.outputPerM > max.outputPerM ? row : max,
  );
}

export function costUsdMicros(
  provider: ByokProviderId,
  model: string,
  usage: ByokAnswer["usage"],
): number {
  const price = priceFor(provider, model);
  const usd =
    (usage.inputTokens * price.inputPerM) / 1_000_000 +
    (usage.outputTokens * price.outputPerM) / 1_000_000 +
    usage.searchCalls * price.perSearch;
  return Math.round(usd * 1_000_000);
}
