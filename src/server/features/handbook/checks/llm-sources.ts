import { sort } from "remeda";
import type {
  CheckContext,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { type View, htmlPages, judged, only } from "./llm-copy";
import { normalizeUrl } from "./support";

/**
 * WO-B4-003 source check (P5-03, handbook §0 EP-1, §6). Step 1 picks claim
 * sentences that need an outside source (studies, surveys, "according to",
 * percentages, attributed quotations, awards); step 2 pairs each with the
 * off-site link cited in it and that link's status from the outbound
 * collector; the judge decides which claims lack a working source.
 *
 * Rule: "Source check: every citation, study, quotation, testimonial and
 * external stat fetched and confirmed at the source; none invented".
 * WO-B6-061: with `ctx.fetchOffsite` (contracts 1.3.0, runner cap 10) up to
 * 10 cited pages are fetched; the passage matching the claim goes to the
 * judge and is stored as evidence (cited URL + snippet). Without it (old
 * runner) the cited page is not read and the PASS note says so.
 */

const MAX_CLAIMS = 12;
const MAX_SOURCE_FETCHES = 10;
const SNIPPET_CHARS = 240;

const CLAIM =
  /\b(?:according to|stud(?:y|ies)|survey(?:ed|s)?|research(?:ers)?|report(?:ed|s)?|statistics?|data (?:from|shows?)|award(?:ed|s)?|winner|certified|ranked|rated)\b|\d(?:\.\d+)?\s?%/i;
const ATTRIBUTED_QUOTE = /["“][^"”]{12,}["”]\s*[—–-]\s*\p{Lu}/u;

type Claim = { sentence: string; link: string | null; status: string };
type Fetched = { status: number; snippet: string | null };

const pageText = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

/** Numbers in the claim first, else its three longest words. */
function claimTokens(sentence: string): string[] {
  const numbers = sentence.match(/\d+(?:[.,]\d+)?\s?%?/g) ?? [];
  if (numbers.length > 0) return numbers.map((n) => n.trim());
  return sort(
    sentence.split(/\W+/).filter((w) => w.length >= 6),
    (a, b) => b.length - a.length,
  ).slice(0, 3);
}

/** The passage of the cited page around the first claim token, if any. */
function matchingSnippet(text: string, sentence: string): string | null {
  const lower = text.toLowerCase();
  for (const token of claimTokens(sentence)) {
    const at = lower.indexOf(token.toLowerCase());
    if (at < 0) continue;
    const start = Math.max(0, at - SNIPPET_CHARS / 2);
    return text.slice(start, start + SNIPPET_CHARS).trim();
  }
  return null;
}

async function fetchSources(
  ctx: CheckContext,
  claims: readonly Claim[],
): Promise<Map<string, Fetched> | null> {
  const fetchOffsite = ctx.fetchOffsite;
  if (!fetchOffsite) return null;
  const links = [
    ...new Set(claims.flatMap((c) => (c.link ? [c.link] : []))),
  ].slice(0, MAX_SOURCE_FETCHES);
  const out = new Map<string, Fetched>();
  for (const link of links) {
    try {
      const res = await fetchOffsite(link);
      const text = pageText(res.body);
      const sentences = claims.filter((c) => c.link === link);
      out.set(link, {
        status: res.status,
        snippet:
          sentences
            .map((c) => matchingSnippet(text, c.sentence))
            .find((x) => x !== null) ?? null,
      });
    } catch {
      out.set(link, { status: 0, snippet: null });
    }
  }
  return out;
}

function claimSentences(text: string): string[] {
  const out = new Set<string>();
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/)) {
    const sentence = raw.trim();
    if (sentence.length < 20 || sentence.length > 300) continue;
    if (CLAIM.test(sentence) || ATTRIBUTED_QUOTE.test(sentence))
      out.add(sentence);
  }
  return [...out];
}

