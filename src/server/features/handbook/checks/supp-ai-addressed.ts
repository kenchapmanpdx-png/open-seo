import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  AiAddressedText,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * SUPP-19 text addressed to AI assistants (SCALED-COPY §3.4, ADR-022). Reads
 * the crawl's raw-HTML scan (`PageSnapshot.aiAddressed`, engine/ai-addressed)
 * and, when the render ran, the texts JS removed after load (hidden). One
 * finding per page: S2 when any match is hidden, S3 when all are visible.
 * English patterns only: pages with another `lang` are not checked (LIMITED).
 * `/llms.txt`, `/llms-full.txt`, `.md` mirrors and `robots.txt` are excluded
 * (handbook §20–§22 formats). Not scored (ADR-020).
 */
const ITEM = "SUPP-19";
const EXCLUDED = /^\/(?:llms(?:-full)?\.txt|robots\.txt)$|\.md$/i;

const FIX =
  "Remove it. Google's spam policies cover attempts to manipulate generative AI responses (2026-05-15): https://developers.google.com/search/docs/essentials/spam-policies";

const isEnglish = (s: PageSnapshot) => {
  const lang = s.head.lang?.trim().toLowerCase();
  return !lang || lang === "en" || lang.startsWith("en-");
};

const line = (t: AiAddressedText) =>
  `${t.location} · hidden ${t.hidden ? "Y" : "N"} · "${t.text}"`;

export const suppAiAddressedCheck: HandbookCheck = {
  id: "crawl.supp-ai-addressed",
  itemIds: [ITEM],
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult([ITEM]);
    const { pages, render } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const removed = new Map(
      render.status === "ok"
        ? render.pages.map((r) => [
            normalizeUrl(r.url),
            new Set(r.js.aiAddressedRemoved ?? []),
          ])
        : [],
    );
    const scanned = pages.snapshots.filter(
      (s) => s.status === 200 && !EXCLUDED.test(new URL(s.url).pathname),
    );
    const english = scanned.filter(isEnglish);
    const limited = scanned.length - english.length;
    const limitedNote = `LIMITED: ${limited} page(s) in another language not checked (English patterns only)`;
    let hits = 0;
    for (const s of english) {
      const gone = removed.get(normalizeUrl(s.url));
      const texts = (s.aiAddressed ?? []).map((t) =>
        !t.hidden && gone?.has(t.text) ? { ...t, hidden: true } : t,
      );
      if (texts.length === 0) continue;
      hits += 1;
      const hidden = texts.some((t) => t.hidden);
      const detail = texts.map(line).join("\n");
      out.finding({
        itemIds: [ITEM],
        severity: hidden ? "S2" : "S3",
        ...(hidden
          ? {}
          : { severityReason: "visible to readers (S3; hidden text is S2)" }),
        title: `Text addressed to AI assistants (${hidden ? "hidden" : "visible"})`,
        detail,
        fix: FIX,
        fixability: "FIXABLE",
        effort: "S",
        urls: [s.url],
        evidenceRefs: [
          out.evidence("rawHtml", s.url, `${s.url}\n${detail}`, s.rawKey),
        ],
      });
    }
    if (hits > 0) return out.build();
    if (english.length === 0) {
      out.na(ITEM, limited > 0 ? limitedNote : "no HTML pages to scan");
      return out.build();
    }
    const ref = out.evidence(
      "url",
      ctx.origin,
      `${english.length} pages scanned (text, comments, alt / title / aria-label, meta content, JSON-LD strings): no text addressed to AI assistants`,
    );
    out.pass(
      ITEM,
      [
        "no text addressed to AI assistants",
        ...(limited ? [limitedNote] : []),
      ].join("; "),
      [ref],
    );
    return out.build();
  },
};
