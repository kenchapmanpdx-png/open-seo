import { describe, expect, it } from "vitest";
import type { JudgeInput } from "@/server/features/handbook/contracts/llm";
import type { SiteFactMap } from "@/server/features/handbook/contracts/site-fact-map";
import {
  ORIGIN,
  llmContext,
  snapshot,
  stubJudge,
  textPage,
} from "./check-test-fixtures";
import { LLM_CONTENT_CHECKS } from "./llm-content";
import { LLM_TEMPLATE_CHECKS } from "./llm-templates";

const url = (path: string) => new URL(path, ORIGIN).href;

function factMap(overrides: Partial<SiteFactMap>): SiteFactMap {
  return {
    statConflicts: [],
    nameVariants: [],
    superlatives: [],
    placeholders: [],
    undefinedAcronyms: [],
    awards: [],
    faqDuplicates: [],
    thinPages: [],
    serviceCoverage: [],
    coverage: {
      pages: 0,
      profiled: 0,
      cached: 0,
      skippedBudget: 0,
      droppedQuotes: 0,
    },
    ...overrides,
  };
}

async function judgeInput(
  checks: typeof LLM_CONTENT_CHECKS,
  id: string,
  pages: ReturnType<typeof snapshot>[],
  map: SiteFactMap,
): Promise<JudgeInput> {
  const seen: JudgeInput[] = [];
  await checks
    .find((c) => c.id === id)!
    .run({
      ...llmContext(
        { pages: { status: "ok", snapshots: pages } },
        stubJudge({}, seen),
      ),
      siteFactMap: map,
    });
  return seen[0];
}

describe("full-read judge views (fact map)", () => {
  it("gives P4-07 every hub's head lines in one call, not a sample of 8", async () => {
    const hubs = Array.from({ length: 10 }, (_, i) =>
      textPage(`/hub-${i}`, "List.", { title: `Hub ${i}`, h1: `Hub ${i}` }),
    );
    const map = factMap({
      serviceCoverage: hubs.map((h) => ({
        hubUrl: h.url,
        children: [url(`${new URL(h.url).pathname}/a`)],
      })),
    });
    const input = await judgeInput(
      LLM_TEMPLATE_CHECKS,
      "llm.hub-titles",
      [snapshot("/"), ...hubs],
      map,
    );
    expect(input.pages.map((p) => p.url)).toEqual(hubs.map((h) => h.url));
    expect(input.pages[9].text).toContain("H1: Hub 9");
  });

  it("gives P5-15 each thin page's word count", async () => {
    const pages = [textPage("/events/a", "Short."), textPage("/training", "")];
    const map = factMap({
      thinPages: [
        { url: url("/events/a"), words: 40, hasKeyFactsBlock: false },
        { url: url("/training"), words: 12, hasKeyFactsBlock: false },
      ],
    });
    const input = await judgeInput(
      LLM_CONTENT_CHECKS,
      "llm.detail-key-facts",
      pages,
      map,
    );
    expect(input.facts).toMatchObject({
      detailPages: [
        { url: url("/events/a"), words: 40 },
        { url: url("/training"), words: 12 },
      ],
    });
    // Thinnest first.
    expect(input.pages[0].url).toBe(url("/training"));
  });

  it("shows P5-11 a compliance badge named only by its image file", async () => {
    const page = snapshot("/medical-funding/");
    page.images = [
      {
        src: url("/uploads/trust-hipaa-compliant.png"),
        alt: "",
        dataSrc: null,
        srcset: null,
        width: null,
        height: null,
        loading: null,
        fetchpriority: null,
      },
    ];
    const input = await judgeInput(
      LLM_CONTENT_CHECKS,
      "llm.awards-as-text",
      [page],
      factMap({}),
    );
    expect(input.pages[0].text).toContain("file: trust hipaa compliant");
  });
});
