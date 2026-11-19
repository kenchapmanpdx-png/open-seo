// Supplementary rules (ADR-020, FULL-READ §6): app rules outside handbook §41.
// Not in registry.json, so handbook-sync stays a pure §41 diff. SUPP findings
// are reported under "Additional findings" and never scored. SUPP-17…19 come
// from B11 (fork/SCALED-COPY.md §3, ADR-022 / ADR-024). If Ken adds a rule to §41, delete
// it here and re-register the check under the new §41 id.
import { z } from "zod";
import { suppEntrySchema } from "./contracts/registry-types";

export const SUPP_REGISTRY = z.array(suppEntrySchema).parse([
  {
    id: "SUPP-01",
    title:
      'Generic anchors ("Read more", "Click here", "Learn more") on internal links',
    refs: [12],
    class: "deterministic",
    severityDefault: "S4",
    effect: "SEO",
    evidence: ["rawHtml", "linkGraph"],
  },
  {
    id: "SUPP-02",
    title: "Internal links with target=_blank",
    refs: [12],
    class: "deterministic",
    severityDefault: "S4",
    effect: "SEO",
    evidence: ["rawHtml"],
  },
  {
    id: "SUPP-03",
    title: "Duplicate text blocks inside one page (raw HTML)",
    refs: [14],
    class: "deterministic",
    severityDefault: "S3",
    effect: "GEO",
    evidence: ["rawHtml"],
  },
  {
    id: "SUPP-04",
    title: "Counters / numbers wrong in raw HTML vs rendered",
    refs: [6, 14],
    class: "render",
    severityDefault: "S3",
    effect: "GEO",
    evidence: ["rawHtml", "renderedDom"],
  },
  {
    id: "SUPP-05",
    title: "Test / dev / numbered-slug pages in sitemap or index",
    refs: [10, 17],
    class: "deterministic",
    severityDefault: "S3",
    effect: "SEO",
    evidence: ["sitemap", "url"],
  },
  {
    id: "SUPP-06",
    title: 'Empty social meta (content="")',
    refs: [2],
    class: "deterministic",
    severityDefault: "S4",
    effect: "GEO",
    evidence: ["rawHtml"],
  },
  {
    id: "SUPP-07",
    title: "Bot-check / interstitial page returned as HTTP 200 content",
    refs: [18],
    class: "deterministic",
    severityDefault: "S1",
    effect: "ranking",
    evidence: ["botFetch", "status"],
  },
  {
    id: "SUPP-08",
    title:
      "Non-hero video loads with the page and exceeds the video size limit",
    refs: [14, 15],
    class: "render",
    severityDefault: "S2",
    effect: "ranking",
    evidence: ["rawHtml", "header"],
  },
  {
    id: "SUPP-09",
    title: "Video or video embed with no reserved size",
    refs: [14, 15],
    class: "render",
    severityDefault: "S3",
    effect: "ranking",
    evidence: ["renderedDom"],
  },
  {
    id: "SUPP-10",
    title: "Video embed loads its player with the page",
    refs: [14, 15],
    class: "render",
    severityDefault: "S3",
    effect: "ranking",
    evidence: ["renderedDom"],
  },
  {
    id: "SUPP-11",
    title: "Content video with no transcript or text summary as page text",
    refs: [15, 16],
    class: "llm",
    severityDefault: "S3",
    effect: "GEO",
    evidence: ["textQuote", "rawHtml"],
  },
  {
    id: "SUPP-12",
    title:
      "Content video not eligible for Google video results (VideoObject, thumbnail, robots, video sitemap)",
    refs: [15, 24],
    class: "deterministic",
    severityDefault: "S3",
    effect: "ranking",
    evidence: ["jsonld", "robotsTxt", "sitemap"],
  },
  {
    id: "SUPP-13",
    title: "Snippet blockers on an indexable page — intended?",
    refs: [16],
    class: "deterministic",
    severityDefault: "S3",
    effect: "GEO",
    evidence: ["rawHtml", "header"],
  },
  {
    id: "SUPP-14",
    title: "List or step content not in list markup",
    refs: [3, 16],
    class: "deterministic",
    severityDefault: "S4",
    effect: "GEO",
    evidence: ["rawHtml"],
  },
  {
    id: "SUPP-15",
    title:
      "Informational page without question headings or answer-first sections",
    refs: [3, 16],
    class: "llm",
    severityDefault: "S4",
    effect: "GEO",
    evidence: ["textQuote"],
  },
  {
    id: "SUPP-16",
    title: "FAQ answers that don't stand alone or are missing from raw HTML",
    refs: [3, 16],
    class: "llm",
    severityDefault: "S4",
    effect: "GEO",
    evidence: ["textQuote", "rawHtml"],
  },
  {
    id: "SUPP-17",
    title: "Page set shares most of its text (templated or variation pages)",
    refs: [6, 9, 29],
    class: "deterministic",
    severityDefault: "S3",
    effect: "SEO",
    evidence: ["rawHtml", "url"],
  },
  {
    id: "SUPP-18",
    title: "Nothing on the page that the top-10 results for its query lack",
    refs: [6, 33],
    class: "llm",
    severityDefault: "S3",
    effect: "SEO",
    evidence: ["textQuote", "artifact"],
  },
  {
    id: "SUPP-19",
    title: "Text addressed to AI assistants",
    refs: [23, 29],
    class: "deterministic",
    severityDefault: "S2",
    effect: "GEO",
    evidence: ["rawHtml"],
  },
]);

export const SUPP_BY_ID: ReadonlyMap<string, (typeof SUPP_REGISTRY)[number]> =
  new Map(SUPP_REGISTRY.map((e) => [e.id, e]));

/** A finding that cites only SUPP ids goes to "Additional findings" (ADR-020). */
export const isSuppOnly = (itemIds: readonly string[]) =>
  itemIds.length > 0 && itemIds.every((id) => SUPP_BY_ID.has(id));

/** Item filter for one run: intake-applicable registry items plus every SUPP rule. */
export const appliesWithSupp =
  (applicable: ReadonlyMap<string, unknown>) => (id: string) =>
    applicable.has(id) || SUPP_BY_ID.has(id);
