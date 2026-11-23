import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL (handbook §17, §12, §9, §8): crawl coverage counts (P3-13), every
 * detail page linked from an index page of another template (P2-10), slug
 * hygiene (P2-12, deterministic part), and global navigation linking each
 * content hub (P2-11, deterministic part).
 */
const ITEMS = ["P3-13", "P2-10", "P2-12", "P2-11"];

const SESSION = /(;jsessionid=|[?&](sid|sessionid|phpsessid)=)/i;

const live = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  /html/i.test(s.contentType ?? "html");

function slugProblems(url: string): string[] {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  const out: string[] = [];
  if (parts.some((p) => /[A-Z]/.test(p))) out.push("uppercase");
  if (parts.some((p) => p.includes("_"))) out.push("underscore");
  if (/%20|\s|\+/.test(u.pathname)) out.push("space");
  const last = parts.at(-1) ?? "";
  const ext = /\.([a-z0-9]+)$/i.exec(last)?.[1]?.toLowerCase();
  if (ext && ext !== "html" && ext !== "htm") out.push(`.${ext} extension`);
  if (SESSION.test(`${u.pathname}${u.search}`)) out.push("session id");
  return out;
}

/**
 * Page URL style: `.html`/`.htm`/`.php`… extension or extensionless.
 * Directory URLs (trailing slash, home) have no style: `/events/` beside
 * `/events/a.html` is the usual hub + detail layout.
 */
function urlStyle(url: string): string | null {
  const path = new URL(url).pathname;
  if (path.endsWith("/")) return null;
  const last = path.split("/").at(-1);
  if (!last) return null;
  const ext = /\.([a-z0-9]+)$/i.exec(last)?.[1]?.toLowerCase();
  return ext ? `.${ext}` : "extensionless";
}

/** `/events/*` → `/events/` (only patterns whose last segment is dynamic). */
function hubPath(pattern: string): string | null {
  const parts = pattern.split("/").filter(Boolean);
  if (parts.length < 2 || parts.at(-1) !== "*") return null;
  if (parts.slice(0, -1).includes("*")) return null;
  return `/${parts.slice(0, -1).join("/")}/`;
}

