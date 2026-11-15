import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { decide } from "@/server/features/handbook/engine/robots";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL/ROBOTS (handbook §11, §18): pagination pages are linked, 200 and
 * self-canonical (P3-21); facet combos are Disallowed or noindex — not both —
 * and indexable facets are self-canonical (P3-22); internal search is
 * Disallowed OR `noindex,follow` — never both (P3-23). Gates (SP8/SP3/SP9)
 * are decided at intake. Disallowed URLs are not crawled, so a Disallowed
 * URL's meta robots is unknown and "both" is only seen when it was fetched.
 */
const ITEMS = ["P3-21", "P3-22", "P3-23"];

const PAGINATION = /[?&]page=\d+|\/page\/\d+/i;
const FACET_PARAM = /^(color|size|sort|filter|brand|price|orderby)$/i;
const SEARCH = /\/search(\/|\.html?|\?|$)|[?&](q|s|query)=/i;

const robotsMeta = (s: PageSnapshot) =>
  `${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`;
const isNoindex = (s: PageSnapshot) => /noindex/i.test(robotsMeta(s));
const selfCanonical = (s: PageSnapshot) =>
  !s.head.canonical || normalizeUrl(s.head.canonical) === normalizeUrl(s.url);

function isFacet(url: string): boolean {
  const keys = [...new URL(url).searchParams.keys()];
  return (
    !SEARCH.test(url) &&
    !PAGINATION.test(url) &&
    (keys.length >= 2 || keys.some((k) => FACET_PARAM.test(k)))
  );
}

