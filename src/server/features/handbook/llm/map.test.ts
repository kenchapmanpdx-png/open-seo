import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { PageProfileExtraction } from "@/server/features/handbook/contracts/page-profile";
import { snapshot } from "../checks/check-test-fixtures";
import { createPageMapper, type ProfileCache } from "./map";
import { buildMapJobs } from "./map-input";

const url = "https://example.com/about";

function extraction(
  overrides: Partial<PageProfileExtraction> = {},
): PageProfileExtraction {
  return {
    pageType: "about",
    topic: "About the race company",
    names: [],
    stats: [],
    prices: [],
    superlatives: [],
    awards: [],
    placeholders: [],
    undefinedAcronyms: [],
    faqQuestions: [],
    faqPairs: [],
    freshness: [],
    ctaFirstScreen: null,
    keyFactsBlock: null,
    contact: [],
    sections: [],
    videoText: null,
    ...overrides,
  };
}

function modelReturning(output: PageProfileExtraction) {
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
        outputTokens: { total: 200, text: 200, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

const cacheId = (k: { url: string; textSha256: string; model: string }) =>
  `${k.url} ${k.textSha256} ${k.model}`;

function memoryCache(): ProfileCache {
  const rows = new Map<string, Awaited<ReturnType<ProfileCache["get"]>>>();
  return {
    get: async (key) => rows.get(cacheId(key)) ?? null,
    put: async (profile) => {
      rows.set(cacheId(profile), profile);
    },
  };
}

function mapperWith(model: MockLanguageModelV3, cache = memoryCache()) {
  return createPageMapper({
    model,
    modelId: "mock",
    price: { input: 0.1, output: 0.5 },
    budgetUsd: () => 1,
    cache,
  });
}

const job = (text: string) => ({
  url,
  scope: "page" as const,
  templateKey: null,
  text,
});

describe("createPageMapper", () => {
  it("drops fields whose quote is not in the page text and counts them", async () => {
    const model = modelReturning(
      extraction({
        stats: [
          {
            subject: "events per year",
            value: "21",
            unit: null,
            quote: "We run 21 events",
          },
          {
            subject: "years",
            value: "12",
            unit: null,
            quote: "12 years racing",
          },
        ],
        keyFactsBlock: { text: "facts", quote: "not on the page" },
      }),
    );
    const outcome = await mapperWith(model).profile(
      job("title: About\n\nWe  run 21 events\nevery year."),
    );
    expect(outcome.profile?.stats.map((s) => s.value)).toEqual(["21"]);
    expect(outcome.profile?.keyFactsBlock).toBeNull();
    expect(outcome.profile?.droppedQuotes).toBe(2);
  });

  it("reads at most 100 k chars in 24 k chunks and marks the profile truncated", async () => {
    const model = modelReturning(extraction());
    const line = "x".repeat(999);
    const text = Array.from({ length: 130 }, () => line).join("\n");
    const outcome = await mapperWith(model).profile(job(text));
    const prompts = model.doGenerateCalls.map((c) =>
      JSON.stringify(c.prompt.at(-1)?.content),
    );
    expect(prompts).toHaveLength(5);
    for (const p of prompts) expect(p.length).toBeLessThan(25_000);
    expect(outcome.profile?.truncated).toBe(true);
  });

  it("serves an unchanged page from the cache without a model call", async () => {
    const cache = memoryCache();
    const model = modelReturning(extraction());
    await mapperWith(model, cache).profile(job("Same text"));
    const again = modelReturning(extraction());
    const outcome = await mapperWith(again, cache).profile(job("Same text"));
    expect(again.doGenerateCalls).toHaveLength(0);
    expect(outcome).toMatchObject({ cached: true });
  });
});

describe("buildMapJobs", () => {
  it("maps llms.txt in full, intro blockquote included", async () => {
    const text =
      "# Why Racing\n> Why Racing lists 21 annual events.\n\n- [Events](/events)";
    const collected: Partial<CollectedData> = {
      llms: {
        status: "ok",
        files: [
          {
            url: "https://example.com/llms.txt",
            status: 200,
            contentType: "text/plain",
            storageKey: null,
            links: [],
            text,
          },
        ],
        mdMirrors: [],
      },
    };
    const jobs = await buildMapJobs(
      collected,
      vi.fn(async () => null),
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.text).toContain("> Why Racing lists 21 annual events.");
  });

  it("leaves map widget chrome and symbol-only blocks out of the page text", async () => {
    const html = `<main><p>Book a cut at 7144 E Stetson Dr.</p><p>\u00ad</p>
      <div class="gm-style"><table><tr><td>Keyboard shortcuts</td></tr></table>
      <div>Map data ©2026 Google</div></div><p>Open Tuesday to Saturday.</p></main>`;
    const page = { ...snapshot("/contact"), rawKey: "raw/contact.html" };
    const jobs = await buildMapJobs(
      { pages: { status: "ok", snapshots: [page] } },
      async () => new TextEncoder().encode(html),
    );
    const lines = jobs[0]?.text.split("\n").slice(6);
    expect(lines).toEqual([
      "Book a cut at 7144 E Stetson Dr.",
      "Open Tuesday to Saturday.",
    ]);
  });

  it("keeps the raw value of a mid-animation counter and drops a countdown", async () => {
    const page = {
      ...snapshot("/about"),
      rawKey: "raw",
    };
    const html = (n: string) =>
      `<div><span>${n}</span> <span>Donated to Charity</span></div><p>New since launch: 4 races.</p>`;
    const bodies: Record<string, string> = {
      raw: html("$3,000,000+"),
      rendered: `${html("$975,000+")}<p>1d 12h 23m</p><p>Join 12 clubs.</p>`,
    };
    const jobs = await buildMapJobs(
      {
        pages: { status: "ok", snapshots: [page] },
        render: {
          status: "ok",
          pages: [{ url: page.url, js: { renderedKey: "rendered" } }],
        } as unknown as CollectedData["render"],
      },
      async (key) => new TextEncoder().encode(bodies[key] ?? ""),
    );
    expect(jobs[0]?.text.split("\n").slice(6)).toEqual([
      "$3,000,000+ Donated to Charity",
      "New since launch: 4 races.",
      "[rendered-only] Join 12 clubs.",
    ]);
  });
});
