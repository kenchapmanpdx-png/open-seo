import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { estimateJaccard } from "../engine/minhash";
import { bareHost, createResult, normalizeUrl, parseUrl } from "./support";

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
  [...(parseUrl(url)?.searchParams.keys() ?? [])].filter((k) =>
    TRACKING.test(k),
  );

const text = (list: { href: string; canonical: string }[]) =>
  list.map(({ href, canonical }) => `${href} → ${canonical}`);

/** Same page in any trivial form: host without www, path without slash/index.html, any case, no tracking params. */
function formKey(url: string): string {
  const u = parseUrl(url);
  if (!u) return url;
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

/** Same path once percent-encoding and `+` / `%20` are equated (`/tag/a%20b` = `/tag/a+b`). */
const decodedKey = (url: string) => {
  const u = parseUrl(url);
  if (!u) return url;
  const raw = `${u.host}${u.pathname}${u.search}`.replaceAll("+", "%20");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

/**
 * WO-B19-005: a page canonical to another URL is a correctly canonicalised
 * duplicate when the target is crawled, 200, self-canonical and carries the
 * same main text (MinHash ≥ 0.9, or equal text), or when the two URLs only
 * differ in encoding. Decided by content, never by parameter name: page 2
 * canonical to page 1 (§10) has different text and stays a finding.
 */
function canonicalisedDuplicate(
  page: PageSnapshot,
  byUrl: ReadonlyMap<string, PageSnapshot>,
): boolean {
  const target = page.head.canonical;
  if (!target) return false;
  if (decodedKey(target) === decodedKey(page.url)) return true;
  const t = byUrl.get(normalizeUrl(target));
  if (!t || !indexable(t)) return false;
  if (
    !t.head.canonical ||
    normalizeUrl(t.head.canonical) !== normalizeUrl(t.url)
  )
    return false;
  if (page.minhash && t.minhash)
    return estimateJaccard(page.minhash, t.minhash) >= 0.9;
  return page.markup.text.trim() === t.markup.text.trim();
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
    const byUrl = new Map(pages.snapshots.map((s) => [normalizeUrl(s.url), s]));
    // Canonicalised duplicates: no canonical finding; links to them are a link-form finding.
    const duplicateOf = new Map(
      live
        .filter(
          (s) =>
            s.head.canonical &&
            normalizeUrl(s.head.canonical) !== normalizeUrl(s.finalUrl) &&
            canonicalisedDuplicate(s, byUrl),
        )
        .map((s) => [
          normalizeUrl(s.url),
          normalizeUrl(s.head.canonical ?? ""),
        ]),
    );
    const tagRef = (s: PageSnapshot) =>
      out.evidence("rawHtml", s.url, canonicalTag(s.head.canonical), s.rawKey);
    const report = (
      title: string,
      fix: string,
      hits: { page: PageSnapshot; why: string; excerpt?: string }[],
      effect: { severity: "S1" | "S3"; severityReason?: string } = {
        severity: "S1",
      },
    ) => {
      if (hits.length === 0) return;
      out.finding({
        itemIds: ["P3-04"],
        ...effect,
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
            !locs.has(normalizeUrl(s.url)) &&
            !duplicateOf.has(normalizeUrl(s.url)),
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
    const siteHost = bareHost(ctx.origin);
    const formHits: { page: PageSnapshot; why: string; excerpt: string }[] = [];
    const dupHits: typeof formHits = [];
    const hopHits: typeof formHits = [];
    // WO-B20-009 (ADR-034): the crawl's own fetch of the linked form shows
    // what a crawler gets. One 301 / 308 straight to the canonical (200) is
    // consistency, S3; a live 200 duplicate, a 302 / 307, a chain, an error
    // or another landing URL stays S1. No crawl record keeps S1.
    const onePermanentHop = (href: string, canonical: string) => {
      const t = byUrl.get(href);
      const chain = t?.redirectChain ?? [];
      return (
        t?.status === 200 &&
        chain.length === 1 &&
        (chain[0]?.status === 301 || chain[0]?.status === 308) &&
        normalizeUrl(t.finalUrl) === canonical
      );
    };
    const trackHits: { page: PageSnapshot; why: string; excerpt: string }[] =
      [];
    for (const page of live) {
      const internal = [
        ...new Set(
          page.links
            .map((l) => normalizeUrl(l.href))
            .filter((href) => bareHost(href) === siteHost),
        ),
      ];
      const self = normalizeUrl(page.url);
      const pairs = (target: (href: string) => string | undefined) =>
        internal.flatMap((href) => {
          const canonical = href === self ? undefined : target(href);
          return canonical && canonical !== href ? [{ href, canonical }] : [];
        });
      const hits = (target: (href: string) => string | undefined) =>
        text(pairs(target));
      const push = (list: typeof formHits, found: string[]) => {
        if (found.length > 0)
          list.push({
            page,
            why: found.slice(0, 10).join("; "),
            excerpt: found.join("\n"),
          });
      };
      push(
        dupHits,
        hits((href) => duplicateOf.get(href)),
      );
      const forms = pairs((href) =>
        duplicateOf.has(href) ? undefined : canonicalByForm.get(formKey(href)),
      );
      push(
        formHits,
        text(forms.filter((p) => !onePermanentHop(p.href, p.canonical))),
      );
      push(
        hopHits,
        text(forms.filter((p) => onePermanentHop(p.href, p.canonical))),
      );
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
      "Internal links use a non-canonical URL form (one permanent redirect)",
      "Link to the exact canonical form so crawlers and visitors skip the redirect.",
      hopHits,
      {
        severity: "S3",
        severityReason:
          "each link reaches the canonical in one permanent redirect",
      },
    );
    report(
      "Internal links point at a canonicalised duplicate",
      "Link to the canonical URL itself (the duplicate's canonical already consolidates it, so this is consistency, not an indexing error).",
      dupHits,
      {
        severity: "S3",
        severityReason:
          "the duplicate is correctly canonicalised; the link form is consistency, not an indexing error",
      },
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
