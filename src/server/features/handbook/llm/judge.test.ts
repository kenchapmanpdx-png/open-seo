import { APICallError } from "ai";
import type { LlmVerdict } from "@/server/features/handbook/contracts/llm";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import {
  createJudge,
  LlmBudgetError,
  LlmCreditsError,
  verifyQuote,
  type VerdictCache,
} from "./judge";

const url = "https://example.com/";
const pages = [{ url, text: "We are the  best\nrace team in the PNW." }];
const rubric = { id: "r1", version: 1, instructions: "Flag superlatives." };

const generated = (output: object) => ({
  content: [{ type: "text" as const, text: JSON.stringify(output) }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 100, text: 100, reasoning: 0 },
  },
  warnings: [],
});

/** A model answering `outputs` in turn; an Error entry is thrown instead. */
function modelReturning(...outputs: (object | Error)[]) {
  let call = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => {
      const next = outputs[Math.min(call++, outputs.length - 1)];
      if (next instanceof Error) throw next;
      return generated(next ?? {});
    },
  });
}

const httpError = (statusCode: number, headers: Record<string, string> = {}) =>
  new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://openrouter.test",
    requestBodyValues: {},
    statusCode,
    responseHeaders: headers,
    isRetryable: statusCode === 429 || statusCode >= 500,
  });

function judgeWith(
  model: MockLanguageModelV3,
  budgetUsd = 1,
  cache?: VerdictCache,
) {
  const log = vi.fn(async () => {});
  const judge = createJudge({
    model,
    modelId: "mock",
    price: { input: 3, output: 15 },
    budgetUsd: () => budgetUsd,
    rubrics: new Map([[rubric.id, rubric]]),
    log,
    cache,
  });
  return { judge, log };
}

const fail = (quote: string, confidence = 0.9) => ({
  verdict: "fail",
  quotes: [{ url, text: quote }],
  confidence,
  rationale: "superlative",
});
const pass = { verdict: "pass", quotes: [], confidence: 0.8, rationale: "ok" };
const input = { itemId: "P5-04", rubricId: "r1", pages };

describe("verifyQuote", () => {
  it("matches across whitespace only, on the cited URL only", () => {
    expect(verifyQuote({ url, text: "the best race team" }, pages)).toBe(true);
    expect(verifyQuote({ url, text: "the best racing team" }, pages)).toBe(
      false,
    );
    expect(
      verifyQuote({ url: "https://example.com/x", text: "best" }, pages),
    ).toBe(false);
  });
});

describe("verifyQuote typography (WO-B19-014)", () => {
  it("matches straight quotes, dashes and case against the page's typography", () => {
    const page = [
      {
        url,
        text: "Why We\u2019re the Best \u2014 that\u2019s the #1 reason",
      },
    ];
    expect(
      verifyQuote({ url, text: "why we're the best - that's the #1" }, page),
    ).toBe(true);
    expect(verifyQuote({ url, text: "that's the #2 reason" }, page)).toBe(
      false,
    );
  });
});

describe("createJudge", () => {
  it("keeps a fail with a verified quote and downgrades an invented quote to unsure", async () => {
    const verified = judgeWith(modelReturning(fail("the best race team")));
    const kept = await verified.judge({
      itemId: "P5-04",
      rubricId: "r1",
      pages,
    });
    expect(kept).toMatchObject({ verdict: "fail", quotesVerified: true });

    const invented = judgeWith(modelReturning(fail("the fastest team")));
    const downgraded = await invented.judge({
      itemId: "P5-04",
      rubricId: "r1",
      pages,
    });
    expect(downgraded).toMatchObject({
      verdict: "unsure",
      quotesVerified: false,
    });
    expect(invented.log).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: "unsure", quotesVerified: false }),
    );
  });

  it("stops before calling the model once the budget would be exceeded", async () => {
    const model = modelReturning(fail("the best race team"));
    const { judge } = judgeWith(model, 0.0001);
    await expect(
      judge({ itemId: "P5-04", rubricId: "r1", pages }),
    ).rejects.toBeInstanceOf(LlmBudgetError);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it("retries a 429 after its retry-after delay", async () => {
    const model = modelReturning(
      httpError(429, { "retry-after": "1" }),
      fail("the best race team"),
    );
    const { judge } = judgeWith(model);
    await expect(judge(input)).resolves.toMatchObject({ verdict: "fail" });
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it("asks again below 0.7 confidence and is unsure when the verdicts differ", async () => {
    const model = modelReturning(fail("the best race team", 0.6), pass);
    const { judge, log } = judgeWith(model);
    await expect(judge(input)).resolves.toMatchObject({ verdict: "unsure" });
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("answers an unchanged prompt from the cache at no cost and never caches unsure", async () => {
    const store = new Map<string, LlmVerdict>();
    const cache: VerdictCache = {
      get: async (key) => store.get(key) ?? null,
      put: async (key, verdict) => void store.set(key, verdict),
    };
    const model = modelReturning(fail("the best race team"));
    const { judge } = judgeWith(model, 1, cache);
    await judge(input);
    const rerun = await judge(input);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(rerun).toMatchObject({ verdict: "fail", call: { costUsd: 0 } });

    store.clear();
    const { judge: unsure } = judgeWith(
      modelReturning(fail("invented quote")),
      1,
      cache,
    );
    await expect(unsure(input)).resolves.toMatchObject({ verdict: "unsure" });
    expect(store.size).toBe(0);
  });

  it("stops the LLM checks with llm credits on a 402", async () => {
    const { judge } = judgeWith(modelReturning(httpError(402)));
    const error = await judge(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmCreditsError);
    expect(error).toMatchObject({ note: "llm credits" });
  });
});
