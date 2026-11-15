import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL (handbook §10): every indexable page is self-canonical, and the
 * canonical, internal links and sitemap `<loc>` use one URL form; tracking
 * params never appear in a canonical or an internal link (P3-04).
 * Sitemap `<loc>` pages whose canonical points elsewhere are reported by
 * crawl.url-inventory (P3-12) and skipped here. A protocol-relative canonical
 * is resolved by html-facts before this check sees it, so it is not detected.
 */
const ITEMS = ["P3-04"];

const TRACKING = /^(utm_.*|gclid|fbclid|mc_cid|mc_eid|ref)$/i;

const noindex = (s: PageSnapshot) =>
  /noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`);

const indexable = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  !noindex(s) &&
  /html/i.test(s.contentType ?? "html");

const trackingParams = (url: string) =>
  [...new URL(url).searchParams.keys()].filter((k) => TRACKING.test(k));

/** Same page in any trivial form: host without www, path without slash/index.html, any case, no tracking params. */
function formKey(url: string): string {
  const u = new URL(url);
  const path = u.pathname
    .replace(/\/index\.html?$/i, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
  const query = [...u.searchParams]
    .filter(([k]) => !TRACKING.test(k))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${u.hostname.replace(/^www\./, "")}${path}?${query}`;
}

const canonicalTag = (href: string | null) =>
  href ? `<link rel="canonical" href="${href}">` : "no <link rel=canonical>";

export const canonicalFormCheck: HandbookCheck = {
  id: "crawl.canonical-form",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, sitemap } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const locs = new Set(
      sitemap.status === "ok"
        ? sitemap.urls.map((u) => normalizeUrl(u.loc))
        : [],
    );
    const live = pages.snapshots.filter(indexable);
    if (live.length === 0) {
      out.na("P3-04", "no indexable 200 page crawled");
      return out.build();
    }
    const tagRef = (s: PageSnapshot) =>
      out.evidence("rawHtml", s.url, canonicalTag(s.head.canonical), s.rawKey);
    const report = (
      title: string,
      fix: string,
      hits: { page: PageSnapshot; why: string; excerpt?: string }[],
    ) => {
      if (hits.length === 0) return;
      out.finding({
        itemIds: ["P3-04"],
        severity: "S1",
        title,
        detail: hits.map((h) => `${h.page.url} — ${h.why}`).join("\n"),
        fix,
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(hits.map((h) => h.page.url))],
        evidenceRefs: hits
          .slice(0, 10)
          .map((h) =>
            h.excerpt
              ? out.evidence("rawHtml", h.page.url, h.excerpt, h.page.rawKey)
              : tagRef(h.page),
          ),
      });
    };

    report(
      "Indexable pages without a canonical",
      "Emit a self-referencing absolute `<link rel=canonical>` on every indexable page.",
      live
        .filter((s) => !s.head.canonical)
        .map((page) => ({ page, why: "no canonical" })),
    );
    report(
      "Indexable pages are not self-canonical",
      "Point each page's canonical at its own clean URL (or 301 the duplicate to the canonical URL).",
      live
        .filter(
          (s) =>
            s.head.canonical &&
            normalizeUrl(s.head.canonical) !== normalizeUrl(s.finalUrl) &&
            !locs.has(normalizeUrl(s.url)),
        )
        .map((page) => ({
          page,
          why: `canonical → ${page.head.canonical}`,
        })),
    );
    report(
      "Canonical URLs carry tracking parameters",
      "Strip utm_*/gclid/fbclid/mc_cid/ref from canonicals; keep only content-defining parameters.",
      live
        .filter(
          (s) => s.head.canonical && trackingParams(s.head.canonical).length,
        )
        .map((page) => ({
          page,
          why: `canonical has ${trackingParams(page.head.canonical ?? "").join(", ")}`,
        })),
    );

    // Internal links: same form as the target's canonical, no tracking params.
    const canonicalByForm = new Map<string, string>();
    for (const s of live) {
      if (
        s.head.canonical &&
        normalizeUrl(s.head.canonical) === normalizeUrl(s.url)
      )
        canonicalByForm.set(formKey(s.url), normalizeUrl(s.url));
    }
    const siteHost = new URL(ctx.origin).hostname.replace(/^www\./, "");
    const formHits: { page: PageSnapshot; why: string; excerpt: string }[] = [];
    const trackHits: { page: PageSnapshot; why: string; excerpt: string }[] =
      [];
    for (const page of live) {
      const internal = [
        ...new Set(
          page.links
            .map((l) => normalizeUrl(l.href))
            .filter(
              (href) =>
                new URL(href).hostname.replace(/^www\./, "") === siteHost,
            ),
        ),
      ];
      const badForm = internal.flatMap((href) => {
        const canonical = canonicalByForm.get(formKey(href));
        return canonical && canonical !== href
          ? [`${href} → ${canonical}`]
          : [];
      });
      if (badForm.length > 0) {
        formHits.push({
          page,
          why: badForm.slice(0, 10).join("; "),
          excerpt: badForm.join("\n"),
        });
      }
      const tracked = internal.filter((href) => trackingParams(href).length);
      if (tracked.length > 0) {
        trackHits.push({
          page,
          why: tracked.slice(0, 10).join("; "),
          excerpt: tracked.map((h) => `<a href="${h}">`).join("\n"),
        });
      }
    }
    report(
      "Internal links use a non-canonical URL form",
      "Link to the exact canonical form (same host, protocol, trailing slash, no index.html).",
      formHits,
    );
    report(
      "Internal links carry tracking parameters",
      "Remove utm_*/gclid/fbclid/mc_cid/ref from internal links; tag only external campaigns.",
      trackHits,
    );

    out.pass(
      "P3-04",
      `${live.length} indexable pages self-canonical; internal link forms match canonicals`,
      live.slice(0, 5).map(tagRef),
    );
    return out.build();
  },
};
