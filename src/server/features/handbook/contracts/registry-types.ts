import { z } from "zod";

/**
 * Registry entry for one handbook §41 checklist item.
 *
 * Classes (primary + secondary):
 * - CRAWL: crawler fetches — raw HTML, link graph, status codes, redirects,
 *   sitemap, URL variants. Also engine process items (status file, intake,
 *   reconciliation) because they are produced from the crawl.
 * - HEADERS: HTTP response headers judged by value.
 * - ROBOTS: robots.txt group semantics, meta robots, X-Robots-Tag.
 * - BOTFETCH: fetches with bot user agents (parity, bot-only blocks).
 * - SCHEMA: JSON-LD graph (parse, `@id`, required/complete properties).
 * - RENDER: needs a JS render (raw vs rendered, no-JS, screenshots).
 * - PERF: Lighthouse lab or CrUX field performance.
 * - A11Y: axe-core and accessibility checks.
 * - LLM: needs an LLM judgment on page text.
 * - DATA: third-party account data (GSC, BWT, GA4, CrUX, PSI, AI answers).
 * - OWNER: needs owner input, access, or a decision.
 *
 * `severityDefault` is the severity a failing check starts from (handbook
 * EP severity scale: S1 crawl/index/render blockers, S2 page fundamentals,
 * S3 content/extraction, S4 measurement/gated/polish). `severitySource` is
 * `scale` when the item matches a category the scale names and `default`
 * (S3) otherwise. Checks may move a finding's severity with a stated reason.
 */

export const REGISTRY_CLASSES = [
  "CRAWL",
  "HEADERS",
  "ROBOTS",
  "BOTFETCH",
  "SCHEMA",
  "RENDER",
  "PERF",
  "A11Y",
  "LLM",
  "DATA",
  "OWNER",
] as const;

export const EVIDENCE_KINDS = [
  "url",
  "status",
  "redirectChain",
  "header",
  "rawHtml",
  "renderedDom",
  "screenshot",
  "robotsTxt",
  "sitemap",
  "llmsTxt",
  "jsonld",
  "botFetch",
  "linkGraph",
  "lighthouse",
  "axe",
  "crux",
  "textQuote",
  "dataExport",
  "ownerConfirmation",
  "artifact",
] as const;

export const registryClassSchema = z.enum(REGISTRY_CLASSES);
export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);
export const severitySchema = z.enum(["S1", "S2", "S3", "S4"]);
export const tierSchema = z.enum(["T1+", "T2+", "T3+", "T4"]);
export const phaseSchema = z.enum([
  "P0",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
  "P11",
  "REVIEW",
]);

export const registryEntrySchema = z.object({
  id: z.string().regex(/^(P\d{1,2}-\d{2}|RV-\d{2})$/),
  handbookVersion: z.string(),
  phase: phaseSchema,
  text: z.string().min(1),
  refs: z.array(z.number().int().min(0)),
  tags: z.object({
    tier: tierSchema.nullable(),
    audit: z.boolean(),
    review: z.boolean(),
    gate: z.string().nullable(),
    /** BUILD-mode phase override, e.g. "(BUILD: at P10)". */
    buildPhase: z.string().nullable(),
  }),
  class: registryClassSchema,
  secondaryClasses: z.array(registryClassSchema),
  automatable: z.enum(["full", "partial", "none"]),
  severityDefault: severitySchema,
  severitySource: z.enum(["scale", "default"]),
  evidence: z.array(evidenceKindSchema).min(1),
});

export type RegistryClass = z.infer<typeof registryClassSchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type RegistryEntry = z.infer<typeof registryEntrySchema>;

/**
 * Supplementary rule (ADR-020): an app rule outside handbook §41. Same
 * finding + evidence contracts, `itemId` = `SUPP-nn`; reported under
 * "Additional findings" and never scored. `effect` is the FULL-READ §0 scope
 * test — an entry with no ranking / SEO / GEO effect is not added. 1.5.0
 */
export const suppEntrySchema = z.object({
  id: z.string().regex(/^SUPP-\d{2}$/),
  title: z.string().min(1),
  /** Handbook § numbers the rule derives from. */
  refs: z.array(z.number().int().min(0)).min(1),
  class: z.enum(["deterministic", "render", "llm"]),
  severityDefault: severitySchema,
  effect: z.enum(["ranking", "SEO", "GEO"]),
  evidence: z.array(evidenceKindSchema).min(1),
});
export type SuppEntry = z.infer<typeof suppEntrySchema>;
