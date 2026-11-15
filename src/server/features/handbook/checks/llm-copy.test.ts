import { describe, expect, it } from "vitest";
import type { JudgeResult } from "@/server/features/handbook/contracts/llm";
import { REGISTRY } from "@/server/features/handbook/registry";
import type { JudgeInput } from "@/server/features/handbook/contracts/llm";
import {
  context,
  llmContext,
  snapshot,
  statusOf,
  stubJudge,
  textPage,
} from "./check-test-fixtures";
import { LLM_CHECKS } from "./llm-copy";

const titlesCheck = LLM_CHECKS.find((c) => c.id === "llm.titles-h1")!;
const faqCheck = LLM_CHECKS.find((c) => c.id === "llm.page-specific-faq")!;
const factCheck = LLM_CHECKS.find((c) => c.id === "llm.fact-table")!;
const entityCheck = LLM_CHECKS.find((c) => c.id === "llm.entity-test")!;

const home = snapshot("/");
const services = {
  ...snapshot("/services"),
  head: { ...home.head, title: "Services | Brand" },
};

function ctxWith(verdict: Partial<JudgeResult>) {
  const ctx = context({
    pages: { status: "ok", snapshots: [home, services] },
  });
  return {
    ...ctx,
    applicableItems: new Map(REGISTRY.map((e) => [e.id, e])),
    judge: async (): Promise<JudgeResult> => ({
      verdict: "fail",
      quotes: [],
      confidence: 0.9,
      rationale: "bare page-label title",
      quotesVerified: true,
      call: {
        model: "m",
        tokensIn: 1,
        tokensOut: 1,
        costUsd: 0,
        promptSha256: "x",
      },
      ...verdict,
    }),
  };
}

describe("LLM copy checks", () => {
  it("turns a quoted fail into an llm finding citing the quote", async () => {
    const quote = { url: services.url, text: "Title: Services | Brand" };
    const result = await titlesCheck.run(ctxWith({ quotes: [quote] }));
    expect(statusOf(result, "P4-02")).toBe("OPEN");
    expect(result.findings[0]).toMatchObject({
      source: "llm",
      urls: [services.url],
    });
    expect(result.evidence).toEqual([
      expect.objectContaining({ kind: "textQuote", excerpt: quote.text }),
    ]);
  });

  it("blocks a low-confidence fail instead of opening the item", async () => {
    const result = await titlesCheck.run(
      ctxWith({ confidence: 0.3, quotes: [{ url: home.url, text: "x" }] }),
    );
    expect(statusOf(result, "P4-02")).toBe("BLOCKED");
    expect(result.findings).toHaveLength(0);
  });

  it("is NA without calling the judge when no page has an FAQ", async () => {
    const ctx = ctxWith({});
    const result = await faqCheck.run({
      ...ctx,
      judge: async () => {
        throw new Error("judge must not be called");
      },
    });
    expect(statusOf(result, "P5-05")).toBe("NA");
  });

  it("judges stat sentences from pages and llms.txt, and opens P9-02 on an llms conflict", async () => {
    const withText = (path: string, text: string) => {
      const s = snapshot(path);
      return { ...s, markup: { ...s.markup, text } };
    };
    const llmsUrl = "https://example.com/llms.txt";
    const seen: string[] = [];
    const ctx = ctxWith({});
    const result = await factCheck.run({
      ...ctx,
      collected: {
        ...ctx.collected,
        pages: {
          status: "ok",
          snapshots: [
            withText("/", "Welcome. We have hosted 21 events since 2019."),
            withText("/about", "Call 503-555-0100 today."),
          ],
        },
        llms: {
          status: "ok",
          files: [
            {
              url: llmsUrl,
              status: 200,
              contentType: "text/plain",
              storageKey: null,
              links: [],
              text: "# Brand\n18 events hosted.",
            },
          ],
          mdMirrors: [],
        },
      },
      judge: async (input) => {
        seen.push(...input.pages.map((p) => p.text));
        return ctx.judge().then((r) => ({
          ...r,
          quotes: [
            { url: home.url, text: "We have hosted 21 events since 2019." },
            { url: llmsUrl, text: "18 events hosted." },
          ],
        }));
      },
    });
    expect(seen.join("\n")).toContain("We have hosted 21 events since 2019.");
    expect(seen.join("\n")).not.toContain("503-555-0100");
    expect(statusOf(result, "P5-02")).toBe("OPEN");
    expect(statusOf(result, "P9-02")).toBe("OPEN");
  });

  it("shows the entity judge every body-text spelling of the brand", async () => {
    const seen: JudgeInput[] = [];
    const pages = [
      textPage("/", "Welcome.", { title: "Trail Races | WHY Racing Events" }),
      textPage("/a", "Join WHY Racing Events today."),
      textPage("/b", "Why Racing events are fun for all."),
    ];
    await entityCheck.run(
      llmContext(
        { pages: { status: "ok", snapshots: pages } },
        stubJudge({}, seen),
      ),
    );
    const text = seen[0].pages.map((p) => p.text).join("\n");
    expect(text).toContain("Join WHY Racing Events today.");
    expect(text).toContain("Why Racing events are fun for all.");
  });
});
