import { z } from "zod";
import {
  BYOK_MAX_OUTPUT_TOKENS,
  buildResult,
  postJson,
  toCitations,
  type ByokProvider,
} from "./types";

// Perplexity Sonar chat completions (ADR-015 §2, fork-built). Perplexity does
// not expose its search queries, so `webQueries` is always [] ("n/a" in the UI).

const responseSchema = z.looseObject({
  model: z.string().nullish(),
  choices: z
    .array(
      z.looseObject({
        message: z.looseObject({ content: z.string().nullish() }).nullish(),
      }),
    )
    .nullish(),
  search_results: z
    .array(
      z.looseObject({ url: z.string().nullish(), title: z.string().nullish() }),
    )
    .nullish(),
  citations: z.array(z.string()).nullish(),
  usage: z
    .looseObject({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
    })
    .nullish(),
});

function parsePerplexityResponse(raw: unknown, model: string) {
  const body = responseSchema.parse(raw);
  const sources =
    body.search_results && body.search_results.length > 0
      ? body.search_results
      : (body.citations ?? []).map((url) => ({ url, title: null }));
  return buildResult({
    provider: "perplexity",
    model,
    modelVersion: body.model ?? null,
    markdown: body.choices?.[0]?.message?.content ?? "",
    citations: toCitations(sources),
    webQueries: [],
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      // Sonar charges a per-request search fee.
      searchCalls: 1,
    },
    rawOutput: raw,
  });
}

export const perplexityProvider: ByokProvider = {
  id: "perplexity",
  defaultModel: "sonar",
  async run({ apiKey, prompt, model, location }) {
    const country = location && /^[A-Z]{2}$/i.test(location) ? location : null;
    const raw = await postJson(
      "perplexity",
      "https://api.perplexity.ai/chat/completions",
      { authorization: `Bearer ${apiKey}` },
      {
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: BYOK_MAX_OUTPUT_TOKENS,
        ...(country
          ? {
              web_search_options: {
                user_location: { country: country.toUpperCase() },
              },
            }
          : {}),
      },
    );
    return parsePerplexityResponse(raw, model);
  },
};