export const crawlCoverageCheck: HandbookCheck = {
  id: "crawl.coverage",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages", "templates"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, templates, sitemap } = ctx.collected;
    if (pages.status !== "ok" || templates.status !== "ok") return out.build();
    const crawled = pages.snapshots.filter(live);
    const crawledSet = new Set(crawled.map((s) => normalizeUrl(s.url)));
    const pageRef = (s: PageSnapshot, excerpt: string) =>
      out.evidence("url", s.url, excerpt);

    // P3-13 — coverage counts.
    if (sitemap.status === "ok" && sitemap.urls.length > 0) {
      const locs = new Set(sitemap.urls.map((u) => normalizeUrl(u.loc)));
      const both = [...locs].filter((l) => crawledSet.has(l));
      const sitemapOnly = [...locs].filter((l) => !crawledSet.has(l));
      const crawledOnly = [...crawledSet].filter((c) => !locs.has(c));
      const jsOnly = pages.snapshots
        .filter((s) => s.discoveredBy === "render")
        .map((s) => s.url);
      const note = `sitemap ${locs.size} · crawled ${crawledSet.size} · both ${both.length} · sitemap-only ${sitemapOnly.length} · crawled-only ${crawledOnly.length} · JS-only links: ${jsOnly.length}`;
      out.pass("P3-13", note, [
        out.evidence(
          "sitemap",
          sitemap.sources[0]?.url ?? ctx.origin,
          `${note}\nsitemap-only:\n${sitemapOnly.slice(0, 30).join("\n")}\ncrawled-only:\n${crawledOnly.slice(0, 30).join("\n")}\nJS-only (render-discovered):\n${jsOnly.slice(0, 20).join("\n")}`,
          sitemap.sources[0]?.storageKey,
        ),
      ]);
    } else {
      out.na("P3-13", 'no sitemap (see finding "No XML sitemap")');
    }

    // Inlinks per target, keyed by source URL pattern.
    const patternOf = new Map<string, string>();
    for (const t of templates.templates)
      for (const url of t.urls) patternOf.set(normalizeUrl(url), t.urlPattern);
    const byPattern = new Map<string, string[]>();
    for (const [url, pattern] of patternOf) {
      byPattern.set(pattern, [...(byPattern.get(pattern) ?? []), url]);
    }
    const inlinkPatterns = new Map<string, Set<string>>();
    for (const s of crawled) {
      const from = patternOf.get(normalizeUrl(s.url)) ?? "?";
      for (const link of s.links) {
        // A link with a query (Shopify `?variant=`) still reaches its path's page.
        const bare = new URL(link.href);
        bare.search = "";
        for (const target of new Set([
          normalizeUrl(link.href),
          normalizeUrl(bare.href),
        ])) {
          const set = inlinkPatterns.get(target) ?? new Set<string>();
          set.add(from);
          inlinkPatterns.set(target, set);
        }
      }
    }

    // P2-10 — detail pages need an inlink from another template.
    const detailGroups = [...byPattern].filter(
      ([pattern, urls]) => hubPath(pattern) && urls.length >= 2,
    );
    if (detailGroups.length === 0) {
      out.na("P2-10", "no detail-page template (/x/* with ≥2 URLs)");
    } else {
      const unlinked = detailGroups.flatMap(([pattern, urls]) =>
        urls.filter(
          (url) =>
            ![...(inlinkPatterns.get(url) ?? [])].some((p) => p !== pattern),
        ),
      );
      const listing = detailGroups
        .map(([pattern, urls]) => `${pattern}: ${urls.length} URLs`)
        .join("\n");
      if (unlinked.length > 0) {
        out.finding({
          itemIds: ["P2-10"],
          severity: "S3",
          title: "Detail pages not linked from any index page",
          detail: unlinked.join("\n"),
          fix: "Link every detail page from a crawlable HTML index/listing page (not only from the sitemap or JS widgets).",
          fixability: "FIXABLE",
          effort: "S",
          urls: unlinked,
          evidenceRefs: [
            out.evidence(
              "linkGraph",
              ctx.origin,
              `${listing}\n0 inlinks from another template:\n${unlinked.join("\n")}`,
            ),
          ],
        });
      } else {
        out.pass("P2-10", listing, [
          out.evidence("linkGraph", ctx.origin, listing),
        ]);
      }
    }

    // P2-12 — slug hygiene (readability judgment is LLM, B3).
    const badSlugs = crawled.flatMap((s) => {
      const why = slugProblems(s.url);
      return why.length > 0 ? [{ s, why }] : [];
    });
    const byStyle = new Map<string, string[]>();
    for (const s of crawled) {
      const style = urlStyle(s.url);
      if (style) byStyle.set(style, [...(byStyle.get(style) ?? []), s.url]);
    }
    const styleSummary = [...byStyle]
      .map(([style, urls]) => `${style}: ${urls.length} (e.g. ${urls[0]})`)
      .join("\n");
    if (byStyle.size >= 2) {
      out.finding({
        itemIds: ["P2-12"],
        severity: "S4",
        title: "Page URLs mix extension styles on one host",
        detail: styleSummary,
        fix: "Pick one URL style (extensionless is the default) and 301 the other style to it; update internal links and the sitemap.",
        fixability: "FIXABLE",
        effort: "M",
        urls: [...byStyle.values()].flatMap((urls) => urls.slice(0, 10)),
        evidenceRefs: [out.evidence("url", ctx.origin, styleSummary)],
      });
    }
    if (badSlugs.length > 0) {
      out.finding({
        itemIds: ["P2-12"],
        severity: "S4",
        title: "URL slugs break the slug rules",
        detail: badSlugs
          .map(({ s, why }) => `${s.url} — ${why.join(", ")}`)
          .join("\n"),
        fix: "Use lowercase, hyphen-separated slugs without underscores, spaces, session ids or non-HTML extensions; 301 the old URLs.",
        fixability: "FIXABLE",
        effort: "M",
        urls: badSlugs.map(({ s }) => s.url),
        evidenceRefs: badSlugs
          .slice(0, 20)
          .map(({ s, why }) => pageRef(s, `${s.url} — ${why.join(", ")}`)),
      });
    } else if (crawled.length > 0 && byStyle.size < 2) {
      out.pass(
        "P2-12",
        `${crawled.length} URLs lowercase/hyphenated (readability judgment pending, LLM B3)`,
        [
          out.evidence(
            "url",
            ctx.origin,
            crawled
              .slice(0, 50)
              .map((s) => s.url)
              .join("\n"),
          ),
        ],
      );
    }

    // P2-11 — global nav (links on ≥80% of pages) reaches each hub.
    if (crawled.length < 3) {
      out.na("P2-11", "fewer than 3 crawled pages; no global nav to infer");
      return out.build();
    }
    const linkCount = new Map<string, number>();
    for (const s of crawled) {
      for (const href of new Set(s.links.map((l) => normalizeUrl(l.href))))
        linkCount.set(href, (linkCount.get(href) ?? 0) + 1);
    }
    const nav = [...linkCount]
      .filter(([, n]) => n >= crawled.length * 0.8)
      .map(([href]) => href);
    const hubs = [...byPattern]
      .filter(([pattern, urls]) => hubPath(pattern) && urls.length >= 3)
      .map(([pattern]) => new URL(hubPath(pattern) ?? "/", ctx.origin).href)
      .filter((hub) => crawledSet.has(hub));
    const missing = hubs.filter((hub) => !nav.includes(hub));
    const navRef = () =>
      out.evidence(
        "linkGraph",
        ctx.origin,
        `global nav (≥80% of ${crawled.length} pages):\n${nav.join("\n")}\nhubs:\n${hubs.join("\n")}`,
      );
    if (missing.length > 0) {
      out.finding({
        itemIds: ["P2-11"],
        severity: "S3",
        title: "Header navigation misses content hubs",
        detail: missing.join("\n"),
        fix: "Link every core content hub (listing/index page) from the site-wide header navigation.",
        fixability: "FIXABLE",
        effort: "S",
        urls: missing,
        evidenceRefs: [navRef()],
      });
    } else if (hubs.length > 0) {
      out.pass(
        "P2-11",
        `${hubs.length} hub(s) in global nav (which hubs are "core" pending, LLM B3)`,
        [navRef()],
      );
    } else {
      out.na("P2-11", "no hub template with ≥3 detail URLs");
    }
    return out.build();
  },
};
