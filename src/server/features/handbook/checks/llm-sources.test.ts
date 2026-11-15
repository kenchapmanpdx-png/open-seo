import { describe, expect, it } from "vitest";
import type { Judge } from "@/server/features/handbook/contracts/llm";
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
});
