import { createHash } from "node:crypto";
import { generateText, type LanguageModel } from "ai";
import {
  PAGE_PROFILE_CHUNK_CHARS,
  PAGE_PROFILE_MAX_CHARS,
  PAGE_PROFILE_PROMPT_VERSION,
  pageProfileExtractionSchema,
  type PageProfile,
  type PageProfileExtraction,
} from "@/server/features/handbook/contracts/page-profile";
import { normalizeUrl } from "../checks/support";
import { isCreditError, LLM_MAX_RETRIES, type ModelPrice } from "./judge";
import type { MapJob } from "./map-input";
import { MAP_SYSTEM_PROMPT } from "./map-prompt";

/**
 * Map stage (ADR-019, FULL-READ §5.1): one PageProfile per HTML 200 page,
 * one per template for its boilerplate, one per llms.txt file. The input is
 * head lines + page-unique text blocks (template boilerplate removed),
 * rendered-only blocks marked, image alt / file name lines and video lines.
 * Page text is untrusted data. Every quote the model returns is checked as
 * a whitespace-normalized, case-sensitive substring of that input; fields
 * whose quote is not found are dropped and counted. Profiles are cached by
 * (url, sha256(input), prompt version, model): a hit costs nothing.
 */

export type ProfileCacheKey = {
  url: string;
  textSha256: string;
  promptVersion: string;
  model: string;
};

export type ProfileCache = {
  get: (key: ProfileCacheKey) => Promise<PageProfile | null>;
  put: (profile: PageProfile) => Promise<void>;
};

export type MapOutcome =
  | { profile: PageProfile; cached: boolean }
  | { profile: null; reason: "budget" | "credits" | "schema" | "error" };

export type PageMapper = {
  modelId: string;
  profile: (job: MapJob) => Promise<MapOutcome>;
  spentUsd: () => number;
};

/** Measured ≈ 3 k tokens per why page (B9 run 43); room so long pages are not cut mid-JSON. */
const MAX_OUTPUT_TOKENS = 8_000;

/** ≤ 24 k-char chunks on line boundaries; text past 100 k chars is not read. */
function chunkText(text: string): { chunks: string[]; truncated: boolean } {
  const truncated = text.length > PAGE_PROFILE_MAX_CHARS;
  const body = truncated ? text.slice(0, PAGE_PROFILE_MAX_CHARS) : text;
  const chunks: string[] = [];
  let current = "";
  for (const line of body.split("\n")) {
    for (
      let i = 0;
      i < Math.max(1, line.length);
      i += PAGE_PROFILE_CHUNK_CHARS
    ) {
      const piece = line.slice(i, i + PAGE_PROFILE_CHUNK_CHARS);
      if (
        current &&
        current.length + 1 + piece.length > PAGE_PROFILE_CHUNK_CHARS
      ) {
        chunks.push(current);
        current = "";
      }
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current.trim()) chunks.push(current);
  return { chunks, truncated };
}

// ---------------------------------------------------------------------------
// Output repair, merge, quote verification
// ---------------------------------------------------------------------------

type ArrayField = {
  [K in keyof PageProfileExtraction]: PageProfileExtraction[K] extends readonly unknown[]
    ? K
    : never;
}[keyof PageProfileExtraction];

const ARRAY_FIELDS = [
  "names",
  "stats",
  "prices",
  "superlatives",
  "awards",
  "placeholders",
  "undefinedAcronyms",
  "faqQuestions",
  "faqPairs",
  "freshness",
  "contact",
  "sections",
] as const satisfies readonly ArrayField[];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Validates model output, repairing what the schema rejects instead of losing
 * the page: over-long arrays are cut to their limit, invalid items dropped,
 * an over-long topic cut to 12 words. Two passes; null when still invalid.
 */
function parseExtraction(value: unknown): PageProfileExtraction | null {
  if (!isRecord(value)) return null;
  let draft: Record<string, unknown> = { ...value };
  for (let pass = 0; pass < 3; pass++) {
    const parsed = pageProfileExtractionSchema.safeParse(draft);
    if (parsed.success) return parsed.data;
    const next: Record<string, unknown> = { ...draft };
    const dropItems = new Map<string, Set<number>>();
    for (const issue of parsed.error.issues) {
      const [field, index] = issue.path;
      if (typeof field !== "string") return null;
      const current = next[field];
      if (field === "topic" && typeof current === "string") {
        next.topic = current
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 12)
          .join(" ")
          .slice(0, 120);
      } else if (Array.isArray(current) && typeof index === "number") {
        const set = dropItems.get(field) ?? new Set<number>();
        set.add(index);
        dropItems.set(field, set);
      } else if (
        Array.isArray(current) &&
        issue.code === "too_big" &&
        typeof issue.maximum === "number"
      ) {
        next[field] = current.slice(0, Number(issue.maximum));
      } else if (
        current === undefined &&
        ARRAY_FIELDS.some((f) => f === field)
      ) {
        next[field] = [];
      } else if (
        ["ctaFirstScreen", "keyFactsBlock", "videoText"].includes(field)
      ) {
        next[field] = null;
      } else {
        return null;
      }
    }
    for (const [field, drop] of dropItems) {
      const list = next[field];
      if (Array.isArray(list))
        next[field] = list.filter((_, i) => !drop.has(i));
    }
    draft = next;
  }
  return null;
}

