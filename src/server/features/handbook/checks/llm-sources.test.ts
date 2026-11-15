import { describe, expect, it } from "vitest";
import type { SafeFetch } from "@/server/features/handbook/contracts/collectors";
import type {
  Judge,
  JudgeInput,
} from "@/server/features/handbook/contracts/llm";
import {
  llmContext,
  statusOf,
  stubJudge,
  textPage,
} from "./check-test-fixtures";
import { sourceCheck } from "./llm-sources";

const claim = "A 2023 survey found 87% of runners train with a plan.";
const page = textPage("/blog/plans", `Training plans. ${claim}`);
const pages = { pages: { status: "ok" as const, snapshots: [page] } };

const noCall: Judge = async () => {
  throw new Error("judge must not be called");
};

const fetchOffsite: SafeFetch = async (url) => ({
  url,
  finalUrl: url,
  status: 200,
  headers: [],
  body: "<html><body><p>Of those asked, 87% of runners use a written plan.</p></body></html>",
  truncated: false,
  redirectChain: [],
  timingMs: 1,
});

describe("LLM source check", () => {
  it("opens P5-03 when the judge fails an uncited claim", async () => {
    const result = await sourceCheck.run(
      llmContext(
        pages,
        stubJudge({
          verdict: "fail",
          quotes: [{ url: page.url, text: claim }],
        }),
      ),
    );
    expect(statusOf(result, "P5-03")).toBe("OPEN");
    expect(result.findings[0]).toMatchObject({ source: "llm" });
  });

  it("says in the PASS note that cited pages were not fetched", async () => {
    const result = await sourceCheck.run(llmContext(pages));
    expect(statusOf(result, "P5-03")).toBe("PASS");
    expect(result.statuses[0].note).toContain("cited pages not fetched");
  });

  it("is NA without a judge call when no claim needs a source", async () => {
    const plain = textPage(
      "/",
      "We fit bikes in Scottsdale every day of the week.",
    );
    const result = await sourceCheck.run(
      llmContext({ pages: { status: "ok", snapshots: [plain] } }, noCall),
    );
    expect(statusOf(result, "P5-03")).toBe("NA");
  });

  it("fetches the cited page and quotes the matching passage to the judge", async () => {
    const source = "https://research.example.org/runners";
    const cited = {
      ...page,
      links: [
        {
          href: source,
          text: "2023 survey",
          rel: null,
          target: null,
          ariaLabel: null,
        },
      ],
    };
    const seen: JudgeInput[] = [];
    const result = await sourceCheck.run({
      ...llmContext(
        { pages: { status: "ok", snapshots: [cited] } },
        stubJudge({}, seen),
      ),
      fetchOffsite,
    });
    expect(seen[0].pages[0].text).toContain(
      'source text: "Of those asked, 87% of runners use a written plan."',
    );
    expect(result.evidence.find((e) => e.url === source)?.excerpt).toContain(
      "87% of runners",
    );
    expect(result.statuses[0].note).toContain("1 cited page(s) fetched");
  });
});