export const listNavigationCheck: HandbookCheck = {
  id: "crawl.list-navigation",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages", "robots"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, robots } = ctx.collected;
    if (pages.status !== "ok" || robots.status !== "ok") return out.build();
    const robotsUrl = new URL("/robots.txt", ctx.origin).href;
    const disallowRule = (url: string) => {
      const u = new URL(url);
      const host = robots.hosts.find((h) => h.host === u.host);
      if (!host) return null;
      const d = decide(u.host, host.groups, "*", `${u.pathname}${u.search}`);
      return d.allowed ? null : d.matchedRule;
    };
    const byUrl = new Map(pages.snapshots.map((s) => [normalizeUrl(s.url), s]));
    const site = new URL(ctx.origin).hostname.replace(/^www\./, "");
    const internal = [
      ...new Set(
        pages.snapshots.flatMap((s) =>
          s.links
            .map((l) => normalizeUrl(l.href))
            .filter(
              (href) => new URL(href).hostname.replace(/^www\./, "") === site,
            ),
        ),
      ),
    ];
    const pageRef = (s: PageSnapshot, excerpt: string) =>
      out.evidence("rawHtml", s.url, excerpt, s.rawKey);
    const describe = (s: PageSnapshot) =>
      `${s.url} → ${s.status}; canonical ${s.head.canonical ?? "(none)"}; robots "${robotsMeta(s).trim()}"`;

    // P3-21 — pagination.
    const paged = internal.filter((u) => PAGINATION.test(u));
    const pagedSnaps = paged.flatMap((u) => byUrl.get(u) ?? []);
    if (paged.length === 0) {
      out.na("P3-21", "no pagination URLs found");
    } else {
      const bad = pagedSnaps.filter(
        (s) =>
          s.status !== 200 ||
          normalizeUrl(s.finalUrl) !== normalizeUrl(s.url) ||
          !selfCanonical(s),
      );
      if (bad.length > 0) {
        out.finding({
          itemIds: ["P3-21"],
          severity: "S3",
          title: "Pagination pages are not 200 + self-canonical",
          detail: bad.map(describe).join("\n"),
          fix: "Serve each paginated page with 200 and a self-referencing canonical (never canonical to page 1); link pages with plain <a href>.",
          fixability: "FIXABLE",
          effort: "S",
          urls: bad.map((s) => s.url),
          evidenceRefs: bad.map((s) => pageRef(s, describe(s))),
        });
      } else if (pagedSnaps.length > 0) {
        out.pass(
          "P3-21",
          `${pagedSnaps.length} paginated page(s) 200 + self-canonical, linked by <a href>; out-of-range 404 not probed`,
          pagedSnaps.slice(0, 5).map((s) => pageRef(s, describe(s))),
        );
      } else {
        out.na("P3-21", "pagination links found but none crawled");
      }
    }

    // P3-22 — facets.
    const facets = internal.filter(isFacet);
    if (facets.length === 0) {
      out.na("P3-22", "no facet URLs found");
    } else {
      const issues = facets.flatMap((url) => {
        const rule = disallowRule(url);
        const snap = byUrl.get(url);
        if (rule && snap && isNoindex(snap))
          return [{ url, why: `noindex + ${rule}` }];
        if (!rule && snap && !isNoindex(snap) && !selfCanonical(snap))
          return [
            {
              url,
              why: `crawlable, indexable, canonical → ${snap.head.canonical}`,
            },
          ];
        return [];
      });
      const state = (u: string) => {
        const snap = byUrl.get(u);
        if (!snap) return "not crawled";
        return robotsMeta(snap).trim() || "indexable";
      };
      const excerpt = facets
        .slice(0, 30)
        .map((u) => `${u} — ${disallowRule(u) ?? state(u)}`)
        .join("\n");
      const ref = out.evidence("robotsTxt", robotsUrl, excerpt);
      if (issues.length > 0) {
        out.finding({
          itemIds: ["P3-22"],
          severity: "S3",
          title: "Facet URLs are hidden both ways or indexable duplicates",
          detail: issues.map((i) => `${i.url} — ${i.why}`).join("\n"),
          fix: "Disallow OR noindex low-value facet combos (not both); keep approved indexable facets crawlable and self-canonical.",
          fixability: "FIXABLE",
          effort: "M",
          urls: issues.map((i) => i.url),
          evidenceRefs: [ref],
        });
      } else {
        out.pass(
          "P3-22",
          `${facets.length} facet URL(s) consistent (which facets are approved: owner/LLM)`,
          [ref],
        );
      }
    }

    // P3-23 — internal search.
    const searches = internal.filter((u) => SEARCH.test(u));
    if (searches.length === 0) {
      out.na("P3-23", "no internal search URLs found");
      return out.build();
    }
    const searchIssues = searches.flatMap((url) => {
      const rule = disallowRule(url);
      const snap = byUrl.get(url);
      if (rule) {
        return snap && isNoindex(snap)
          ? [{ url, why: `noindex + ${rule} (never both)`, snap }]
          : [];
      }
      if (!snap) return [];
      if (!isNoindex(snap))
        return [{ url, why: "crawlable and indexable", snap }];
      if (/nofollow|none/i.test(robotsMeta(snap)))
        return [{ url, why: "noindex,nofollow (want noindex,follow)", snap }];
      return [];
    });
    if (searchIssues.length > 0) {
      out.finding({
        itemIds: ["P3-23"],
        severity: "S3",
        title: "Internal search results are not hidden correctly",
        detail: searchIssues.map((i) => `${i.url} — ${i.why}`).join("\n"),
        fix: 'Hide internal search with either `Disallow: /search` or `<meta name=robots content="noindex,follow">` — not both.',
        fixability: "FIXABLE",
        effort: "S",
        urls: searchIssues.map((i) => i.url),
        evidenceRefs: searchIssues.map((i) =>
          pageRef(i.snap, `${describe(i.snap)} — ${i.why}`),
        ),
      });
    } else {
      out.pass(
        "P3-23",
        `${searches.length} search URL(s) Disallowed or noindex,follow`,
        [
          out.evidence(
            "robotsTxt",
            robotsUrl,
            searches
              .map((u) => `${u} — ${disallowRule(u) ?? "crawlable"}`)
              .join("\n"),
          ),
        ],
      );
    }
    return out.build();
  },
};
