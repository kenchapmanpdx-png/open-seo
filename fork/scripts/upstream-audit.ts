/**
 * Headless upstream audit of a public origin (B1 WP02).
 *
 * Runs upstream OpenSEO's own crawl + issue detection (the functions the
 * production Worker uses) against a public site and writes a markdown table:
 * issue type · severity · count · URLs. No Lighthouse, no rendering, no DB.
 * Modeled on tests/badseo/scripts/run-audit.ts; only the frontier loop is
 * local. Start URL goes through upstream's SSRF validation + redirect
 * resolution; discovered URLs must stay same-origin and pass robots.txt.
 *
 *   pnpm exec tsx fork/scripts/upstream-audit.ts https://example.com [out.md]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { crawlPage } from "@/server/workflows/site-audit-workflow-helpers";
import { createCrawlThrottle } from "@/server/lib/audit/crawl-throttle";
import { discoverUrls, parseRobotsTxt } from "@/server/lib/audit/discovery";
import {
  isCrawlableUrl,
  normalizeAndValidateStartUrl,
  resolveStartUrlRedirects,
} from "@/server/lib/audit/url-policy";
import { normalizeUrl, isSameOrigin } from "@/server/lib/audit/url-utils";
import {
  runPageReporters,
  type DetectedIssue,
} from "@/server/lib/audit/issues/page-reporters";
import {
  findDuplicates,
  findRedirectChainsAndLoops,
  type SlimPage,
} from "@/server/lib/audit/issues/multipage-checks";
import type { CrawledPageResult } from "@/server/lib/audit/types";
import { AUDIT_ISSUE_TYPES } from "@/shared/audit-issues";

const MAX_PAGES = 200;
const CONCURRENCY = 4;
const CRAWL_BUDGET_MS = 10 * 60_000;

interface CrawlLink {
  sourceId: string;
  sourceUrl: string;
  targetUrl: string;
}

interface CrawlEntry {
  url: string;
  depth: number | null;
}

async function crawl(origin: string, startUrl: string) {
  const { urls: sitemapUrls, robotsText } = await discoverUrls(
    origin,
    MAX_PAGES,
  );
  const robots = parseRobotsTxt(origin, robotsText);
  const sitemapSet = new Set(
    sitemapUrls.map((u) => normalizeUrl(u)).filter((u): u is string => !!u),
  );

  const visited = new Set<string>();
  const queued = new Set<string>([startUrl]);
  const linkQueue: CrawlEntry[] = [{ url: startUrl, depth: 0 }];
  const sitemapQueue: CrawlEntry[] = [];
  for (const u of sitemapSet) {
    if (queued.has(u) || !isSameOrigin(u, origin) || !robots.isAllowed(u))
      continue;
    sitemapQueue.push({ url: u, depth: null });
    queued.add(u);
  }

  const pages: CrawledPageResult[] = [];
  const links: CrawlLink[] = [];
  const throttle = createCrawlThrottle(Date.now() + CRAWL_BUDGET_MS);

  const enqueue = (url: string, depth: number | null) => {
    const n = normalizeUrl(url);
    if (!n || !isCrawlableUrl(n) || !isSameOrigin(n, origin)) return;
    if (visited.has(n) || queued.has(n) || !robots.isAllowed(n)) return;
    linkQueue.push({ url: n, depth });
    queued.add(n);
  };

  while (
    (linkQueue.length > 0 || sitemapQueue.length > 0) &&
    pages.length < MAX_PAGES &&
    !throttle.stopped
  ) {
    const batch: CrawlEntry[] = [];
    while (
      (linkQueue.length > 0 || sitemapQueue.length > 0) &&
      batch.length < CONCURRENCY &&
      pages.length + batch.length < MAX_PAGES
    ) {
      const entry = (linkQueue.length > 0 ? linkQueue : sitemapQueue).shift()!;
      queued.delete(entry.url);
      if (visited.has(entry.url)) continue;
      visited.add(entry.url);
      batch.push(entry);
    }

    const crawled = await Promise.all(
      batch.map((e) =>
        crawlPage(e.url, e.depth, sitemapSet.has(e.url), throttle),
      ),
    );
    crawled.forEach((page, i) => {
      if (!page) return;
      const depth = batch[i].depth;
      pages.push(page);
      for (const link of page.links) {
        if (!link.isInternal) continue;
        links.push({
          sourceId: page.id,
          sourceUrl: page.url,
          targetUrl: link.targetUrl,
        });
        enqueue(link.targetUrl, depth === null ? null : depth + 1);
      }
      if (page.redirectUrl) enqueue(page.redirectUrl, depth);
    });
  }

  const completed =
    !throttle.stopped && linkQueue.length === 0 && sitemapQueue.length === 0;
  return { pages, links, completed, robotsText, sitemapCount: sitemapSet.size };
}

/** In-memory equivalents of the two DB-backed multipage checks. */
function findBrokenInternalLinks(
  pages: CrawledPageResult[],
  links: CrawlLink[],
): DetectedIssue[] {
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const seen = new Set<string>();
  const issues: DetectedIssue[] = [];
  for (const link of links) {
    const target = byUrl.get(link.targetUrl);
    if (!target || target.fetchClass !== "ok" || target.statusCode < 400)
      continue;
    const key = `${link.sourceUrl}::${link.targetUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({
      issueType: "broken-internal-link",
      pageId: link.sourceId,
      pageUrl: link.sourceUrl,
      dedupeKey: link.targetUrl,
      details: { targetUrl: link.targetUrl, targetStatus: target.statusCode },
    });
  }
  return issues;
}

function findOrphanPages(
  pages: CrawledPageResult[],
  links: CrawlLink[],
  startUrl: string,
): DetectedIssue[] {
  const sourceUrlById = new Map(pages.map((p) => [p.id, p.url]));
  const hasInlink = new Set<string>();
  for (const link of links) {
    if (sourceUrlById.get(link.sourceId) === link.targetUrl) continue;
    hasInlink.add(link.targetUrl);
  }
  const redirectTargets = new Set(
    pages.map((p) => p.redirectUrl).filter((u): u is string => !!u),
  );
  return pages
    .filter(
      (p) =>
        p.fetchClass === "ok" &&
        p.statusCode >= 200 &&
        p.statusCode < 300 &&
        p.url !== startUrl &&
        !hasInlink.has(p.url) &&
        !redirectTargets.has(p.url),
    )
    .map((p) => ({ issueType: "orphan-page", pageId: p.id, pageUrl: p.url }));
}

function toSlim(page: CrawledPageResult): SlimPage {
  return {
    id: page.id,
    url: page.url,
    statusCode: page.statusCode,
    fetchClass: page.fetchClass,
    title: page.title || null,
    metaDescription: page.metaDescription || null,
    contentHash: page.contentHash,
    redirectUrl: page.redirectUrl,
    wordCount: page.wordCount,
    isIndexable: page.isIndexable,
    canonicalUrl: page.canonicalUrl,
    headerCanonicalUrl: page.headerCanonicalUrl,
  };
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error(
      "usage: pnpm exec tsx fork/scripts/upstream-audit.ts <origin> [out.md]",
    );
    process.exit(2);
  }
  const validated = await normalizeAndValidateStartUrl(input);
  const { url: resolved } = await resolveStartUrlRedirects(validated);
  const origin = new URL(resolved).origin;
  const startUrl = normalizeUrl(resolved) ?? resolved;
  const host = new URL(origin).hostname.replace(/^www\./, "");
  const out = process.argv[3] ?? `fork/fixtures/upstream-audit/${host}.md`;

  const started = Date.now();
  const { pages, links, completed, robotsText, sitemapCount } = await crawl(
    origin,
    startUrl,
  );

  const detected: DetectedIssue[] = [];
  for (const page of pages) detected.push(...runPageReporters(page));
  const slim = pages.map(toSlim);
  detected.push(...findDuplicates(slim));
  detected.push(...findRedirectChainsAndLoops(slim));
  detected.push(...findBrokenInternalLinks(pages, links));
  if (completed) detected.push(...findOrphanPages(pages, links, startUrl));

  const byType = new Map<string, Set<string>>();
  for (const issue of detected) {
    const set = byType.get(issue.issueType) ?? new Set<string>();
    set.add(issue.pageUrl);
    byType.set(issue.issueType, set);
  }
  const counts = new Map<string, number>();
  for (const issue of detected)
    counts.set(issue.issueType, (counts.get(issue.issueType) ?? 0) + 1);

  type IssueKey = keyof typeof AUDIT_ISSUE_TYPES;
  const rows = [...byType.entries()]
    .map(([type, urls]) => ({
      type,
      meta: AUDIT_ISSUE_TYPES[type as IssueKey],
      count: counts.get(type) ?? 0,
      urls: [...urls].sort(),
    }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.meta.severity] - SEVERITY_ORDER[b.meta.severity] ||
        b.count - a.count,
    );

  const statusCounts = new Map<string, number>();
  for (const p of pages) {
    const k = `${p.fetchClass}:${p.statusCode}`;
    statusCounts.set(k, (statusCounts.get(k) ?? 0) + 1);
  }

  const lines: string[] = [
    `# Upstream audit — ${origin}`,
    "",
    `Generated by \`fork/scripts/upstream-audit.ts\` (upstream detection only: page reporters, duplicates, redirect chains/loops, broken internal links, orphan pages; no Lighthouse, no JS rendering).`,
    "",
    `- Date: ${new Date().toISOString().slice(0, 10)}`,
    `- Start URL: ${startUrl}`,
    `- Pages crawled: ${pages.length} (limit ${MAX_PAGES}); crawl ${completed ? "completed" : "TRUNCATED"}; ${Math.round((Date.now() - started) / 1000)}s`,
    `- Sitemap URLs discovered: ${sitemapCount}; robots.txt ${robotsText ? "present" : "absent"}`,
    `- Internal links: ${links.length}; issues: ${detected.length}`,
    `- Fetch results: ${[...statusCounts.entries()].map(([k, v]) => `${k} ×${v}`).join(", ")}`,
    "",
    "| Issue type | Severity | Count | URLs |",
    "|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| \`${r.type}\` — ${r.meta.title} | ${r.meta.severity} | ${r.count} | ${r.urls.join("<br>")} |`,
    ),
    "",
    "## Pages crawled",
    "",
    ...pages
      .map((p) => `- ${p.statusCode} ${p.fetchClass} ${p.url}`)
      .sort((a, b) => a.localeCompare(b)),
    "",
  ];
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join("\n"));
  console.log(
    `${origin}: ${pages.length} pages, ${detected.length} issues in ${rows.length} types → ${out}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
