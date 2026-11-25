import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl, parseUrl } from "./support";

/**
 * CRAWL (handbook §13, §10 Product variant URLs): hreflang sets are
 * self-referencing, carry x-default, and every crawled alternate is a 200
 * self-canonical page that lists this page back (P3-24; IP auto-redirects
 * cannot be seen from one region). Variant URLs (`?variant=`, `?color=`…)
 * answer 200 and canonicalise consistently — all to themselves or all to the
 * parent (P3-25; the recorded contract itself is owner evidence).
 */
const ITEMS = ["P3-24", "P3-25"];

const VARIANT = /^(variant|color|colour|size|sku)$/i;

const selfCanonical = (s: PageSnapshot) =>
  !s.head.canonical || normalizeUrl(s.head.canonical) === normalizeUrl(s.url);

const describe = (s: PageSnapshot) =>
  `${s.url} → ${s.status}; canonical ${s.head.canonical ?? "(none)"}`;

const hreflangTags = (s: PageSnapshot) =>
  s.head.hreflang
    .map((h) => `<link rel="alternate" hreflang="${h.lang}" href="${h.href}">`)
    .join("\n");

export const hreflangCheck: HandbookCheck = {
  id: "crawl.hreflang",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const byUrl = new Map(pages.snapshots.map((s) => [normalizeUrl(s.url), s]));
    const tagRef = (s: PageSnapshot) =>
      out.evidence("rawHtml", s.url, hreflangTags(s), s.rawKey);

    // P3-24
    const withHreflang = pages.snapshots.filter(
      (s) => s.status === 200 && s.head.hreflang.length > 0,
    );
    if (withHreflang.length === 0) {
      out.na("P3-24", "no hreflang annotations found");
    } else {
      // WO-B23-004: count what was verified; x-default is advice (S4).
      let declared = 0;
      let checked = 0;
      const noFallback: PageSnapshot[] = [];
      const issues = withHreflang.flatMap((s) => {
        const self = normalizeUrl(s.url);
        const hrefs = s.head.hreflang.map((h) => normalizeUrl(h.href));
        const why: string[] = [];
        if (!hrefs.includes(self)) why.push("no self-reference");
        if (!s.head.hreflang.some((h) => h.lang.toLowerCase() === "x-default"))
          noFallback.push(s);
        for (const href of new Set(hrefs)) {
          if (href === self) continue;
          declared += 1;
          const alt = byUrl.get(href);
          if (!alt) continue; // not crawled within budget
          checked += 1;
          if (alt.status !== 200 || !selfCanonical(alt)) {
            why.push(
              `${href} is ${alt.status}, canonical ${alt.head.canonical ?? "(none)"}`,
            );
          } else if (
            !alt.head.hreflang.some((h) => normalizeUrl(h.href) === self)
          ) {
            why.push(`${href} does not link back`);
          }
        }
        return why.length > 0 ? [{ s, why }] : [];
      });
      if (issues.length > 0) {
        out.finding({
          itemIds: ["P3-24"],
          severity: "S3",
          title: "Hreflang sets are not reciprocal / complete",
          detail: issues
            .map(({ s, why }) => `${s.url} — ${why.join("; ")}`)
            .join("\n"),
          fix: "On every language version list all alternates including itself; each alternate must be a 200 self-canonical page that lists the others back.",
          fixability: "FIXABLE",
          effort: "M",
          urls: issues.map(({ s }) => s.url),
          evidenceRefs: issues.slice(0, 20).map(({ s }) => tagRef(s)),
        });
      }
      if (noFallback.length > 0) {
        out.finding({
          itemIds: ["P3-24"],
          severity: "S4",
          severityReason: "recommended by Google, not required",
          title: "Hreflang set has no x-default fallback",
          detail: noFallback.map((s) => `${s.url} — no x-default`).join("\n"),
          fix: 'Add `hreflang="x-default"` pointing at the page for visitors whose language matches no version (often the language picker or the main version).',
          fixability: "FIXABLE",
          effort: "S",
          urls: noFallback.map((s) => s.url),
          evidenceRefs: noFallback.slice(0, 20).map(tagRef),
        });
      }
      const note = `${checked}/${declared} alternates checked: reciprocal, self-referencing, x-default; IP auto-redirects not testable from one region`;
      const refs = withHreflang.slice(0, 5).map(tagRef);
      if (declared > 0 && checked === 0) {
        out.limited(
          "P3-24",
          `0/${declared} alternates checked: alternates outside the crawl; self-reference and x-default seen`,
          refs,
        );
      } else {
        out.pass("P3-24", note, refs);
      }
    }

    // P3-25
    const variants = pages.snapshots.filter((s) =>
      [...(parseUrl(s.url)?.searchParams.keys() ?? [])].some((k) =>
        VARIANT.test(k),
      ),
    );
    if (variants.length === 0) {
      out.na("P3-25", "no variant URLs crawled");
      return out.build();
    }
    const notOk = variants.filter((s) => s.status !== 200);
    const selfCount = variants.filter(selfCanonical).length;
    const mixed = selfCount > 0 && selfCount < variants.length;
    const refs = () =>
      variants
        .slice(0, 10)
        .map((s) => out.evidence("rawHtml", s.url, describe(s), s.rawKey));
    if (notOk.length > 0 || mixed) {
      out.finding({
        itemIds: ["P3-25"],
        severity: "S3",
        title: "Variant URLs do not follow one URL contract",
        detail: [
          ...notOk.map((s) => `${describe(s)} — not 200`),
          ...(mixed
            ? [
                `${selfCount}/${variants.length} variants self-canonical, the rest point at a parent (mixed)`,
              ]
            : []),
        ].join("\n"),
        fix: "Pick one variant contract — every variant URL self-canonical (indexable variants) or every one canonical to the parent — and serve each with 200.",
        fixability: "FIXABLE",
        effort: "M",
        urls: (notOk.length > 0 ? notOk : variants).map((s) => s.url),
        evidenceRefs: refs(),
      });
    } else {
      out.pass(
        "P3-25",
        `${variants.length} variant URL(s), 200, ${selfCount === variants.length ? "all self-canonical" : "none self-canonical (canonical targets not verified)"}; contract record is owner evidence`,
        refs(),
      );
    }
    return out.build();
  },
};
