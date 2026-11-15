import { markdownToText } from "@/server/features/ai-visibility/providers/dataforseoEvidence";
import { extractDomain } from "@/server/features/ai-visibility/citations/domainCategories";
import { safeHttpUrl } from "@/shared/safe-url";
import type { ByokAnswer, ByokProviderId } from "./contracts";
import { costUsdMicros } from "./prices";

// BYOK provider interface (ADR-015 §2). Providers are plain `fetch` clients:
// the key is passed in by the caller (resolved via CredentialRepository), so a
// provider never reads env or the DB itself.

export interface ByokRunInput {
  apiKey: string;
  prompt: string;
  model: string;
  webSearch: true;
  /** Free-text location hint, e.g. "Phoenix, Arizona, US". */
  location?: string;
  /** ISO 639-1 code, e.g. "en". */
  language?: string;
}

export interface ByokRunResult {
  answer: ByokAnswer;
  /** Provider payload, stored in the evidence store (ADR-003); answer and citations are re-derivable from it. */
  rawOutput: unknown;
  costUsdMicros: number;
}

export interface ByokProvider {
  id: ByokProviderId;
  defaultModel: string;
  run(input: ByokRunInput): Promise<ByokRunResult>;
}

export const BYOK_MAX_OUTPUT_TOKENS = 4096;

export class ByokProviderError extends Error {
  constructor(
    readonly provider: ByokProviderId,
    readonly status: number,
    message: string,
  ) {
    super(`[${provider}] ${status}: ${message}`);
    this.name = "ByokProviderError";
  }
}

/** POST JSON; non-2xx → ByokProviderError with a trimmed body (never the key). */
export async function postJson(
  provider: ByokProviderId,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ByokProviderError(provider, response.status, text.slice(0, 500));
  }
  return response.json();
}

type CitationInput = {
  url?: string | null;
  title?: string | null;
  domain?: string | null;
};

/** Safe, de-duplicated citations in provider order, tracking params removed. */
export function toCitations(list: CitationInput[]): ByokAnswer["citations"] {
  const seen = new Map<string, ByokAnswer["citations"][number]>();
  for (const item of list) {
    const safe = safeHttpUrl(item.url);
    if (!safe) continue;
    const url = new URL(safe);
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys()))
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    const href = url.toString();
    if (seen.has(href)) continue;
    seen.set(href, {
      url: href,
      domain: item.domain?.trim() || extractDomain(href),
      title: item.title?.trim() || null,
      position: seen.size,
    });
  }
  return [...seen.values()];
}

export function nonEmptyStrings(values: unknown[]): string[] {
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function buildResult(input: {
  provider: ByokProviderId;
  model: string;
  modelVersion: string | null;
  markdown: string;
  citations: ByokAnswer["citations"];
  webQueries: string[];
  usage: ByokAnswer["usage"];
  rawOutput: unknown;
}): ByokRunResult {
  const markdown = input.markdown.trim();
  return {
    answer: {
      provider: input.provider,
      model: input.model,
      modelVersion: input.modelVersion,
      answerMarkdown: markdown || null,
      answerText: markdown ? markdownToText(markdown) : "",
      citations: input.citations,
      webQueries: input.webQueries,
      usage: input.usage,
    },
    rawOutput: input.rawOutput,
    costUsdMicros: costUsdMicros(input.provider, input.model, input.usage),
  };
}
