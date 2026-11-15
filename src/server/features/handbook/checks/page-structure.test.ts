import { describe, expect, it } from "vitest";
import type {
  PageMarkup,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { context, snapshot, statusOf } from "./check-test-fixtures";
import { pageStructureCheck } from "./page-structure";

function page(markup: Partial<PageMarkup>): PageSnapshot {
  const base = snapshot("/");
  return {
    ...base,
    markup: {
      ...base.markup,
      headings: [{ level: 1, text: "Title", landmark: null }],
      ...markup,
    },
  };
}

const run = (s: PageSnapshot) =>
  pageStructureCheck.run(context({ pages: { status: "ok", snapshots: [s] } }));

const prices = "Coffee $3 Tea $2 Cake $4";

describe("crawl.page-structure", () => {
  it("opens P4-08 on two <main> elements", async () => {
    expect(statusOf(await run(page({ mainCount: 2 })), "P4-08")).toBe("OPEN");
  });

  it("opens P4-08 on a heading inside the footer", async () => {
    const result = await run(
      page({
        headings: [
          { level: 1, text: "Title", landmark: null },
          { level: 2, text: "Contact", landmark: "footer" },
        ],
      }),
    );
    expect(statusOf(result, "P4-08")).toBe("OPEN");
  });

  it("passes P5-12 when prices sit in a list, opens when they do not", async () => {
    const inList = page({
      text: prices,
      counts: { tables: 0, lists: 1, forms: 0, iframes: 0, videos: 0 },
    });
    expect(statusOf(await run(inList), "P5-12")).toBe("PASS");
    expect(statusOf(await run(page({ text: prices })), "P5-12")).toBe("OPEN");
  });
});
