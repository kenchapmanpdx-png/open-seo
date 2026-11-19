import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import {
  context,
  many,
  setPage,
  statusOf,
  template,
  variationPages,
} from "./check-test-fixtures";
import { applyScaledPrecedence, suppScaledCheck } from "./supp-scaled";
import { buildScaledContent } from "../engine/scaled-summary";
import { completeCollected } from "../engine/stages";

const run = async (pages: PageSnapshot[], capped = false) =>
  suppScaledCheck.run(
    context({
      pages: {
        status: "ok",
        snapshots: pages,
        coverage: { discovered: 9, read: pages.length, capped },
      },
      templates: { status: "ok", templates: [template("/*", pages)] },
    }),
  );

describe("crawl.supp-scaled (SUPP-17)", () => {
  it("reports a variation set once, S2 when ≥ 20 % of indexable pages", async () => {
    const { findings } = await run(variationPages());
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe(
      "Page set shares most of its text (4 pages, median 73 % shared, titles differ by one term)",
    );
    expect(findings[0].severity).toBe("S2");
    expect(findings[0].urls).toHaveLength(4);
  });

  it("skips a set that sits wholly in one P3-12 duplicate cluster", async () => {
    const same = ["a", "b", "c"].map((x) =>
      setPage(`/twin-${x}`, `Twin page ${x} here`, many("same", 30)),
    );
    expect(statusOf(await run(same), "SUPP-17")).toBe("PASS");
  });

  it("keeps a set page that is also in a P3-12 cluster and counts its URL once", async () => {
    const pages = variationPages();
    const url = "https://example.com/plumber-copy";
    const twin = {
      ...pages[0],
      url,
      finalUrl: url,
      head: { ...pages[0].head, canonical: url },
    };
    const all = [...pages, twin];
    const result = await run(all);
    expect(result.findings).toHaveLength(1);
    const [set] = result.findings;
    expect(set.urls).toHaveLength(5);
    expect(set.detail).toContain(
      "2 of these pages are also near-duplicates (P3-12).",
    );
    const alsoIn = result.evidence.filter((e) =>
      e.excerpt.includes("alsoIn: P3-12"),
    );
    expect(alsoIn.map((e) => e.url)).toEqual([pages[0].url, twin.url]);
    const summary = buildScaledContent(
      completeCollected({
        pages: { status: "ok", snapshots: all },
        templates: { status: "ok", templates: [template("/*", all)] },
      }),
      result.findings,
    );
    expect(summary.duplicateClusterPages + summary.supp17Pages).toBe(5);
  });

  it("is N/A when the crawl sampled pages", async () => {
    expect(statusOf(await run(variationPages(), true), "SUPP-17")).toBe("NA");
  });

  it("leaves pages reported by P5-09 to P5-09 and drops a set left under 3", async () => {
    const pages = variationPages();
    const result = await run(pages);
    const pending = [
      { checkId: suppScaledCheck.id, result },
      {
        checkId: "llm.local-pages",
        result: {
          statuses: [],
          evidence: [],
          findings: [
            {
              ...result.findings[0],
              itemIds: ["P5-09"],
              urls: [pages[0].url],
            },
          ],
        },
      },
    ];
    const [kept] = applyScaledPrecedence(pending);
    expect(kept.result.findings[0].title).toContain("(3 pages");
    pending[1].result.findings[0].urls = [pages[0].url, pages[1].url];
    expect(applyScaledPrecedence(pending)[0].result.findings).toEqual([]);
  });
});
