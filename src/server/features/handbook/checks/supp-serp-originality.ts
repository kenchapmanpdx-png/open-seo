import type {
  CheckResult,
  EvidenceDraft,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import {
  serpOriginalitySchema,
  type ScaledContent,
  type SerpBlockedReason,
  type SerpJudge,
  type SerpOriginality,
  type SerpVerdict,
} from "@/server/features/handbook/contracts/scaled-copy";
import { mainText } from "./llm-views";
import { createResult, normalizeUrl } from "./support";

/**
 * SUPP-18 original value vs the top-10 results (SCALED-COPY §3.3, ADR-024).
 * Reads the collection (`ctx.serpOriginality`, WO-B11-008) and asks its
 * judge, on the SUPP-18 budget, one verdict per page. Quotes must appear
 * verbatim on the audited page; unverified ones are dropped, and a "has an
 * original element" verdict left without a verified quote is unsure. Below
 * 0.7 confidence the verdict is asked again; a different answer → unsure.
 * A finding only for a confident "none". Each page's record is stored as an
 * `artifact`; the scaled-content summary counts them (`supp18Summary`).
 * Option off → nothing listed. Not scored (ADR-020).
 */
const ITEM = "SUPP-18";
export const SERP_ORIGINALITY_CHECK_ID = "llm.supp-serp-originality";
const STABLE_CONFIDENCE = 0.7;
const PAGE_TEXT_CHARS = 8_000;

const FIX =
  "Add at least one first-party element: own data, a test, a case, an expert quote or a worked example. Google guidance on generative AI content: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content";

type Verdict = NonNullable<SerpOriginality["verdict"]>;

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/** Keep the elements quoted verbatim on the page; a "yes" with none left is unsure. */
function verified(v: SerpVerdict, pageText: string): Verdict {
  const text = normalize(pageText);
  const elements = v.elements.filter((e) => {
    const quote = normalize(e.quote);
    return quote.length > 0 && text.includes(quote);
  });
  return {
    ...v,
    elements: v.hasOriginalElement ? elements : [],
    unsure: v.hasOriginalElement && elements.length === 0,
  };
}

/** First verdict, asked again below 0.7; disagreement → unsure (FULL-READ §5.7). */
async function stableVerdict(
  judge: SerpJudge,
  input: Parameters<SerpJudge>[0],
  pageText: string,
): Promise<Verdict | "budget"> {
  const raw = await judge(input);
  if (raw === "budget") return "budget";
  const first = verified(raw, pageText);
  if (first.unsure || first.confidence >= STABLE_CONFIDENCE) return first;
  const again = await judge(input);
  if (again === "budget") return { ...first, unsure: true };
  const second = verified(again, pageText);
  if (second.hasOriginalElement !== first.hasOriginalElement)
    return { ...first, unsure: true };
  return second.confidence > first.confidence ? second : first;
}

const isFinding = (v: Verdict | null) =>
  !!v &&
  !v.unsure &&
  !v.hasOriginalElement &&
  v.confidence >= STABLE_CONFIDENCE;

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, "");

function artifact(ref: string, record: SerpOriginality): EvidenceDraft {
  const state = record.blocked
    ? `BLOCKED ${record.blocked}`
    : record.verdict
      ? `original element ${record.verdict.unsure ? "unsure" : record.verdict.hasOriginalElement ? "yes" : "no"} (confidence ${record.verdict.confidence.toFixed(2)})`
      : "no verdict";
  return {
    ref,
    kind: "artifact",
    url: record.url,
    excerpt: `SUPP-18 · query "${record.query}" (${record.location}, ${record.language}) · ${record.results.filter((r) => r.fetch === "ok").length}/${record.results.length} results read · ${state}`,
    body: {
      bytes: new TextEncoder().encode(JSON.stringify(record)),
      contentType: "application/json",
    },
  };
}

