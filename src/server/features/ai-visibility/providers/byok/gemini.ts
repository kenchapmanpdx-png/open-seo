import { z } from "zod";
import {
  BYOK_MAX_OUTPUT_TOKENS,
  buildResult,
  nonEmptyStrings,
  postJson,
  toCitations,
  type ByokProvider,
} from "./types";

// Gemini API generateContent with Google Search grounding (ADR-015 §2, fork-built).
// Grounding chunk URIs are Google redirect links; the chunk title carries the
// source domain, so it is used as the citation domain.

const responseSchema = z.looseObject({
  modelVersion: z.string().nullish(),
  candidates: z
    .array(
      z.looseObject({
        content: z
          .looseObject({
            parts: z
              .array(z.looseObject({ text: z.string().nullish() }))
              .nullish(),
          })
          .nullish(),
        groundingMetadata: z
          .looseObject({
            webSearchQueries: z.array(z.string()).nullish(),
            groundingChunks: z
              .array(
                z.looseObject({
                  web: z
                    .looseObject({
                      uri: z.string().nullish(),
                      title: z.string().nullish(),
                      domain: z.string().nullish(),
                    })
                    .nullish(),
                }),
              )
              .nullish(),
          })
          .nullish(),
      }),
    )
    .nullish(),
  usageMetadata: z
    .looseObject({
      promptTokenCount: z.number().nullish(),
      candidatesTokenCount: z.number().nullish(),
      thoughtsTokenCount: z.number().nullish(),
    })
    .nullish(),
});

function parseGeminiResponse(raw: unknown, model: string) {
  const body = responseSchema.parse(raw);
  const candidate = body.candidates?.[0];
  const grounding = candidate?.groundingMetadata;
  const webQueries = nonEmptyStrings(grounding?.webSearchQueries ?? []);
  const usage = body.usageMetadata;
  return buildResult({
    provider: "gemini",
    model,
    modelVersion: body.modelVersion ?? null,
    markdown: (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join(""),
    citations: toCitations(
      (grounding?.groundingChunks ?? []).map((chunk) => ({
        url: chunk.web?.uri,
        title: chunk.web?.title,
        domain: chunk.web?.domain ?? chunk.web?.title,
      })),
    ),
    webQueries,
    usage: {
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens:
        (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      // Grounding is billed per grounded prompt, not per query.
      searchCalls: webQueries.length > 0 ? 1 : 0,
    },
    rawOutput: raw,
  });
}

export const geminiProvider: ByokProvider = {
  id: "gemini",
  defaultModel: "gemini-2.5-flash",
  async run({ apiKey, prompt, model }) {
    const raw = await postJson(
      "gemini",
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": apiKey },
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: BYOK_MAX_OUTPUT_TOKENS },
      },
    );
    return parseGeminiResponse(raw, model);
  },
};
