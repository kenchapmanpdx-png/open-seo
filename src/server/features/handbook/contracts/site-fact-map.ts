import { z } from "zod";

/**
 * K15 — SiteFactMap (ADR-019 reduce, FULL-READ §5.3). Built
 * deterministically from all PageProfiles + llms.txt + JSON-LD; no LLM call.
 * Every entry references the verified quotes it came from (evidence rule),
 * so a judge view or a finding can cite them directly.
 */

export const factRefSchema = z.object({
  url: z.string().url(),
  /** Where the quote was found. */
  source: z.enum(["page", "template", "llmsTxt", "jsonld"]),
  quote: z.string().min(1),
});
export type FactRef = z.infer<typeof factRefSchema>;

const inventorySchema = z.array(
  z.object({ text: z.string(), refs: z.array(factRefSchema).min(1) }),
);

export const siteFactMapSchema = z.object({
  /** Same normalized subject, different values across the site's own sources. */
  statConflicts: z.array(
    z.object({
      subject: z.string(),
      values: z
        .array(
          z.object({ value: z.string(), refs: z.array(factRefSchema).min(1) }),
        )
        .min(2),
    }),
  ),
  /** Spellings of one brand / person / place name used across pages. */
  nameVariants: z.array(
    z.object({
      kind: z.enum(["brand", "person", "place"]),
      canonical: z.string(),
      variants: z
        .array(
          z.object({ text: z.string(), refs: z.array(factRefSchema).min(1) }),
        )
        .min(2),
    }),
  ),
  superlatives: inventorySchema,
  placeholders: inventorySchema,
  undefinedAcronyms: inventorySchema,
  awards: z.array(
    z.object({
      text: z.string(),
      hasYear: z.boolean(),
      hasSource: z.boolean(),
      refs: z.array(factRefSchema).min(1),
    }),
  ),
  /** One FAQ question asked on several pages. */
  faqDuplicates: z.array(
    z.object({ question: z.string(), urls: z.array(z.string().url()).min(2) }),
  ),
  /** Indexable pages with little unique text; feeds P3-12 and the P5-15 view. */
  thinPages: z.array(
    z.object({
      url: z.string().url(),
      words: z.number().int().nonnegative(),
      hasKeyFactsBlock: z.boolean(),
    }),
  ),
  /** Hub page → the child pages it covers (service / location coverage). */
  serviceCoverage: z.array(
    z.object({
      hubUrl: z.string().url(),
      children: z.array(z.string().url()),
    }),
  ),
  coverage: z.object({
    /** HTML 200 pages eligible for a profile. */
    pages: z.number().int().nonnegative(),
    profiled: z.number().int().nonnegative(),
    /** Profiles served from the cache (no LLM call). */
    cached: z.number().int().nonnegative(),
    /** Pages left without a profile because the map budget share ran out. */
    skippedBudget: z.number().int().nonnegative(),
    droppedQuotes: z.number().int().nonnegative(),
  }),
});
export type SiteFactMap = z.infer<typeof siteFactMapSchema>;
