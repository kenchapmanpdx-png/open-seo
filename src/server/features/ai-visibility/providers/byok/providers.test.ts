import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import anthropicFixture from "./__fixtures__/anthropic.json";
import geminiFixture from "./__fixtures__/gemini.json";
import openaiFixture from "./__fixtures__/openai.json";
import perplexityFixture from "./__fixtures__/perplexity.json";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";
import { perplexityProvider } from "./perplexity";
import type { ByokProvider } from "./types";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

function respondWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function run(provider: ByokProvider, location?: string) {
  return provider.run({
    apiKey: "sk-test",
    prompt: "best trail running shoes phoenix",
    model: provider.defaultModel,
    webSearch: true,
    location,
  });
}

function sentBody(): Record<string, unknown> {
  const body = fetchMock.mock.calls[0][1]?.body;
  return z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(z.string().parse(body)));
}

describe("BYOK providers", () => {
  it("openai: web_search_call queries, url_citation citations (deduped, utm/hash stripped), cost", async () => {
    respondWith(openaiFixture);
    const { answer, costUsdMicros } = await run(openaiProvider, "us");

    expect(answer.webQueries).toEqual([
      "best trail running shoes phoenix",
      "trail running store phoenix reviews",
      "trail running store phoenix reviews",
    ]);
    expect(answer.citations).toEqual([
      {
        url: "https://www.acme.com/shoes",
        domain: "acme.com",
        title: "Acme Running shoes",
        position: 0,
      },
      {
        url: "https://runhub.example/review",
        domain: "runhub.example",
        title: "RunHub review",
        position: 1,
      },
    ]);
    expect(answer.answerText).toContain("Acme Running is a popular pick");
    expect(answer.modelVersion).toBe("gpt-6-luna-2026-09-01");
    expect(answer.usage).toEqual({
      inputTokens: 1200,
      outputTokens: 300,
      searchCalls: 2,
    });
    expect(costUsdMicros).toBe(27_500);
    expect(sentBody().tools).toEqual([
      {
        type: "web_search",
        search_context_size: "low",
        user_location: { type: "approximate", country: "US" },
      },
    ]);
  });

  it("anthropic: server_tool_use queries, text citations, search count, encrypted content dropped", async () => {
    respondWith(anthropicFixture);
    const { answer, rawOutput, costUsdMicros } = await run(anthropicProvider);

    expect(answer.webQueries).toEqual(["best trail running shoes phoenix"]);
    expect(answer.citations.map((c) => c.url)).toEqual([
      "https://www.acme.com/shoes",
    ]);
    expect(answer.answerMarkdown).toBe(
      "Based on reviews, Acme Running is well regarded.",
    );
    expect(answer.usage.searchCalls).toBe(1);
    expect(costUsdMicros).toBe(15_500);
    expect(JSON.stringify(rawOutput)).not.toContain("SECRETBLOB");
    expect(sentBody().tools).toEqual([
      { type: "web_search_20260209", name: "web_search", max_uses: 1 },
    ]);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "x-api-key": "sk-test",
    });
  });

  it("gemini: grounding queries, redirect chunks keep the title as domain, thoughts count as output", async () => {
    respondWith(geminiFixture);
    const { answer, costUsdMicros } = await run(geminiProvider);

    expect(answer.webQueries).toEqual(["best trail running shoes phoenix"]);
    expect(answer.citations).toEqual([
      {
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AAA",
        domain: "acme.com",
        title: "acme.com",
        position: 0,
      },
    ]);
    expect(answer.usage).toEqual({
      inputTokens: 100,
      outputTokens: 75,
      searchCalls: 1,
    });
    expect(costUsdMicros).toBeCloseTo(35_218, -1);
  });

  it("perplexity: search_results citations, no web queries", async () => {
    respondWith(perplexityFixture);
    const { answer, costUsdMicros } = await run(perplexityProvider);

    expect(answer.webQueries).toEqual([]);
    expect(answer.citations.map((c) => c.domain)).toEqual(["acme.com"]);
    expect(costUsdMicros).toBe(5_030);
  });

  it("throws a provider error on a non-2xx response without echoing the key", async () => {
    respondWith({ error: { message: "invalid x-api-key" } }, 401);
    const error = await run(anthropicProvider).catch((e: unknown) => e);

    expect(error).toMatchObject({ provider: "anthropic", status: 401 });
    expect(String(error)).not.toContain("sk-test");
  });
});
