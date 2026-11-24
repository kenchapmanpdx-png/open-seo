import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl, pathOf } from "./support";

/**
 * Root-cause rules (B17 §9 #8, T5 / T6 / T17). One finding per cause instead
 * of the many symptom rows (thin, orphan, near-duplicate, self-redirect) it
 * produces:
 * - WordPress attachment pages published (P3-12): a page whose REST alternate
 *   link is `/wp-json/wp/v2/media/{id}`, or a URL listed in an
 *   `attachment-sitemap`.
 * - Placeholder copy (P5-04, deterministic part): lorem ipsum and the other
 *   stock filler texts, WordPress default posts.
 * - Theme demo content (P3-12): the placeholder pages plus the category, tag
 *   and author archives that list nothing else.
 * Findings only; the other P3-12 / P5-04 checks give the pass.
 */
const ITEMS = ["P3-12", "P5-04"];

const MEDIA_REST = /\/wp-json\/wp\/v2\/media\/\d+/;
const ATTACHMENT_SITEMAP = /attachment-sitemap/i;
const ARCHIVE = /\/(category|tag|author)\//;
/** Pages whose non-template links count as "the archive's own list". */
const NOT_A_POST =
  /\/(category|tag|author|page|feed)\/|\/wp-(content|json|admin)\//;
/** Stock filler and WordPress default content. */
const PLACEHOLDER =
  /lorem ipsum|dolor sit amet|far far away,? behind the word mountains|vokalia and consonantia|welcome to wordpress\. this is your first post|this is an example page\. it.s different from a blog post|just another wordpress site/i;
const THIN_WORDS = 50;
const MAX_EVIDENCE = 20;

