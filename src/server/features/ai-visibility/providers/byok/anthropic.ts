// Ported from elmohq/elmo@2b477bd6 packages/lib/src/providers/registry/anthropic-api.ts — MIT, © 2026 Blue Whale Software, LLC
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software, subject to the MIT License conditions.
// Fork changes: plain `fetch` to the Messages API (dependency install not available in the B6 build; API documented);
// web search tool `web_search_20260209` (current for Claude 4.6+ / 5.x models per Anthropic docs, checked 2026-11-14);
// citations from text `web_search_result_location` citations, falling back to the search results.
import { z } from "zod";
import {
  BYOK_MAX_OUTPUT_TOKENS,
  buildResult,
  nonEmptyStrings,
  postJson,
  toCitations,
  type ByokProvider,
} from "./types";

const ANTHROPIC_WEB_SEARCH_TOOL = "web_search_20260209";
// Elmo config: Anthropic bills per search, so tracked runs allow one.
const WEB_SEARCH_MAX_USES = 1;

const searchInputSchema = z.looseObject({ query: z.unknown() });
const linkSchema = z.looseObject({
  type: z.string().nullish(),
  url: z.string().nullish(),
  title: z.string().nullish(),
});
const blockSchema = z.looseObject({
  type: z.string(),
  name: z.string().nullish(),
  input: z.unknown().optional(),
  text: z.string().nullish(),
  citations: z.array(linkSchema).nullish(),
  // A list of results, or one error object.
  content: z.unknown().optional(),
});
const messageSchema = z.looseObject({
  model: z.string().nullish(),
  content: z.array(blockSchema),
  usage: z
    .looseObject({
      input_tokens: z.number(),
      output_tokens: z.number(),
      server_tool_use: z
        .looseObject({ web_search_requests: z.number().nullish() })
        .nullish(),
    })
    .nullish(),
});

function parseAnthropicMessage(raw: unknown, model: string) {
  const message = messageSchema.parse(raw);
  const blocks = message.content;
  const webQueries = nonEmptyStrings(
    blocks.flatMap((block) =>
      block.type === "server_tool_use" && block.name === "web_search"
        ? [searchInputSchema.safeParse(block.input).data?.query]
        : [],
    ),
  );
  const textBlocks = blocks.filter((block) => block.type === "text");
  const cited = textBlocks.flatMap((block) => block.citations ?? []);
  const results = blocks
    .filter((block) => block.type === "web_search_tool_result")
    .flatMap((block) =>
      Array.isArray(block.content)
        ? z.array(linkSchema).catch([]).parse(block.content)
        : [],
    );
  return buildResult({
    provider: "anthropic",
    model,
    modelVersion: message.model ?? null,
    markdown: textBlocks.map((block) => block.text ?? "").join(""),
    citations: toCitations(cited.length > 0 ? cited : results),
    webQueries,
    usage: {
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
      searchCalls:
        message.usage?.server_tool_use?.web_search_requests ??
        webQueries.length,
    },
    rawOutput: trimSearchResults(message),
  });
}

// Citation extraction reads url and title only; drop encrypted page content.
function trimSearchResults(message: z.infer<typeof messageSchema>) {
  return {
    ...message,
    content: message.content.map((block) =>
      block.type === "web_search_tool_result" && Array.isArray(block.content)
        ? {
            ...block,
            content: z
              .array(linkSchema)
              .catch([])
              .parse(block.content)
              .map(({ type, url, title }) => ({ type, url, title })),
          }
        : block,
    ),
  };
}

export const anthropicProvider: ByokProvider = {
  id: "anthropic",
  defaultModel: "claude-sonnet-5-5",
  async run({ apiKey, prompt, model, location }) {
    const country = location && /^[A-Z]{2}$/i.test(location) ? location : null;
    const raw = await postJson(
      "anthropic",
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      {
        model,
        max_tokens: BYOK_MAX_OUTPUT_TOKENS,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: ANTHROPIC_WEB_SEARCH_TOOL,
            name: "web_search",
            max_uses: WEB_SEARCH_MAX_USES,
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
    return parseAnthropicMessage(raw, model);
  },
};
