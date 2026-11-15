import { describe, expect, it } from "vitest";
import type {
  Judge,
  JudgeInput,
} from "@/server/features/handbook/contracts/llm";
import {
  llmContext,
  snapshot,
  statusOf,
  stubJudge,
  textPage,
} from "./check-test-fixtures";
import { LLM_CONTENT_CHECKS } from "./llm-content";

const check = (id: string) => LLM_CONTENT_CHECKS.find((c) => c.id === id)!;
const noCall: Judge = async () => {
  throw new Error("judge must not be called");
};

describe("LLM content checks", () => {
  it("passes the page-type matrix and cites the judged pages", async () => {
    const result = await check("llm.page-type-matrix").run(
      llmContext({ pages: { status: "ok", snapshots: [snapshot("/")] } }),
    );
    expect(statusOf(result, "P5-06")).toBe("PASS");
    expect(result.evidence).toHaveLength(1);
  });

  it("opens P5-11 with an llm finding when an award is only an image", async () => {
    const page = snapshot("/about");
    const badge = { src: "/img/award-2024.png", alt: "" };
    const withBadge = {
      ...page,
      images: [
        {
          ...badge,
          dataSrc: null,
          srcset: null,
          width: null,
          height: null,
          loading: null,
          fetchpriority: null,
        },
      ],
    };
    const quote = { url: page.url, text: 'src="/img/award-2024.png"' };
    const result = await check("llm.awards-as-text").run(
      llmContext(
        { pages: { status: "ok", snapshots: [withBadge] } },
        stubJudge({ verdict: "fail", quotes: [quote] }),
      ),
    );
    expect(statusOf(result, "P5-11")).toBe("OPEN");
    expect(result.findings[0]).toMatchObject({ source: "llm" });
  });

  it("is NA without a judge call when no award is mentioned", async () => {
    const result = await check("llm.awards-as-text").run(
      llmContext(
        { pages: { status: "ok", snapshots: [textPage("/", "Hello.")] } },
        noCall,
      ),
    );
    expect(statusOf(result, "P5-11")).toBe("NA");
  });

  it("gives the judge each detail page's shared-sentence ratio", async () => {
    const boiler = "Join us for a great day out with friends and family.";
    const pages = ["a", "b", "c"].map((slug) =>
      textPage(`/events/${slug}`, `${boiler} Race ${slug} starts at the park.`),
    );
    const seen: JudgeInput[] = [];
    const result = await check("llm.detail-key-facts").run(
      llmContext(
        {
          pages: { status: "ok", snapshots: pages },
          templates: {
            status: "ok",
            templates: [
              {
                key: "t",
                urlPattern: "/events/*",
                skeletonHash: "h",
                urls: pages.map((p) => p.url),
                samples: [],
              },
            ],
          },
        },
        stubJudge({}, seen),
      ),
    );
    expect(statusOf(result, "P5-15")).toBe("PASS");
    const ratio = { sharedSentenceRatio: 0.5 };
    expect(seen[0].facts).toMatchObject({ detailPages: [ratio, ratio, ratio] });
  });

  it("is NA without a judge call when there is no detail template", async () => {
    const result = await check("llm.detail-key-facts").run(
      llmContext(
        { pages: { status: "ok", snapshots: [snapshot("/")] } },
        noCall,
      ),
    );
    expect(statusOf(result, "P5-15")).toBe("NA");
  });
});
