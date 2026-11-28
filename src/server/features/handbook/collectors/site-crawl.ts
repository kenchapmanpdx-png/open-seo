import { clusterTemplates } from "./crawl-templates";
import { fetchPage, normalize, type PageExtra } from "./crawl-fetch";
import { parseBlock } from "./jsonld-parse";
import { unreadCoverage } from "@/server/features/handbook/engine/unread";
import { readAhead } from "./limiter";
import { robotsAllowed } from "./crawl-robots";
import { handbookExcluded } from "@/server/features/handbook/engine/exclude";
import {
  groupByPattern,
  infiniteSpaceGuard,
  roundRobinBySection,
  stratifiedFill,
  variantPattern,
} from "@/server/features/handbook/engine/depth";
import { bySection, Variants } from "./crawl-variants";
import type {
  CollectedData,
  Coverage,
  Collector,
  CollectorContext,
  DiscoveredBy,
  JsonLdData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";

/**
 * `pages`, `jsonld` and `templates` share one crawl: the pages collector
 * parses each body once and keeps the JSON-LD blocks and skeletons for the
 * other two, so raw HTML never has to be re-read (ADR-001, ADR-006).
 */
export type CrawlOptions = {
  /** Workflow runs pass the upstream crawl's URL list; CLI runs leave it empty. */
  seedUrls?: readonly string[];
  /** Follow same-host links from fetched pages (CLI frontier). */
  followLinks: boolean;
  maxPages: number;
  /** Page-loop budget (WO-B18-011): past it the crawl stops, `capped`. Unset (CLI) = none. */
  maxMinutes?: number;
  /** Sections the user left out (audit `excludePaths`, WO-B18-015): never read. */
  excludePaths?: readonly string[];
};

export function createCrawlCollectors(options: CrawlOptions) {
  const extras = new Map<string, PageExtra>();

  const pages: Collector<"pages"> = {
    key: "pages",
    dependsOn: ["robots", "sitemap"],
    async collect(ctx, collected) {
      const { snapshots, coverage } = await crawl(
        ctx,
        collected,
        options,
        extras,
      );
      if (snapshots.length === 0) {
        return { status: "unavailable", reason: "no page could be fetched" };
      }
      return { status: "ok", snapshots, coverage };
    },
  };

  const jsonld: Collector<"jsonld"> = {
    key: "jsonld",
    dependsOn: ["pages"],
    async collect(_ctx, collected) {
      if (collected.pages?.status !== "ok") {
        return { status: "unavailable", reason: "pages unavailable" };
      }
      const out: JsonLdData["pages"][number][] = [];
      for (const snap of collected.pages.snapshots) {
        const blocks = extras.get(snap.url)?.jsonLdBlocks ?? [];
        const parsed = blocks.map((raw, index) => parseBlock(raw, index));
        out.push({
          url: snap.url,
          blocks: parsed.map((p) => p.block),
          nodes: parsed.flatMap((p) => p.nodes),
        });
      }
      return { status: "ok", pages: out };
    },
  };

  const templates: Collector<"templates"> = {
    key: "templates",
    dependsOn: ["pages"],
    async collect(_ctx, collected) {
      if (collected.pages?.status !== "ok") {
        return { status: "unavailable", reason: "pages unavailable" };
      }
      return {
        status: "ok",
        templates: await clusterTemplates(collected.pages.snapshots, extras),
      };
    },
  };

  return { pages, jsonld, templates };
}

const CRAWL_CONCURRENCY = 4; // WO-B20-005

async function crawl(
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
  options: CrawlOptions,
  extras: Map<string, PageExtra>,
): Promise<{ snapshots: PageSnapshot[]; coverage: Coverage }> {
  const home = new URL("/", ctx.origin).href;
  const source = new Map<string, DiscoveredBy>();
  const attempted = new Set<string>();
  const snapshots: PageSnapshot[] = [];
  const failed: string[] = [];
  let shortName = false; // WO-B27-001
  // WO-B27-004: in-scope sitemap URLs are read first, round-robin across
  // sections, and the crawl-space guard never drops them. Other URLs keep
  // discovery order; the guard and the stratified fill pick from them
  // (ADR-018).
  const sitemapUrls: string[] = [];
  const discovered: string[] = [];
  const known = new Set<string>();
  const leftOut = new Map<string, number>();
  const variants = new Variants();
  let counted = 0;
  const discover = (raw: string, by: DiscoveredBy) => {
    const url = normalize(raw);
    if (!url || source.has(url)) return;
    source.set(url, by);
    const excluded = handbookExcluded(options.excludePaths ?? [], url);
    if (excluded) {
      if (by === "sitemap")
        leftOut.set(excluded, (leftOut.get(excluded) ?? 0) + 1);
      return;
    }
    if (!robotsAllowed(collected, url)) return;
    if (by !== "sitemap" && variants.take(url, known)) return;
    known.add(url);
    (by === "sitemap" ? sitemapUrls : discovered).push(url);
  };

  discover(home, "seed");
  const sitemapOk =
    collected.sitemap?.status === "ok" ? collected.sitemap : null;
  for (const u of sitemapOk?.urls ?? []) discover(u.loc, "sitemap");
  for (const url of options.seedUrls ?? []) discover(url, "seed");
  const sitemapOrder = roundRobinBySection(sitemapUrls);
  const inSitemap = new Set(sitemapUrls);
  // Home first, then the sitemap, then everything else.
  const pending = () => [
    ...(attempted.has(home) || !known.has(home) ? [] : [home]),
    ...sitemapOrder.filter((u) => u !== home && !attempted.has(u)),
    ...infiniteSpaceGuard(discovered).filter(
      (u) => u !== home && !attempted.has(u),
    ),
  ];
  /** Sitemap URLs first; over the room, the rest by stratified fill. */
  const pick = (next: string[], room: number) => {
    if (next.length <= room) return next;
    const first = next.filter((u) => u === home || inSitemap.has(u));
    const fromSitemap = first.slice(0, room);
    const others = next.filter((u) => u !== home && !inSitemap.has(u));
    const rest = room - fromSitemap.length;
    return rest > 0
      ? [...fromSitemap, ...stratifiedFill(groupByPattern(others), rest)]
      : fromSitemap;
  };

  const deadline = options.maxMinutes
    ? Date.now() + options.maxMinutes * 60_000
    : Infinity;
  const outOfTime = () => Date.now() >= deadline;
  let inFlight = CRAWL_CONCURRENCY;
  const throttled = () => {
    inFlight = 1;
  };
  for (;;) {
    const room = options.maxPages - counted;
    const samples = variants.pending(attempted);
    const next = room > 0 ? pending() : [];
    if ((next.length === 0 && samples.length === 0) || outOfTime()) break;
    // Variant samples (WO-B27-004) are read but not counted.
    const wave = [...samples, ...pick(next, room)];
    // WO-B20-005: CRAWL_CONCURRENCY fetches in flight (safeFetch keeps its
    // per-host spacing); results handled in wave order as before.
    // A 429 from the site: one page at a time for the rest of the crawl.
    const take = readAhead(
      wave,
      () => Math.min(inFlight, Math.max(1, options.maxPages - counted)),
      (url) => fetchPage(ctx, url, source.get(url) ?? "raw", throttled),
    );
    for (const [index, url] of wave.entries()) {
      const sample = variants.isSample(url);
      if ((!sample && counted >= options.maxPages) || outOfTime()) break;
      attempted.add(url);
      const page = await take(index);
      if (!page) {
        failed.push(url);
        continue;
      }
      shortName ||= page.extra.shortName;
      const finalNorm = normalize(page.snapshot.finalUrl);
      let snapshot = page.snapshot;
      if (finalNorm && finalNorm !== url) {
        // Redirect: keep a body-less stub so link checks see `url →
        // finalUrl` (P3-08). No rawKey/links/extras, so templates and
        // JSON-LD skip it; page-fact checks filter finalUrl = url.
        snapshots.push({ ...snapshot, rawKey: null, links: [], images: [] });
        if (!sample) counted += 1;
        if (attempted.has(finalNorm)) continue;
        // First sight of the target (field test 6: /blogs/x → /blog/%20x,
        // linked nowhere else): the page itself is read under its final
        // URL, so page-fact checks see it.
        snapshot = { ...snapshot, url: snapshot.finalUrl, redirectChain: [] };
      }
      if (finalNorm) attempted.add(finalNorm);
      snapshots.push(snapshot);
      if (!sample) counted += 1;
      if (snapshots.length % 10 === 0) ctx.progress?.(snapshots.length);
      extras.set(snapshot.url, page.extra);
      if (options.followLinks && page.snapshot.status === 200) {
        for (const link of sameHostLinks(page.snapshot)) discover(link, "raw");
      }
    }
  }
  const left = pending();
  if (outOfTime() && left.length > 0)
    ctx.log("handbook.crawl.timeCap", { read: snapshots.length });
  const sitemapTotal = sitemapOk?.urls.length
    ? new Set(sitemapOk.urls.map((u) => u.loc)).size
    : null;
  return {
    snapshots,
    coverage: {
      discovered: snapshots.length + left.length,
      read: snapshots.length,
      capped: left.length > 0,
      // CLI view of ACCURACY #0: cap leftovers and failed fetches (status unknown).
      unread: unreadCoverage([...left, ...failed].map(nullStatus), snapshots),
      ...(shortName ? { shortName: true as const } : {}),
      scope: {
        limit: options.maxPages,
        sitemapTotal,
        sitemapInScope: sitemapUrls.length,
        leftOut: [...leftOut].map(([section, count]) => ({ section, count })),
        sitemapUnread: bySection(sitemapOrder.filter((u) => !attempted.has(u))),
        notFollowed: discovered.filter((u) => !attempted.has(u)).length,
        variants: variants.counts(),
      },
    },
  };
}

/**
 * Second crawl pass (ADR-021): fetches same-host links found only in the
 * rendered DOM that the first pass did not read, robots-allowed, within the
 * page budget left. Returns their snapshots (`discoveredBy: render`), their
 * JSON-LD and the updated coverage; the caller merges them into `pages`.
 */
export async function crawlSecondPass(
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
  links: readonly string[],
  maxPages: number,
): Promise<{
  snapshots: PageSnapshot[];
  jsonld: JsonLdData["pages"][number][];
  coverage: Coverage;
}> {
  const pages = collected.pages?.status === "ok" ? collected.pages : null;
  const prior = pages?.snapshots ?? [];
  const seen = new Set(
    prior.flatMap((s) => [normalize(s.url), normalize(s.finalUrl)]),
  );
  // WO-B27-004: variants are judged against every page the run knows (read
  // pages and sitemap URLs), and a pattern sampled in the first pass is not
  // sampled again.
  const known = new Set<string>();
  for (const url of seen) if (url) known.add(url);
  if (collected.sitemap?.status === "ok")
    for (const u of collected.sitemap.urls) {
      const url = normalize(u.loc);
      if (url) known.add(url);
    }
  const variants = new Variants(
    [...known].flatMap((url) => {
      const pattern = variantPattern(url, known);
      return pattern === null ? [] : [pattern];
    }),
  );
  const queue: string[] = [];
  for (const link of links) {
    const url = normalize(link);
    if (!url || seen.has(url) || !robotsAllowed(collected, url)) continue;
    seen.add(url);
    if (variants.take(url, known)) continue;
    queue.push(url);
  }
  const guarded = infiniteSpaceGuard(queue);
  const before = pages?.coverage ?? {
    discovered: prior.length,
    read: prior.length,
    capped: false,
  };
  const scope = before.scope;
  const counted = prior.length - (scope?.variants.sampled ?? 0);
  const room = Math.max(0, maxPages - counted);
  const samples = variants.pending(new Set());
  const wave = [
    ...samples,
    ...(guarded.length > room
      ? stratifiedFill(groupByPattern(guarded), room)
      : guarded),
  ];
  const snapshots: PageSnapshot[] = [];
  const jsonld: JsonLdData["pages"][number][] = [];
  for (const url of wave) {
    const page = await fetchPage(ctx, url, "render");
    if (!page) continue;
    snapshots.push(page.snapshot);
    const parsed = page.extra.jsonLdBlocks.map((raw, i) => parseBlock(raw, i));
    jsonld.push({
      url,
      blocks: parsed.map((p) => p.block),
      nodes: parsed.flatMap((p) => p.nodes),
    });
  }
  const readNow = new Set(snapshots.map((s) => s.url));
  const unread = guarded.filter((u) => !readNow.has(u)).length;
  const { skipped } = variants.counts();
  return {
    snapshots,
    jsonld,
    coverage: {
      ...before,
      discovered: before.discovered + guarded.length + samples.length,
      read: before.read + snapshots.length,
      capped: before.capped || unread > 0,
      unread: unreadCoverage(
        [...(before.unread?.rows ?? []), ...guarded.map(nullStatus)],
        snapshots,
      ),
      ...(scope
        ? {
            scope: {
              ...scope,
              notFollowed: scope.notFollowed + unread,
              sitemapUnread: scope.sitemapUnread
                .map((g) => ({
                  ...g,
                  urls: g.urls.filter((u) => !readNow.has(u)),
                }))
                .filter((g) => g.urls.length > 0),
              variants: {
                sampled: scope.variants.sampled + samples.length,
                skipped: scope.variants.skipped + skipped,
              },
            },
          }
        : {}),
    },
  };
}

const nullStatus = (url: string) => ({ url, status: null });

/** Same-host page links of a rendered DOM that the raw HTML of `url` lacks. */
export function renderOnlyLinks(
  url: string,
  rendered: readonly { href: string }[],
  raw: readonly { href: string }[],
): string[] {
  const host = new URL(url).host;
  const rawSet = new Set(raw.map((l) => normalize(l.href)));
  const self = normalize(url);
  const out = new Set<string>();
  for (const link of rendered) {
    const target = normalize(link.href);
    if (
      target &&
      target !== self &&
      new URL(target).host === host &&
      !rawSet.has(target)
    )
      out.add(target);
  }
  return [...out];
}

function sameHostLinks(snapshot: PageSnapshot): string[] {
  const host = new URL(snapshot.url).host;
  return snapshot.links.flatMap((link) => {
    const target = normalize(link.href);
    return target && new URL(target).host === host ? [target] : [];
  });
}