function claimsOf(ctx: CheckContext, page: PageSnapshot): Claim[] {
  const host = new URL(ctx.origin).hostname.replace(/^www\./, "");
  const offsite = page.links.filter((l) => {
    try {
      return new URL(l.href).hostname.replace(/^www\./, "") !== host;
    } catch {
      return false;
    }
  });
  const outbound = ctx.collected.outbound;
  const statusOf = (href: string) => {
    if (outbound.status !== "ok") return "status unknown";
    const hit = outbound.links.find(
      (l) => normalizeUrl(l.url) === normalizeUrl(href),
    );
    if (!hit?.browser) return hit ? "unreachable" : "status unknown";
    return `HTTP ${hit.browser.status}`;
  };
  return claimSentences(page.markup.text).map((sentence) => {
    const cited = offsite.find(
      (l) => l.text.trim().length >= 3 && sentence.includes(l.text.trim()),
    );
    return cited
      ? { sentence, link: cited.href, status: statusOf(cited.href) }
      : { sentence, link: null, status: "" };
  });
}

export const sourceCheck: HandbookCheck = {
  id: "llm.source-check",
  itemIds: ["P5-03"],
  class: "LLM",
  requires: ["pages"],
  run: async (ctx) => {
    // Pages with off-site links first: their claims are the likeliest cited.
    const pages = htmlPages(ctx)
      .map((p) => ({ page: p, claims: claimsOf(ctx, p) }))
      .filter((p) => p.claims.length > 0);
    pages.sort(
      (a, b) =>
        Number(b.claims.some((c) => c.link)) -
        Number(a.claims.some((c) => c.link)),
    );
    const picked: { url: string; claims: Claim[] }[] = [];
    let kept = 0;
    let total = 0;
    for (const { page, claims } of pages) {
      total += claims.length;
      const take = claims.slice(0, MAX_CLAIMS - kept);
      if (take.length === 0) continue;
      kept += take.length;
      picked.push({ url: page.url, claims: take });
    }
    if (picked.length === 0)
      return only("P5-03", "NA", "no claims that need an outside source");
    const fetched = await fetchSources(
      ctx,
      picked.flatMap((p) => p.claims),
    );
    const sourceLine = (c: Claim) => {
      if (!c.link) return "none cited";
      const f = fetched?.get(c.link);
      if (!f) return `${c.link} (${c.status})`;
      return `${c.link} (fetched: HTTP ${f.status})\n  source text: ${f.snippet ? `"${f.snippet}"` : "no passage matching the claim found"}`;
    };
    const views: View[] = picked.map((p) => ({
      url: p.url,
      text: p.claims
        .map((c) => `- ${c.sentence}\n  source: ${sourceLine(c)}`)
        .join("\n"),
    }));
    const result = await judged(
      ctx,
      {
        itemId: "P5-03",
        rubricId: "source-check",
        title: "Claims without a working source",
        fix: "Link each study, survey, external statistic, quotation and award to the page that states it (and check that page says the same), or remove the claim (§0 EP-1, §6).",
        effort: "S",
      },
      views,
    );
    const sampled = total > kept ? `, sampled ${kept} of ${total} claims` : "";
    const sources = [...(fetched ?? [])].map(([url, f], i) => ({
      ref: `source:${i}`,
      kind: "url" as const,
      url,
      excerpt: `HTTP ${f.status}${f.snippet ? `\n${f.snippet}` : "\nno passage matching the claim found"}`,
    }));
    const sourceRefs = sources.map((e) => e.ref);
    const fetchNote = fetched
      ? `; ${fetched.size} cited page(s) fetched and quoted to the judge`
      : "; cited pages not fetched (runner without off-site fetch for checks)";
    return {
      ...result,
      evidence: [...result.evidence, ...sources],
      findings: result.findings.map((f) => ({
        ...f,
        evidenceRefs: [...f.evidenceRefs, ...sourceRefs],
      })),
      statuses: result.statuses.map((s) => ({
        ...s,
        evidenceRefs: [...s.evidenceRefs, ...sourceRefs],
        ...(s.status === "PASS"
          ? { note: `${s.note}${sampled}${fetchNote}` }
          : {}),
      })),
    };
  },
};
