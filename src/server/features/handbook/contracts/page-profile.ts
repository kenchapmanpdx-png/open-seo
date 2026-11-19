import { z } from "zod";

/**
 * K14 — PageProfile (ADR-019, FULL-READ §5.1). The map-stage LLM extracts one
 * profile per HTML 200 page (plus one per template for its boilerplate).
 * Extraction only: no verdict fields. Every text-carrying field has a
 * `quote`; the engine verifies each quote verbatim (whitespace-normalized
 * substring) against the page's main text and drops the field when the quote
 * is not found (`droppedQuotes` counts them). Page text is untrusted data.
 */

/** Bump on any prompt or schema change; part of the profile cache key. */
export const PAGE_PROFILE_PROMPT_VERSION = "2";

export const PAGE_TYPES = [
  "home",
  "service",
  "product",
  "category",
  "location",
  "about",
  "contact",
  "guide",
  "article",
  "faq",
  "explainer",
  "event",
  "legal",
  "other",
] as const;

/** Page types SUPP-15 treats as informational. */
export const INFORMATIONAL_PAGE_TYPES = [
  "guide",
  "article",
  "faq",
  "explainer",
] as const;

const quote = z.string().min(1).max(400);

const nameSpanSchema = z.object({
  kind: z.enum(["brand", "person", "place"]),
  text: z.string().min(1).max(200),
  quote,
});

const statSchema = z.object({
  /** What the number is about, short and normalizable ("events run", "years in business"). */
  subject: z.string().min(1).max(120),
  value: z.string().min(1).max(60),
  unit: z.string().max(40).nullable(),
  quote,
});

const priceSchema = z.object({
  item: z.string().min(1).max(160),
  value: z.string().min(1).max(80),
  terms: z.string().max(200).nullable(),
  quote,
});

const awardSchema = z.object({
  text: z.string().min(1).max(200),
  source: z.enum(["text", "imageAlt"]),
  hasYear: z.boolean(),
  hasSource: z.boolean(),
  quote,
});

const sectionSchema = z.object({
  heading: z.string().min(1).max(200),
  isQuestion: z.boolean(),
  /** The first 1–2 sentences answer the heading. */
  answerFirst: z.boolean(),
  quote,
});

const faqPairSchema = z.object({
  question: z.string().min(1).max(300),
  answerWords: z.number().int().nonnegative(),
  /** Answer reads correctly when lifted alone (no "above", "this", bare "Yes."). */
  standsAlone: z.boolean(),
  quote,
});

const textSpanSchema = z.object({ text: z.string().min(1).max(300), quote });

/** What the LLM returns (validated before quote verification). */
export const pageProfileExtractionSchema = z.object({
  pageType: z.enum(PAGE_TYPES),
  topic: z
    .string()
    .min(1)
    .max(120)
    .refine((t) => t.split(/\s+/).filter(Boolean).length <= 12, {
      message: "topic must be ≤ 12 words",
    }),
  names: z.array(nameSpanSchema).max(60),
  stats: z.array(statSchema).max(60),
  prices: z.array(priceSchema).max(40),
  superlatives: z.array(textSpanSchema).max(30),
  awards: z.array(awardSchema).max(30),
  /** Placeholder / template leftovers ("Lorem ipsum", "[City]", "Your text here"). */
  placeholders: z.array(textSpanSchema).max(30),
  undefinedAcronyms: z.array(textSpanSchema).max(30),
  faqQuestions: z.array(textSpanSchema).max(60),
  faqPairs: z.array(faqPairSchema).max(60),
  /** Dates / "updated" / "as of" strings. */
  freshness: z.array(textSpanSchema).max(20),
  ctaFirstScreen: textSpanSchema.nullable(),
  /** A compact block of key facts (who / what / where / price) near the top. */
  keyFactsBlock: textSpanSchema.nullable(),
  contact: z
    .array(
      z.object({
        kind: z.enum(["phone", "email", "address", "hours", "other"]),
        value: z.string().min(1).max(200),
        quote,
      }),
    )
    .max(20),
  sections: z.array(sectionSchema).max(60),
  /** For pages with a content video: transcript, short summary, or neither as page text. */
  videoText: z.enum(["transcript", "summary", "none"]).nullable(),
});
export type PageProfileExtraction = z.infer<typeof pageProfileExtractionSchema>;

/** Stored profile = verified extraction + provenance. */
export const pageProfileSchema = pageProfileExtractionSchema.extend({
  url: z.string().url(),
  /** sha256 of the main text the profile was extracted from (cache key part). */
  textSha256: z.string().regex(/^[0-9a-f]{64}$/),
  promptVersion: z.string(),
  model: z.string(),
  /** Template boilerplate profile instead of a page profile. */
  scope: z.enum(["page", "template"]),
  templateKey: z.string().nullable(),
  droppedQuotes: z.number().int().nonnegative(),
  /** Input over 100 k chars: chunks merged, tail not read. */
  truncated: z.boolean(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type PageProfile = z.infer<typeof pageProfileSchema>;

export const LLM_EXTRACT_MODEL_ENV = "HANDBOOK_LLM_EXTRACT_MODEL";
export const LLM_EXTRACT_DEFAULT_MODEL = "claude-haiku-5-5";
/** Main text is chunked at this many characters per map call. */
export const PAGE_PROFILE_CHUNK_CHARS = 24_000;
/** Beyond this the tail is not read and `truncated` is set. */
export const PAGE_PROFILE_MAX_CHARS = 100_000;
