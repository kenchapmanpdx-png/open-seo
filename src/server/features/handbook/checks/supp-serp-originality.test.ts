import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  SerpCollection,
  SerpJudge,
  SerpOriginality,
  SerpVerdict,
} from "@/server/features/handbook/contracts/scaled-copy";
import { context, statusOf, textPage } from "./check-test-fixtures";
import {
  supp18Summary,
  suppSerpOriginalityCheck,
} from "./supp-serp-originality";

const DIR = "fork/fixtures/serp-originality";
/** Fixture page body as visible text (tags stripped, whitespace collapsed). */
const bodyText = (file: string) =>
  readFileSync(`${DIR}/${file}`, "utf8")
    .replace(/[\s\S]*<\/h1>/, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STAT =
  "Across the 412 equipment deals we funded in 2025, the median approval took 31 hours from application to signed offer.";

function record(blocked: SerpOriginality["blocked"] = null): SerpOriginality {
  return {
    url: "https://example.com/equipment-financing",
    query: "equipment financing for small business",
    querySource: "derived",
    location: "United States",
    language: "en",
    results: ["lender-a", "lender-b", "bank-c", "news-e", "lender-f"].map(
      (host, i) => ({
        rank: i + 1,
        url: `https://${host}.test/x`,
        fetch: "ok" as const,
      }),
    ),
    verdict: null,
    blocked,
  };
}

async function run(
  file: string,
  judge: SerpJudge | null,
  serp?: Partial<Extract<SerpCollection, { status: "ran" }>>,
) {
  const page = textPage("/equipment-financing", bodyText(file), {
    title: "Equipment Financing | Example Co",
    h1: "Equipment Financing",
  });
  const ctx = context({ pages: { status: "ok", snapshots: [page] } });
  return suppSerpOriginalityCheck.run({
    ...ctx,
    serpOriginality: {
      status: "ran",
      blocked: null,
      lookupUsd: 0.002,
      judge,
      pages: [{ record: record(), competitors: [] }],
      ...serp,
    },
  });
}

const answer = (v: Partial<SerpVerdict>): SerpJudge =>
  vi.fn<SerpJudge>(async () => ({
    hasOriginalElement: false,
    elements: [],
    confidence: 0.9,
    ...v,
  }));

describe("SUPP-18 original value vs top-10 results", () => {
  it("a page with its own first-party stat passes with the verified quote", async () => {
    const result = await run(
      "site-unique.html",
      answer({
        hasOriginalElement: true,
        elements: [{ type: "first-party data", quote: STAT }],
      }),
    );
    expect(result.findings).toEqual([]);
    expect(statusOf(result, "SUPP-18")).toBe("PASS");
    expect(result.evidence.map((e) => e.kind)).toEqual([
      "textQuote",
      "artifact",
    ]);
  });

  it("a page with nothing of its own gets the finding", async () => {
    const result = await run("site-generic.html", answer({}));
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      title:
        'Nothing on this page that the top-10 results for "equipment financing for small business" lack',
      severity: "S3",
      source: "llm",
    });
    expect(supp18Summary(result)).toEqual({
      checked: 1,
      withoutOriginalElement: 1,
      blocked: 0,
      note: null,
    });
  });

  it("drops a quote that is not on the page; a yes left without one is unsure, not a finding", async () => {
    const judge = answer({
      hasOriginalElement: true,
      elements: [{ type: "case", quote: "We helped 900 bakeries last year." }],
    });
    const result = await run("site-generic.html", judge);
    expect(result.findings).toEqual([]);
    expect(result.evidence.map((e) => e.kind)).toEqual(["artifact"]);
    expect(result.evidence[0]?.excerpt).toContain("original element unsure");
  });

  it("asks again below 0.7 and reports unsure when the answers differ", async () => {
    const judge = vi
      .fn<SerpJudge>()
      .mockResolvedValueOnce({
        hasOriginalElement: false,
        elements: [],
        confidence: 0.6,
      })
      .mockResolvedValueOnce({
        hasOriginalElement: true,
        elements: [{ type: "first-party data", quote: STAT }],
        confidence: 0.8,
      });
    const result = await run("site-unique.html", judge);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(result.findings).toEqual([]);
    expect(result.evidence.at(-1)?.excerpt).toContain("unsure");
  });

  it("REVIEW mode is N/A with the EP-7 note", async () => {
    const result = await suppSerpOriginalityCheck.run({
      ...context({}),
      mode: "REVIEW",
      serpOriginality: {
        status: "na",
        note: "REVIEW mode: search-results data not used, EP-7",
      },
    });
    expect(result.statuses).toEqual([
      {
        itemId: "SUPP-18",
        status: "NA",
        note: "REVIEW mode: search-results data not used, EP-7",
        evidenceRefs: [],
      },
    ]);
  });

  it("fewer than 5 result pages read is BLOCKED and never asks the judge", async () => {
    const judge = answer({});
    const result = await run("site-generic.html", judge, {
      pages: [{ record: record("serp pages unavailable"), competitors: [] }],
    });
    expect(judge).not.toHaveBeenCalled();
    expect(result.findings).toEqual([]);
    expect(statusOf(result, "SUPP-18")).toBe("BLOCKED");
    expect(supp18Summary(result)).toMatchObject({
      checked: 0,
      blocked: 1,
      note: "serp pages unavailable",
    });
  });

  it("option off lists nothing", async () => {
    const result = await suppSerpOriginalityCheck.run(context({}));
    expect(result.statuses).toEqual([]);
    expect(supp18Summary(result)).toBeUndefined();
  });
});
