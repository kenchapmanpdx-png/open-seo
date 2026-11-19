import { z } from "zod";

/**
 * B11 contracts (fork/SCALED-COPY.md, ADR-022…024), all additive in 1.7.0:
 * per-run options, the scaled-content summary (§3.5), copy quality (§4.4)
 * and SERP originality (SUPP-18, §3.3). Nothing here is scored.
 */

/** Per-run options; absent = off. CLI flags and project settings fill these. */
export const runOptionsSchema = z.object({
  copyQuality: z.boolean().default(false),
  serpOriginality: z.boolean().default(false),
  /** HANDBOOK_SERP_ORIGINALITY_MAX_PAGES / `--serp-originality-pages`. */
  serpOriginalityPages: z.number().int().min(1).max(50).default(10),
});
export type RunOptions = z.infer<typeof runOptionsSchema>;

/** "Scaled content" summary block (§3.5): counts from data already collected. */
export const scaledContentSchema = z.object({
  indexablePages: z.number().int().nonnegative(),
  duplicateClusterPages: z.number().int().nonnegative(),
  thinPages: z.number().int().nonnegative(),
  supp17Sets: z.number().int().nonnegative(),
  supp17Pages: z.number().int().nonnegative(),
  /** Median share of a page's sentences found on no other page, per template (≥ 3 pages). */
  ownTextShare: z.array(
    z.object({
      template: z.string(),
      pages: z.number().int().positive(),
      median: z.number().min(0).max(1),
    }),
  ),
  /** Absent when SUPP-18 did not run (flag off). */
  supp18: z
    .object({
      checked: z.number().int().nonnegative(),
      withoutOriginalElement: z.number().int().nonnegative(),
      blocked: z.number().int().nonnegative(),
      note: z.string().nullable(),
    })
    .optional(),
  supp19Pages: z.number().int().nonnegative(),
});
export type ScaledContent = z.infer<typeof scaledContentSchema>;

/** Copy-quality metric ids in report order (§4.3). */
export const COPY_METRIC_IDS = [
  "E7a",
  "E7b",
  "E9",
  "E13",
  "E6a",
  "E6b",
  "E17",
  "E19",
  "E16",
  "E4",
  "E5",
  "E8",
  "HB5",
  "E11",
  "E10",
  "E15",
  "E12",
] as const;
export const copyMetricIdSchema = z.enum(COPY_METRIC_IDS);
export type CopyMetricId = z.infer<typeof copyMetricIdSchema>;

export const copyMetricSchema = z.object({
  id: copyMetricIdSchema,
  /** null = n/a for this page (e.g. E6b without H2, E13 under 300 words). */
  value: z.number().nullable(),
  /** null = number only (E5, E10, E15): never counts toward overCount. */
  threshold: z.string().nullable(),
  over: z.boolean(),
});
export type CopyMetric = z.infer<typeof copyMetricSchema>;

export const copyPageSchema = z.discriminatedUnion("measured", [
  z.object({
    url: z.string(),
    template: z.string().nullable(),
    measured: z.literal(true),
    proseWords: z.number().int().nonnegative(),
    metrics: z.array(copyMetricSchema),
    overCount: z.number().int().nonnegative(),
  }),
  z.object({
    url: z.string(),
    template: z.string().nullable(),
    measured: z.literal(false),
    /** e.g. "language", "prose words < 200", "page type contact". */
    reason: z.string(),
  }),
]);
export type CopyPage = z.infer<typeof copyPageSchema>;

const medianRowSchema = z.object({
  id: copyMetricIdSchema,
  value: z.number().nullable(),
});

/** Copy quality section (§4.4); absent when the gate is off. */
export const copyQualitySchema = z.object({
  label: z.string(),
  medians: z.array(medianRowSchema),
  byTemplate: z.array(
    z.object({ template: z.string(), medians: z.array(medianRowSchema) }),
  ),
  /** Sorted by overCount desc, then URL; measured pages first. */
  pages: z.array(copyPageSchema),
});
export type CopyQuality = z.infer<typeof copyQualitySchema>;

/** SUPP-18 BLOCKED reasons (§3.3); never a finding. */
export const serpBlockedReasonSchema = z.enum([
  "serp pages unavailable",
  "dataforseo credit",
  "llm budget",
]);

/** One audited page's SUPP-18 record, stored as evidence (`artifact`). */
export const serpOriginalitySchema = z.object({
  url: z.string(),
  query: z.string().max(120),
  querySource: z.literal("derived"),
  location: z.string(),
  language: z.string(),
  results: z.array(
    z.object({
      rank: z.number().int().positive(),
      url: z.string(),
      fetch: z.enum(["ok", "failed", "non-html", "skipped"]),
    }),
  ),
  verdict: z
    .object({
      hasOriginalElement: z.boolean(),
      elements: z.array(
        z.object({
          type: z.enum([
            "first-party data",
            "test",
            "case",
            "expert quote",
            "worked example",
          ]),
          quote: z.string(),
        }),
      ),
      confidence: z.number().min(0).max(1),
      unsure: z.boolean(),
    })
    .nullable(),
  blocked: serpBlockedReasonSchema.nullable(),
});
export type SerpOriginality = z.infer<typeof serpOriginalitySchema>;