export const suppSerpOriginalityCheck: HandbookCheck = {
  id: SERP_ORIGINALITY_CHECK_ID,
  itemIds: [ITEM],
  // Not "LLM": SUPP-18 has its own judge and budget (ADR-024); the run
  // judge's absence or budget stop must not block it.
  class: "CRAWL",
  requires: ["pages"],
  async run(ctx) {
    const out = createResult([ITEM]);
    const serp = ctx.serpOriginality;
    if (!serp) return out.build();
    if (serp.status === "na") {
      out.na(ITEM, serp.note);
      return out.build();
    }
    if (serp.pages.length === 0) {
      out.na(
        ITEM,
        "no service, product, guide, article or category page to compare",
      );
      return out.build();
    }
    const snapshots =
      ctx.collected.pages.status === "ok" ? ctx.collected.pages.snapshots : [];
    const pageOf = new Map(snapshots.map((s) => [normalizeUrl(s.url), s]));
    const profileOf = new Map(
      (ctx.pageProfiles ?? [])
        .filter((p) => p.scope === "page")
        .map((p) => [normalizeUrl(p.url), p]),
    );

    const artifacts: EvidenceDraft[] = [];
    let findings = 0;
    let budgetOut = !serp.judge;
    let checked = 0;
    let firstBlocked: SerpBlockedReason | null = null;
    for (const [
      i,
      { record: collected, competitors },
    ] of serp.pages.entries()) {
      let record: SerpOriginality = collected;
      const page = pageOf.get(normalizeUrl(record.url));
      if (!record.blocked && (budgetOut || !page))
        record = { ...record, blocked: "llm budget" };
      if (!record.blocked && serp.judge && page) {
        const verdict = await stableVerdict(
          serp.judge,
          {
            url: page.url,
            title: page.head.title ?? "",
            h1: page.h1[0] ?? "",
            text: mainText(page, PAGE_TEXT_CHARS),
            profile: profileOf.get(normalizeUrl(page.url)) ?? null,
            competitors,
          },
          page.markup.text,
        );
        if (verdict === "budget") {
          budgetOut = true;
          record = { ...record, blocked: "llm budget" };
        } else record = { ...record, verdict };
      }
      if (record.verdict) checked += 1;
      firstBlocked ??= record.blocked;
      const ref = `artifact:${record.url}:serp-${i}`;
      artifacts.push(artifact(ref, record));
      for (const e of record.verdict?.elements ?? [])
        out.evidence("textQuote", record.url, `${e.type}: "${e.quote}"`);
      if (!isFinding(record.verdict)) continue;
      findings += 1;
      const read = record.results.filter((r) => r.fetch === "ok");
      out.finding({
        itemIds: [ITEM],
        severity: "S3",
        title: `Nothing on this page that the top-10 results for "${record.query}" lack`,
        detail: [
          `Query "${record.query}" (derived from the title, H1 and topic; ${record.location}, ${record.language}).`,
          `Compared with ${competitors.length} result pages: ${read.map((r) => hostOf(r.url)).join(", ")}.`,
          `No first-party data, test, case, expert quote or worked example that those pages lack (confidence ${record.verdict?.confidence.toFixed(2)}).`,
        ].join("\n"),
        fix: FIX,
        fixability: "FIXABLE",
        effort: "M",
        urls: [record.url],
        evidenceRefs: [ref],
      });
    }

    if (findings === 0) {
      if (checked > 0)
        out.pass(
          ITEM,
          `${checked} page(s) checked: none lacks an original element (unsure verdicts shown, not findings)`,
          artifacts.map((a) => a.ref),
        );
      else out.blocked(ITEM, firstBlocked ?? serp.blocked ?? "llm budget");
    }
    const built = out.build();
    return {
      ...built,
      findings: built.findings.map((f) => ({ ...f, source: "llm" as const })),
      evidence: [...built.evidence, ...artifacts],
    };
  },
};

function recordOf(a: EvidenceDraft): SerpOriginality | null {
  if (a.kind !== "artifact" || !a.body) return null;
  try {
    const json: unknown = JSON.parse(new TextDecoder().decode(a.body.bytes));
    return serpOriginalitySchema.safeParse(json).data ?? null;
  } catch {
    return null;
  }
}

/**
 * Scaled-content summary row (§3.5) from the SUPP-18 check result: pages with
 * a verdict, confident "none" findings, BLOCKED pages, and the N/A or BLOCKED
 * note. Undefined when the option was off (the check listed nothing).
 */
export function supp18Summary(
  result: CheckResult | undefined,
): ScaledContent["supp18"] {
  const status = result?.statuses.find((s) => s.itemId === ITEM);
  if (!result || !status) return undefined;
  const records = result.evidence.flatMap((e) => recordOf(e) ?? []);
  return {
    checked: records.filter((r) => r.verdict).length,
    withoutOriginalElement: records.filter((r) => isFinding(r.verdict)).length,
    blocked: records.filter((r) => r.blocked).length,
    note:
      status.status === "NA" || status.status === "BLOCKED"
        ? (status.note ?? null)
        : null,
  };
}
