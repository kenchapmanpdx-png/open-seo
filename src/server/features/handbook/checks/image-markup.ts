import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * PERF/CRAWL (handbook §15): every `<img>` declares width + height (CSS
 * aspect-ratio is not visible in raw HTML, so only attributes count) and the
 * hero (first image in document order) is eager, `fetchpriority="high"` and
 * has a srcset (P7-02); the hero is a real `<img src>` in the initial HTML,
 * not a data-src/placeholder loader, in a web photo format (P7-03; display
 * size needs Lighthouse). One finding per template (ADR-006).
 */
const ITEMS = ["P7-02", "P7-03"];

type Img = PageSnapshot["images"][number];

const PLACEHOLDER = /^data:|placeholder|blank\.gif|spacer\.gif|1x1/i;
const BAD_FORMAT = /\.(bmp|tiff?)(\?|$)/i;

const live = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  /html/i.test(s.contentType ?? "html");

const imgTag = (i: Img) =>
  `<img src="${i.src}"${i.dataSrc ? ` data-src="${i.dataSrc}"` : ""}${i.srcset ? " srcset=…" : ""}${i.width ? ` width="${i.width}"` : ""}${i.height ? ` height="${i.height}"` : ""}${i.loading ? ` loading="${i.loading}"` : ""}${i.fetchpriority ? ` fetchpriority="${i.fetchpriority}"` : ""}>`;

function dimensionProblems(s: PageSnapshot): string[] {
  const why: string[] = [];
  const noSize = s.images.filter((i) => !i.width || !i.height);
  if (noSize.length > 0)
    why.push(`${noSize.length} <img> without width+height`);
  const hero = s.images[0];
  if (hero) {
    if (hero.loading?.toLowerCase() === "lazy") why.push("hero loading=lazy");
    if (hero.fetchpriority?.toLowerCase() !== "high")
      why.push('hero lacks fetchpriority="high"');
    if (!hero.srcset) why.push("hero has no srcset");
  }
  return why;
}

function heroProblems(s: PageSnapshot): string[] {
  const hero = s.images[0];
  if (!hero) return [];
  const why: string[] = [];
  const src = hero.src.trim();
  if (hero.dataSrc) why.push(`hero uses data-src loader (${hero.dataSrc})`);
  if (!src || src === s.finalUrl || PLACEHOLDER.test(src))
    why.push(`hero src is empty/placeholder ("${src.slice(0, 60)}")`);
  if (BAD_FORMAT.test(src))
    why.push(`hero in ${/\.(\w+)(\?|$)/.exec(src)?.[1]} format`);
  return why;
}

export const imageMarkupCheck: HandbookCheck = {
  id: "perf.image-markup",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, templates } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const withImages = pages.snapshots.filter(
      (s) => live(s) && s.images.length > 0,
    );
    if (withImages.length === 0) {
      for (const id of ITEMS) out.na(id, "no <img> on crawled pages");
      return out.build();
    }
    const templateOf = new Map<string, string>();
    if (templates.status === "ok")
      for (const t of templates.templates)
        for (const url of t.urls) templateOf.set(normalizeUrl(url), t.key);
    const ref = (s: PageSnapshot) =>
      out.evidence(
        "rawHtml",
        s.url,
        s.images.slice(0, 8).map(imgTag).join("\n"),
        s.rawKey,
      );
    const perTemplate = (
      itemId: string,
      title: string,
      fix: string,
      problems: (s: PageSnapshot) => string[],
    ) => {
      const groups = new Map<string, { s: PageSnapshot; why: string[] }[]>();
      for (const s of withImages) {
        const why = problems(s);
        if (why.length === 0) continue;
        const key = templateOf.get(normalizeUrl(s.url)) ?? "";
        groups.set(key, [...(groups.get(key) ?? []), { s, why }]);
      }
      for (const [key, hits] of groups) {
        out.finding({
          itemIds: [itemId],
          severity: "S3",
          title,
          detail: hits
            .map(({ s, why }) => `${s.url} — ${why.join("; ")}`)
            .join("\n"),
          fix,
          fixability: "FIXABLE",
          effort: "S",
          urls: hits.map(({ s }) => s.url),
          ...(key ? { templateKey: key } : {}),
          evidenceRefs: hits.slice(0, 10).map(({ s }) => ref(s)),
        });
      }
    };
    perTemplate(
      "P7-02",
      "Images without dimensions / hero not prioritised",
      'Give every <img> width and height; load the hero eagerly with fetchpriority="high" and a srcset.',
      dimensionProblems,
    );
    perTemplate(
      "P7-03",
      "Hero image not in the initial HTML",
      "Put the hero/LCP image in the server HTML as <img src> (no data-src loader or JS carousel), as JPEG/WebP/AVIF.",
      heroProblems,
    );
    const sample = withImages.slice(0, 5).map(ref);
    out.pass(
      "P7-02",
      `${withImages.length} pages: every <img> sized, hero eager + fetchpriority=high + srcset (CSS aspect-ratio not visible)`,
      sample,
    );
    out.pass(
      "P7-03",
      `${withImages.length} pages: hero is a real <img src> in server HTML (display size needs Lighthouse)`,
      sample,
    );
    return out.build();
  },
};
