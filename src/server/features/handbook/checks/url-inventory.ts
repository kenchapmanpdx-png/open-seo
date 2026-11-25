import type {
  CheckContext,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import {
  createResult,
  missingRobotsHosts,
  normalizeUrl,
  sitemapKey,
  originUrl,
  parseUrl,
  pathOf,
  siteUrl,
} from "./support";

/**
 * CRAWL exemplar (handbook §17): URL inventory reconciled — every sitemap
 * `<loc>` is a 200, indexable, self-canonical, internally linked page that is
 * not a test/draft copy, and every indexable crawled page is in the sitemap
 * (P3-12). Cross-consistency: `<loc>` host = canonical host, robots.txt
 * `Sitemap:` lines resolve (P3-19). Thin/duplicate judgment stays with LLM.
 */
const ITEMS = ["P3-12", "P3-19"];

const TEST_PATH = /(^|[-_/])(test|draft|staging|tmp|copy|old)([-_/.]|$)/i;

const noindex = (s: PageSnapshot) =>
  /noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`);

type Issue = { kind: string; url: string; why: string };

const KINDS: Record<
  string,
  { title: string; fix: string; severity?: "S4"; severityReason?: string }
> = {
  status: {
    title: "Sitemap lists URLs that redirect or do not return 200",
    fix: "List only final 200 URLs; update or drop redirected and broken <loc> entries.",
  },
  noindex: {
    title: "Sitemap lists noindex URLs",
    fix: "Drop noindex pages from the sitemap (or make them indexable if they should rank).",
  },
  canonical: {
    title: "Sitemap <loc> canonicalises to another URL",
    fix: "List the canonical URL in the sitemap, or make the page self-canonical if it is the intended URL.",
  },
  orphan: {
    title: "Sitemap URLs without an internal link (orphans)",
    fix: "Link each page from a relevant crawlable page, or retire it (404/410 or redirect) and drop it from the sitemap.",
  },
  weak: {
    title: "Sitemap URLs with only one internal link",
    fix: "Link each page from more relevant pages (its hub or service index, related pages), so it is not one link away from being an orphan.",
    severity: "S4",
    severityReason:
      "one inlink still makes the page reachable; weaker than an orphan (B17 §9 #9)",
  },
  test: {
    title: "Test / draft URLs published in the sitemap",
    fix: "Unpublish test and draft pages (404/410 or noindex) and drop them from the sitemap.",
  },
  unlisted: {
    title: "Indexable pages missing from the sitemap",
    fix: "Add every indexable, self-canonical page to the sitemap (or noindex/retire it).",
  },
};

function inventoryIssues(
  locs: readonly string[],
  snapshots: readonly PageSnapshot[],
): Issue[] {
  const byUrl = new Map(snapshots.map((s) => [normalizeUrl(s.url), s]));
  const inlinks = new Map<string, string[]>();
  for (const s of snapshots) {
    const self = normalizeUrl(s.finalUrl);
    for (const target of new Set(s.links.map((l) => normalizeUrl(l.href)))) {
      if (target !== self)
        inlinks.set(target, [...(inlinks.get(target) ?? []), s.url]);
    }
  }
  const issues: Issue[] = [];
  const locSet = new Set(locs.map(normalizeUrl));
  const locKeys = new Set(locs.map(sitemapKey));
  // WO-B21-003: the 200 page a `<loc>` names on either scheme.
  const pageByKey = new Map(
    snapshots
      .filter((s) => s.status === 200)
      .map((s) => [sitemapKey(s.url), s]),
  );
  for (const loc of locSet) {
    const exact = byUrl.get(loc);
    // A `<loc>` whose only difference from the page is its scheme is P3-19's
    // finding, not a redirect: read the page it names.
    const otherScheme =
      !exact ||
      (sitemapKey(exact.finalUrl) === sitemapKey(loc) &&
        normalizeUrl(exact.finalUrl) !== loc);
    const snap = otherScheme
      ? (pageByKey.get(sitemapKey(loc)) ?? exact)
      : exact;
    if (!snap) continue; // not crawled within the page budget
    const page = normalizeUrl(snap.url);
    if (TEST_PATH.test(pathOf(loc)))
      issues.push({ kind: "test", url: loc, why: "test/draft path" });
    if (otherScheme && snap.status !== 200) continue;
    if (snap.status !== 200 || normalizeUrl(snap.finalUrl) !== page) {
      issues.push({
        kind: "status",
        url: loc,
        why: `HTTP ${snap.status} → ${snap.finalUrl}`,
      });
      continue;
    }
    if (noindex(snap)) {
      issues.push({ kind: "noindex", url: loc, why: "noindex" });
      continue;
    }
    if (snap.head.canonical && normalizeUrl(snap.head.canonical) !== page) {
      issues.push({
        kind: "canonical",
        url: loc,
        why: `canonical → ${snap.head.canonical}`,
      });
      continue;
    }
    const from = inlinks.get(page) ?? [];
    if (pathOf(loc) === "/") continue;
    if (from.length === 0)
      issues.push({ kind: "orphan", url: loc, why: "0 internal inlinks" });
    if (from.length === 1)
      issues.push({
        kind: "weak",
        url: loc,
        why: `1 internal inlink, from ${from[0]}`,
      });
  }
  for (const s of snapshots) {
    const url = normalizeUrl(s.url);
    const selfCanonical =
      !s.head.canonical || normalizeUrl(s.head.canonical) === url;
    if (
      s.status === 200 &&
      normalizeUrl(s.finalUrl) === url &&
      !noindex(s) &&
      selfCanonical &&
      !locKeys.has(sitemapKey(url)) &&
      /html/i.test(s.contentType ?? "html")
    ) {
      issues.push({ kind: "unlisted", url, why: "indexable, not in sitemap" });
    }
  }
  return issues;
}

/** P3-19 robots.txt `Sitemap:` lines: declared and returning 200 (runs with or without a sitemap). */
function robotsSitemapLine(
  out: ReturnType<typeof createResult>,
  ctx: CheckContext,
) {
  const { robots, sitemap } = ctx.collected;
  if (robots.status !== "ok" || sitemap.status !== "ok") return;
  // WO-B20-011: no robots.txt at all (4xx) is the P3-15 "No robots.txt"
  // finding, not "no Sitemap: line".
  if (missingRobotsHosts(robots.hosts).length > 0) return;
  const declared = robots.hosts.flatMap((h) => h.sitemaps);
  const robotsUrl = siteUrl(ctx.origin, "/robots.txt");
  const broken = declared.filter(
    (url) => sitemap.sources.find((s) => s.url === url)?.status !== 200,
  );
  if (declared.length > 0 && broken.length === 0) return;
  const host = robots.hosts.find((h) => h.status === 200);
  const ref = out.evidence(
    "robotsTxt",
    robotsUrl,
    declared.length === 0
      ? "no Sitemap: line"
      : `Sitemap: lines not returning 200:\n${broken.join("\n")}`,
    host?.storageKey,
  );
  out.finding({
    itemIds: ["P3-19"],
    severity: "S3",
    title:
      declared.length === 0
        ? "robots.txt has no Sitemap: line"
        : "robots.txt Sitemap: line does not resolve",
    detail:
      declared.length === 0
        ? "robots.txt declares no sitemap"
        : broken.join("\n"),
    fix: "Point a `Sitemap:` line in robots.txt at the live sitemap (index) URL.",
    fixability: "FIXABLE",
    effort: "S",
    urls: [robotsUrl],
    evidenceRefs: [ref],
  });
}

/**
 * No sitemap (WO-B19-013): one P3-12 finding with the fetched sitemap
 * statuses, and the one-inlink rule on the crawl link graph instead of the
 * `<loc>` list (orphans cannot be found without a sitemap).
 */
function noSitemap(
  out: ReturnType<typeof createResult>,
  ctx: CheckContext,
  snapshots: readonly PageSnapshot[],
) {
  const { sitemap } = ctx.collected;
  if (sitemap.status !== "ok") return;
  const sitemapUrl = siteUrl(ctx.origin, "/sitemap.xml");
  const tried = sitemap.sources.map(
    (s) =>
      `${s.url} — HTTP ${s.status}${s.kind === "invalid" ? " (no <urlset>)" : ""}`,
  );
  const lines = tried.length > 0 ? tried : [`${sitemapUrl} — not fetched`];
  out.finding({
    itemIds: ["P3-12"],
    severity: "S3",
    title: "No XML sitemap",
    detail: lines.join("\n"),
    fix: "Publish an XML sitemap listing every indexable, self-canonical page (most CMSs have a setting or plugin) and name it in robots.txt with a `Sitemap:` line.",
    fixability: "FIXABLE",
    effort: "S",
    urls: [sitemap.sources[0]?.url ?? sitemapUrl],
    evidenceRefs: [
      out.evidence(
        "sitemap",
        sitemap.sources[0]?.url ?? sitemapUrl,
        lines.join("\n"),
        sitemap.sources[0]?.storageKey,
      ),
    ],
  });
  oneInlinkPages(out, snapshots, new Set());
}

/**
 * P3-12 one-inlink rule on indexable crawled pages outside `skip` (the
 * sitemap URLs, which have their own row). WO-B20-014 (c): with a sitemap
 * it still covers pages the sitemap leaves out (theogdenver.com /event/*).
 */
function oneInlinkPages(
  out: ReturnType<typeof createResult>,
  snapshots: readonly PageSnapshot[],
  skip: ReadonlySet<string>,
) {
  const indexable = snapshots
    .filter(
      (s) =>
        s.status === 200 &&
        normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
        !noindex(s) &&
        (!s.head.canonical ||
          normalizeUrl(s.head.canonical) === normalizeUrl(s.url)) &&
        /html/i.test(s.contentType ?? "html") &&
        !skip.has(sitemapKey(s.url)),
    )
    .map((s) => s.url);
  const weak = inventoryIssues(indexable, snapshots).filter(
    (i) => i.kind === "weak",
  );
  if (weak.length === 0) return;
  const detail = weak.map((h) => `${h.url} — ${h.why}`).join("\n");
  out.finding({
    itemIds: ["P3-12"],
    severity: "S4",
    severityReason: KINDS.weak.severityReason,
    title: "Pages with only one internal link",
    detail,
    fix: KINDS.weak.fix,
    fixability: "FIXABLE",
    effort: "S",
    urls: weak.map((h) => h.url),
    evidenceRefs: weak
      .slice(0, 20)
      .map((h) => out.evidence("rawHtml", h.url, h.why)),
  });
}

export const urlInventoryCheck: HandbookCheck = {
  id: "crawl.url-inventory",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["sitemap", "pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { sitemap, pages } = ctx.collected;
    if (sitemap.status !== "ok" || pages.status !== "ok") return out.build();
    const source = sitemap.sources.find((s) => s.kind === "urlset");
    if (sitemap.urls.length === 0 || !source) {
      noSitemap(out, ctx, pages.snapshots);
      robotsSitemapLine(out, ctx);
      return out.build();
    }
    const listing = (urls: readonly string[]) =>
      out.evidence("sitemap", source.url, urls.join("\n"), source.storageKey);

    const issues = inventoryIssues(
      sitemap.urls.map((u) => u.loc),
      pages.snapshots,
    );
    for (const [kind, meta] of Object.entries(KINDS)) {
      const hits = issues.filter((i) => i.kind === kind);
      if (hits.length === 0) continue;
      out.finding({
        itemIds: ["P3-12"],
        severity: meta.severity ?? "S3",
        ...(meta.severityReason ? { severityReason: meta.severityReason } : {}),
        title: meta.title,
        detail: hits.map((h) => `${h.url} — ${h.why}`).join("\n"),
        fix: meta.fix,
        fixability: "FIXABLE",
        effort: "S",
        urls: hits.map((h) => h.url),
        evidenceRefs: [listing(hits.map((h) => `${h.url} — ${h.why}`))],
      });
    }

    oneInlinkPages(
      out,
      pages.snapshots,
      new Set(sitemap.urls.map((u) => sitemapKey(u.loc))),
    );

    // P3-19 — scheme + host consistency + robots Sitemap: lines.
    const home = pages.snapshots.find(
      (s) => pathOf(s.url) === "/" && s.status === 200,
    );
    const canonical =
      parseUrl(home?.head.canonical ?? "") ?? originUrl(ctx.origin);
    const canonicalHost = canonical.host;
    const canonicalScheme = canonical.protocol;
    const offHost = sitemap.urls.filter((u) => {
      const host = parseUrl(u.loc, ctx.origin)?.host;
      return host !== undefined && host !== canonicalHost;
    });
    if (offHost.length > 0) {
      out.finding({
        itemIds: ["P3-19"],
        severity: "S3",
        title: "Sitemap <loc> host differs from the canonical host",
        detail: `canonical host ${canonicalHost}; ${offHost.length} <loc> on another host, e.g. ${offHost[0]?.loc}`,
        fix: "Emit every <loc> on the canonical host.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [source.url],
        evidenceRefs: [listing(offHost.slice(0, 50).map((u) => u.loc))],
      });
    }
    // WO-B21-003: one finding for `<loc>` on the other scheme (P3-12 and
    // P3-13 match them to their pages with `sitemapKey`).
    const offScheme = sitemap.urls.filter((u) => {
      const scheme = parseUrl(u.loc, ctx.origin)?.protocol;
      return scheme !== undefined && scheme !== canonicalScheme;
    });
    if (offScheme.length > 0) {
      out.finding({
        itemIds: ["P3-19"],
        severity: "S3",
        title: "Sitemap <loc> scheme differs from the canonical scheme",
        detail: `canonical scheme ${canonicalScheme}//; ${offScheme.length} <loc> on another scheme:\n${offScheme
          .slice(0, 50)
          .map((u) => u.loc)
          .join("\n")}`,
        fix: `Emit every <loc> with the canonical scheme (${canonicalScheme}//${canonicalHost}/…).`,
        fixability: "FIXABLE",
        effort: "S",
        urls: [source.url],
        evidenceRefs: [listing(offScheme.slice(0, 50).map((u) => u.loc))],
      });
    }
    robotsSitemapLine(out, ctx);

    const ref = listing(sitemap.urls.slice(0, 50).map((u) => u.loc));
    out.pass(
      "P3-12",
      `${sitemap.urls.length} <loc> reconciled with ${pages.snapshots.length} crawled pages (thin/duplicate judgment manual)`,
      [ref],
    );
    out.pass(
      "P3-19",
      `<loc> scheme + host = canonical ${canonicalScheme}//${canonicalHost}`,
      [ref],
    );
    return out.build();
  },
};
