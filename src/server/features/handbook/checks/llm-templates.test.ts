import { describe, expect, it } from "vitest";
import type { Judge } from "@/server/features/handbook/contracts/llm";
import {
  llmContext,
  snapshot,
  statusOf,
  stubJudge,
  textPage,
} from "./check-test-fixtures";
import { LLM_TEMPLATE_CHECKS } from "./llm-templates";

const check = (id: string) => LLM_TEMPLATE_CHECKS.find((c) => c.id === id)!;
const noCall: Judge = async () => {
  throw new Error("judge must not be called");
};
const pagesOf = (...snapshots: ReturnType<typeof snapshot>[]) => ({
  pages: { status: "ok" as const, snapshots },
});

describe("LLM template checks", () => {
  it("is NA without a judge call when the site has no hub", async () => {
    const result = await check("llm.hub-titles").run(
      llmContext(pagesOf(snapshot("/")), noCall),
    );
    expect(statusOf(result, "P4-07")).toBe("NA");
  });

  it("is NA without a judge call when no rendered page calls a same-site API", async () => {
    const result = await check("llm.fallback-freshness").run(
      llmContext(
        { ...pagesOf(snapshot("/")), render: { status: "ok", pages: [] } },
        noCall,
      ),
    );
    expect(statusOf(result, "P2-03")).toBe("NA");
  });

  it("passes P5-09 without a judge call when no page is a candidate", async () => {
    const result = await check("llm.local-pages").run(
      llmContext(
        pagesOf(textPage("/", "Hi.", { title: "Home | Brand" })),
        noCall,
      ),
    );
    expect(statusOf(result, "P5-09")).toBe("PASS");
    expect(result.evidence).toHaveLength(1);
  });

  it("opens P5-09 when the judge fails a single all-services page", async () => {
    const base = textPage("/service", "We do it all.", {
      title: "Services | Brand",
    });
    const services = {
      ...base,
      markup: {
        ...base.markup,
        headings: ["Fit", "Repair", "Coaching", "Testing"].map((text) => ({
          level: 2,
          text,
          landmark: null,
        })),
      },
    };
    const quote = { url: services.url, text: "- Repair" };
    const result = await check("llm.local-pages").run(
      llmContext(
        pagesOf(services),
        stubJudge({ verdict: "fail", quotes: [quote] }),
      ),
    );
    expect(statusOf(result, "P5-09")).toBe("OPEN");
    expect(result.findings[0]).toMatchObject({
      source: "llm",
      urls: [services.url],
    });
  });
});
