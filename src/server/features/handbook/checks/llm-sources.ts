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
 * Checks get no off-site fetch under contracts 1.2.0, so the cited page is
 * not read: a claim with a working link is not judged against its source
 * text. Every PASS note says so (queue: WO-B4-003 ESCALATE part).
 */

const MAX_CLAIMS = 12;

const CLAIM =
  /\b(?:according to|stud(?:y|ies)|survey(?:ed|s)?|research(?:ers)?|report(?:ed|s)?|statistics?|data (?:from|shows?)|award(?:ed|s)?|winner|certified|ranked|rated)\b|\d(?:\.\d+)?\s?%/i;
const ATTRIBUTED_QUOTE = /["“][^"”]{12,}["”]\s*[—–-]\s*\p{Lu}/u;

type Claim = { sentence: string; link: string | null; status: string };

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
    const views: View[] = [];
    let kept = 0;
    let total = 0;
    for (const { page, claims } of pages) {
      total += claims.length;
      const take = claims.slice(0, MAX_CLAIMS - kept);
      if (take.length === 0) continue;
      kept += take.length;
      views.push({
        url: page.url,
        text: take
          .map(
            (c) =>
              `- ${c.sentence}\n  source: ${c.link ? `${c.link} (${c.status})` : "none cited"}`,
          )
          .join("\n"),
      });
    }
    if (views.length === 0)
      return only("P5-03", "NA", "no claims that need an outside source");
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
    return {
      ...result,
      statuses: result.statuses.map((s) =>
        s.status === "PASS"
          ? {
              ...s,
              note: `${s.note}${sampled}; cited pages not fetched (no off-site fetch for checks, contracts 1.2.0)`,
            }
          : s,
      ),
    };
  },
};
