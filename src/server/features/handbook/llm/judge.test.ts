import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { createJudge, LlmBudgetError, verifyQuote } from "./judge";

const url = "https://example.com/";
const pages = [{ url, text: "We are the  best\nrace team in the PNW." }];
const rubric = { id: "r1", version: 1, instructions: "Flag superlatives." };

function modelReturning(output: object) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: {
          total: 1000,
          noCache: 1000,
          cacheRead: 0,
          cacheWrite: 0,
        },
        outputTokens: { total: 100, text: 100, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

function judgeWith(model: MockLanguageModelV3, budgetUsd = 1) {
  const log = vi.fn(async () => {});
  const judge = createJudge({
    model,
    modelId: "mock",
    price: { input: 3, output: 15 },
    budgetUsd,
    rubrics: new Map([[rubric.id, rubric]]),
    log,
  });
  return { judge, log };
}

const fail = (quote: string) => ({
  verdict: "fail",
  quotes: [{ url, text: quote }],
  confidence: 0.9,
  rationale: "superlative",
});

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
});