/** Chunk profiles → one: first chunk's type/topic, arrays concatenated and de-duplicated. */
function mergeExtractions(
  list: readonly PageProfileExtraction[],
): PageProfileExtraction | null {
  const [first] = list;
  if (!first || list.length === 1) return first ?? null;
  const merged: Record<string, unknown> = { ...first };
  for (const field of ARRAY_FIELDS) {
    const seen = new Set<string>();
    merged[field] = list
      .flatMap((p) => p[field] as readonly unknown[])
      .filter((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
  merged.ctaFirstScreen =
    list.find((p) => p.ctaFirstScreen)?.ctaFirstScreen ?? null;
  merged.keyFactsBlock =
    list.find((p) => p.keyFactsBlock)?.keyFactsBlock ?? null;
  const video = list.map((p) => p.videoText);
  merged.videoText = video.includes("transcript")
    ? "transcript"
    : video.includes("summary")
      ? "summary"
      : video.includes("none")
        ? "none"
        : null;
  return parseExtraction(merged);
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/** Drops every field whose quote is not in `text`; returns the count dropped. */
function verifyQuotes(
  extraction: PageProfileExtraction,
  text: string,
): { extraction: PageProfileExtraction; dropped: number } {
  const haystack = normalize(text);
  const found = (quote: string) => {
    const needle = normalize(quote);
    return needle.length > 0 && haystack.includes(needle);
  };
  let dropped = 0;
  const keep = <T extends { quote: string }>(items: readonly T[]): T[] =>
    items.filter((item) => {
      if (found(item.quote)) return true;
      dropped += 1;
      return false;
    });
  const one = <T extends { quote: string }>(item: T | null): T | null => {
    if (!item || found(item.quote)) return item;
    dropped += 1;
    return null;
  };
  const verified: PageProfileExtraction = {
    ...extraction,
    names: keep(extraction.names),
    stats: keep(extraction.stats),
    prices: keep(extraction.prices),
    superlatives: keep(extraction.superlatives),
    awards: keep(extraction.awards),
    placeholders: keep(extraction.placeholders),
    undefinedAcronyms: keep(extraction.undefinedAcronyms),
    faqQuestions: keep(extraction.faqQuestions),
    faqPairs: keep(extraction.faqPairs),
    freshness: keep(extraction.freshness),
    contact: keep(extraction.contact),
    sections: keep(extraction.sections),
    ctaFirstScreen: one(extraction.ctaFirstScreen),
    keyFactsBlock: one(extraction.keyFactsBlock),
  };
  return { extraction: verified, dropped };
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/** The first `{` … last `}` of the model's answer, parsed; undefined if not JSON. */
function jsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export function createPageMapper(options: {
  model: LanguageModel;
  modelId: string;
  price: ModelPrice;
  /** Map share of the run's LLM budget (ADR-019: ≤ 60 %), read before every page. */
  budgetUsd: () => number;
  cache: ProfileCache;
  log?: (event: string, fields: Record<string, unknown>) => void;
}): PageMapper {
  let spent = 0;
  /** Set by the first 402; later pages are not sent. */
  let noCredits = false;
  const cost = (tokensIn: number, tokensOut: number) =>
    (tokensIn * options.price.input + tokensOut * options.price.output) / 1e6;

  /**
   * One chunk → extraction. JSON as plain text (the full schema is too large
   * for Anthropic's structured-output grammar), repaired locally; one retry.
   */
  const extract = async (chunk: string, usage: { in: number; out: number }) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await generateText({
        model: options.model,
        // Fixed prefix first: providers that cache prompt prefixes reuse it.
        system: MAP_SYSTEM_PROMPT,
        prompt: chunk,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxRetries: LLM_MAX_RETRIES,
      });
      usage.in += result.usage.inputTokens ?? 0;
      usage.out += result.usage.outputTokens ?? 0;
      const parsed = parseExtraction(jsonObject(result.text));
      if (parsed) return parsed;
    }
    return null;
  };

  const profile = async (job: MapJob): Promise<MapOutcome> => {
    const key: ProfileCacheKey = {
      url: normalizeUrl(job.url),
      textSha256: sha256(job.text),
      promptVersion: PAGE_PROFILE_PROMPT_VERSION,
      model: options.modelId,
    };
    const hit = await options.cache.get(key);
    if (hit && hit.scope === job.scope) return { profile: hit, cached: true };

    const { chunks, truncated } = chunkText(job.text);
    // ~4 characters per token; checked before the calls so the map share is
    // never overshot by more than one page's estimate error.
    const estimate = cost(
      Math.ceil(
        (job.text.length + MAP_SYSTEM_PROMPT.length * chunks.length) / 4,
      ),
      MAX_OUTPUT_TOKENS * chunks.length,
    );
    if (noCredits) return { profile: null, reason: "credits" };
    if (spent + estimate > options.budgetUsd())
      return { profile: null, reason: "budget" };

    const usage = { in: 0, out: 0 };
    const parts: PageProfileExtraction[] = [];
    try {
      for (const chunk of chunks) {
        const part = await extract(chunk, usage);
        if (part) parts.push(part);
      }
    } catch (error) {
      spent += cost(usage.in, usage.out);
      options.log?.("handbook.map.error", {
        url: job.url,
        error: String(error).slice(0, 300),
      });
      noCredits ||= isCreditError(error);
      return { profile: null, reason: noCredits ? "credits" : "error" };
    }
    const costUsd = cost(usage.in, usage.out);
    spent += costUsd;
    const merged = mergeExtractions(parts);
    if (!merged) return { profile: null, reason: "schema" };
    const { extraction, dropped } = verifyQuotes(merged, job.text);
    const result: PageProfile = {
      ...extraction,
      url: key.url,
      textSha256: key.textSha256,
      promptVersion: key.promptVersion,
      model: key.model,
      scope: job.scope,
      templateKey: job.templateKey,
      droppedQuotes: dropped,
      truncated,
      tokensIn: usage.in,
      tokensOut: usage.out,
      costUsd,
    };
    await options.cache.put(result);
    return { profile: result, cached: false };
  };

  return { modelId: options.modelId, profile, spentUsd: () => spent };
}