const noindex = (s: PageSnapshot) =>
  /noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`);
const live = (s: PageSnapshot) =>
  s.status === 200 && normalizeUrl(s.finalUrl) === normalizeUrl(s.url);

function quoteAround(text: string, match: RegExpExecArray): string {
  const start = Math.max(0, match.index - 60);
  return text.slice(start, match.index + match[0].length + 60).trim();
}

export const rootCausesCheck: HandbookCheck = {
  id: "crawl.root-causes",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, sitemap } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const pagesLive = pages.snapshots.filter(live);

    // Attachment pages.
    const attachmentLocs =
      sitemap.status === "ok"
        ? sitemap.urls.filter((u) => ATTACHMENT_SITEMAP.test(u.source))
        : [];
    const listed = new Set(attachmentLocs.map((u) => normalizeUrl(u.loc)));
    const attachments = pagesLive.flatMap((s) => {
      const rest = s.markup.headLinks.find(
        (l) => l.rel === "alternate" && MEDIA_REST.test(l.href),
      );
      const inSitemap = listed.has(normalizeUrl(s.url));
      if (!rest && !inSitemap) return [];
      if (noindex(s) && !inSitemap) return [];
      return [{ s, rest: rest?.href ?? null, inSitemap }];
    });
    if (attachments.length > 0) {
      const thin = attachments.filter(
        ({ s }) => (s.mainWords ?? s.wordsRaw) < THIN_WORDS,
      ).length;
      const sitemapNote =
        attachmentLocs.length > 0
          ? `${attachmentLocs.length} URL(s) listed in ${[...new Set(attachmentLocs.map((u) => u.source))].join(", ")}; `
          : "";
      out.finding({
        itemIds: ["P3-12"],
        severity: "S3",
        title: `WordPress attachment pages are published (${attachments.length})`,
        detail: `${sitemapNote}${attachments.length} attachment page(s) read, ${thin} of them thin (< ${THIN_WORDS} words). Each uploaded image has its own page; these pages also show up as thin, orphan, near-duplicate and self-redirect rows in other findings.\n${attachments.map(({ s }) => `${s.url} — "${s.head.title ?? ""}"`).join("\n")}`,
        fix: "Turn off attachment pages: in Yoast SEO → Settings → Advanced → Media pages, keep 'Enable media pages' off (or WordPress 6.4+ default), which 301-redirects each attachment URL to the file and drops attachment-sitemap.xml. Then remove the attachment URLs from any menus.",
        fixability: "FIXABLE",
        effort: "S",
        urls: attachments.map(({ s }) => s.url),
        evidenceRefs: attachments
          .slice(0, MAX_EVIDENCE)
          .map(({ s, rest, inSitemap }) =>
            out.evidence(
              "rawHtml",
              s.url,
              [
                rest ? `<link rel="alternate" href="${rest}">` : null,
                inSitemap ? "listed in the attachment sitemap" : null,
                `<title>${s.head.title ?? ""}</title> · main words ${s.mainWords ?? s.wordsRaw}`,
              ]
                .filter(Boolean)
                .join("\n"),
              s.rawKey,
            ),
          ),
      });
    }

    // Placeholder copy.
    const placeholder = pagesLive.flatMap((s) => {
      const text = `${s.head.title ?? ""} ${s.markup.text}`;
      const match = PLACEHOLDER.exec(text);
      return match ? [{ s, quote: quoteAround(text, match) }] : [];
    });
    if (placeholder.length > 0) {
      out.finding({
        itemIds: ["P5-04"],
        severity: "S3",
        title: `Placeholder text published (${placeholder.length} page${placeholder.length === 1 ? "" : "s"})`,
        detail: placeholder
          .map(({ s, quote }) => `${s.url} — "${quote}"`)
          .join("\n"),
        fix: "Replace the filler text with real copy, or delete the page if it is theme demo content (then 301 or 410 its URL).",
        fixability: "FIXABLE",
        effort: "S",
        urls: placeholder.map(({ s }) => s.url),
        evidenceRefs: placeholder
          .slice(0, MAX_EVIDENCE)
          .map(({ s, quote }) =>
            out.evidence("textQuote", s.url, quote, s.rawKey),
          ),
      });
    }

    // Theme demo content: placeholder pages + archives listing only them.
    const demo = new Set(placeholder.map(({ s }) => normalizeUrl(s.url)));
    if (demo.size > 0) {
      const linkPages = new Map<string, number>();
      for (const s of pagesLive)
        for (const href of new Set(s.links.map((l) => normalizeUrl(l.href))))
          linkPages.set(href, (linkPages.get(href) ?? 0) + 1);
      const template = (href: string) =>
        (linkPages.get(href) ?? 0) > pagesLive.length / 2;
      const archives = pagesLive.filter((s) => {
        if (!ARCHIVE.test(pathOf(s.url))) return false;
        const own = [
          ...new Set(s.links.map((l) => normalizeUrl(l.href))),
        ].filter(
          (href) =>
            href.startsWith(ctx.origin) &&
            href !== normalizeUrl(s.url) &&
            !template(href) &&
            !NOT_A_POST.test(pathOf(href)) &&
            pathOf(href) !== "/",
        );
        return own.length > 0 && own.every((href) => demo.has(href));
      });
      const all = [...placeholder.map(({ s }) => s), ...archives];
      out.finding({
        itemIds: ["P3-12"],
        severity: "S3",
        title: `Theme demo content is published (${all.length} page${all.length === 1 ? "" : "s"})`,
        detail: `${placeholder.length} demo page(s) with placeholder text, ${archives.length} category / tag / author archive(s) that list only them:\n${all.map((s) => s.url).join("\n")}`,
        fix: "Delete the theme's demo posts, then the categories, tags and demo author left empty; 301 or 410 their URLs and drop them from the sitemap.",
        fixability: "FIXABLE",
        effort: "S",
        urls: all.map((s) => s.url),
        evidenceRefs: [
          ...placeholder
            .slice(0, 10)
            .map(({ s, quote }) =>
              out.evidence("textQuote", s.url, quote, s.rawKey),
            ),
          ...archives.slice(0, 10).map((s) =>
            out.evidence(
              "linkGraph",
              s.url,
              `lists only demo pages: ${s.links
                .map((l) => normalizeUrl(l.href))
                .filter((h) => demo.has(h))
                .slice(0, 5)
                .join(", ")}`,
              s.rawKey,
            ),
          ),
        ],
      });
    }
    return out.build();
  },
};
