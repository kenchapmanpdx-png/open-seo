// Ported from elmohq/elmo@2b477bd6 packages/lib/src/providers/registry/openai-api.ts — MIT, © 2026 Blue Whale Software, LLC
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software, subject to the MIT License conditions.
// Fork change: plain `fetch` to the Responses API instead of the AI SDK (no new dependency, Workers-safe); the payload is
// parsed directly, so web queries come from `web_search_call` items and citations from `url_citation` annotations.
import { z } from "zod";
import {
  BYOK_MAX_OUTPUT_TOKENS,
  buildResult,
  nonEmptyStrings,
  postJson,
  toCitations,
  type ByokProvider,
} from "./types";

// Elmo config: tracked runs search shallowly to bound per-call cost.
const MAX_TOOL_CALLS = 2;
const SEARCH_CONTEXT_SIZE = "low";

const annotationSchema = z.looseObject({
  type: z.string(),
  url: z.string().nullish(),
  title: z.string().nullish(),
});
const outputItemSchema = z.looseObject({
  type: z.string(),
  action: z
    .looseObject({
      type: z.string().nullish(),
      query: z.string().nullish(),
      queries: z.array(z.string()).nullish(),
    })
    .nullish(),
  content: z
    .array(
      z.looseObject({
        type: z.string(),
        text: z.string().nullish(),
        annotations: z.array(annotationSchema).nullish(),
      }),
    )
    .nullish(),
});
const responseSchema = z.looseObject({
  model: z.string().nullish(),
  output: z.array(outputItemSchema),
  usage: z
    .looseObject({ input_tokens: z.number(), output_tokens: z.number() })
    .nullish(),
});

function parseOpenAiResponse(raw: unknown, model: string) {
  const body = responseSchema.parse(raw);
  const searchCalls = body.output.filter(
    (item) => item.type === "web_search_call",
  );
  const webQueries = nonEmptyStrings(
    searchCalls.flatMap((item) =>
      item.action?.type === "search"
        ? [item.action.query, ...(item.action.queries ?? [])]
        : [],
    ),
  );
  const parts = body.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text");
  return buildResult({
    provider: "openai",
    model,
    modelVersion: body.model ?? null,
    markdown: parts.map((part) => part.text ?? "").join("\n\n"),
    citations: toCitations(
      parts
        .flatMap((part) => part.annotations ?? [])
        .filter((a) => a.type === "url_citation"),
    ),
    webQueries,
    usage: {
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
      searchCalls: searchCalls.length,
    },
    rawOutput: raw,
  });
}

export const openaiProvider: ByokProvider = {
  id: "openai",
  defaultModel: "gpt-6-luna",
  async run({ apiKey, prompt, model, location }) {
    const country = location && /^[A-Z]{2}$/i.test(location) ? location : null;
    const raw = await postJson(
      "openai",
      "https://api.openai.com/v1/responses",
      { authorization: `Bearer ${apiKey}` },
      {
        model,
        input: prompt,
        max_output_tokens: BYOK_MAX_OUTPUT_TOKENS,
        max_tool_calls: MAX_TOOL_CALLS,
        tool_choice: "auto",
        tools: [
          {
            type: "web_search",
            search_context_size: SEARCH_CONTEXT_SIZE,
            ...(country
              ? {
                  user_location: {
                    type: "approximate",
                    country: country.toUpperCase(),
                  },
                }
              : {}),
          },
        ],
      },
    );
    return parseOpenAiResponse(raw, model);
  },
};
