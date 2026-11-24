import { sort } from "remeda";
import { sha256Hex } from "@/server/lib/audit/ids";
import { pageBlocks, templateBoilerplate } from "../engine/boilerplate";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { mainTextFacts } from "@/server/features/handbook/engine/minhash";
import { scanAiAddressed } from "@/server/features/handbook/engine/ai-addressed";
import { parseBlock } from "./jsonld-parse";
import { unreadCoverage } from "@/server/features/handbook/engine/unread";
import { emptyHead, emptyMarkup } from "./empty-page";
import { readAhead } from "./limiter";
import { keptHeaders } from "./kept-headers";
import { decide } from "@/server/features/handbook/engine/robots";
import { crawlFetch } from "@/server/features/handbook/engine/interstitial";
import { handbookExcluded } from "@/server/features/handbook/engine/exclude";
import {
  groupByPattern,
  infiniteSpaceGuard,
  pathPatterns,
  stratifiedFill,
} from "@/server/features/handbook/engine/depth";
import type {
  CollectedData,
  Coverage,
  Collector,
  CollectorContext,
  DiscoveredBy,
  JsonLdData,
  PageSnapshot,
  TemplatesData,
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

type PageExtra = {
  jsonLdBlocks: string[];
  skeleton: string;
  bytes: number;
  /** Block texts for the template boilerplate split (FULL-READ §3.11). */
  blocks: string[];
};

const HTML_TYPE = /text\/html|application\/xhtml/i;

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
  // Discovery order is kept; the infinite-space guard and the stratified
  // fill pick from it in BFS waves (ADR-018).
  const discovered: string[] = [];
  const source = new Map<string, DiscoveredBy>();
  const attempted = new Set<string>();
  const snapshots: PageSnapshot[] = [];
  const failed: string[] = [];
  const discover = (raw: string, by: DiscoveredBy) => {
    const url = normalize(raw);
    if (!url || source.has(url)) return;
    source.set(url, by);
    if (handbookExcluded(options.excludePaths ?? [], url)) return;
    if (robotsAllowed(collected, url)) discovered.push(url);
  };
  const pending = () =>
    infiniteSpaceGuard(discovered).filter((u) => !attempted.has(u));

  for (const url of [home, ...(options.seedUrls ?? [])]) discover(url, "seed");
  if (collected.sitemap?.status === "ok") {
    for (const u of collected.sitemap.urls) discover(u.loc, "sitemap");
  }

  const deadline = options.maxMinutes
    ? Date.now() + options.maxMinutes * 60_000
    : Infinity;
  const outOfTime = () => Date.now() >= deadline;
  let inFlight = CRAWL_CONCURRENCY;
  const throttled = () => {
    inFlight = 1;
  };
  for (;;) {
    const room = options.maxPages - snapshots.length;
    const next = pending();
    if (room <= 0 || next.length === 0 || outOfTime()) break;
    const wave =
      next.length > room ? stratifiedFill(groupByPattern(next), room) : next;
    // WO-B20-005: CRAWL_CONCURRENCY fetches in flight (safeFetch keeps its
    // per-host spacing); results handled in wave order as before.
    // A 429 from the site: one page at a time for the rest of the crawl.
    const take = readAhead(
      wave,
      () => Math.min(inFlight, options.maxPages - snapshots.length),
      (url) => fetchPage(ctx, url, source.get(url) ?? "raw", throttled),
    );
    for (const [index, url] of wave.entries()) {
      if (snapshots.length >= options.maxPages || outOfTime()) break;
      attempted.add(url);
      const page = await take(index);
      if (!page) {
        failed.push(url);
        continue;
      }
      const finalNorm = normalize(page.snapshot.finalUrl);
      let snapshot = page.snapshot;
      if (finalNorm && finalNorm !== url) {
        // Redirect: keep a body-less stub so link checks see `url →
        // finalUrl` (P3-08). No rawKey/links/extras, so templates and
        // JSON-LD skip it; page-fact checks filter finalUrl = url.
        snapshots.push({ ...snapshot, rawKey: null, links: [], images: [] });
        if (attempted.has(finalNorm)) continue;
        // First sight of the target (field test 6: /blogs/x → /blog/%20x,
        // linked nowhere else): the page itself is read under its final
        // URL, so page-fact checks see it.
        snapshot = { ...snapshot, url: snapshot.finalUrl, redirectChain: [] };
      }
      if (finalNorm) attempted.add(finalNorm);
      snapshots.push(snapshot);
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
  return {
    snapshots,
    coverage: {
      discovered: snapshots.length + left.length,
      read: snapshots.length,
      capped: left.length > 0,
      // CLI view of ACCURACY #0: cap leftovers and failed fetches (status unknown).
      unread: unreadCoverage([...left, ...failed].map(nullStatus), snapshots),
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
  const queue: string[] = [];
  for (const link of links) {
    const url = normalize(link);
    if (!url || seen.has(url) || !robotsAllowed(collected, url)) continue;
    seen.add(url);
    queue.push(url);
  }
  const guarded = infiniteSpaceGuard(queue);
  const room = Math.max(0, maxPages - prior.length);
  const wave =
    guarded.length > room
      ? stratifiedFill(groupByPattern(guarded), room)
      : guarded;
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
  const before = pages?.coverage ?? {
    discovered: prior.length,
    read: prior.length,
    capped: false,
  };
  const unread = guarded.length - snapshots.length;
  return {
    snapshots,
    jsonld,
    coverage: {
      ...before,
      discovered: before.discovered + guarded.length,
      read: before.read + snapshots.length,
      capped: before.capped || unread > 0,
      unread: unreadCoverage(
        [...(before.unread?.rows ?? []), ...guarded.map(nullStatus)],
        snapshots,
      ),
    },
  };
}

const nullStatus = (url: string) => ({ url, status: null });

/** Robots verdict for `OpenSEO-Handbook`; hosts without a robots.txt read allowed. */
function robotsAllowed(collected: Partial<CollectedData>, url: string) {
  const robots = collected.robots?.status === "ok" ? collected.robots : null;
  const parsed = new URL(url);
  const hostRobots = robots?.hosts.find((h) => h.host === parsed.host);
  return (
    !hostRobots ||
    decide(parsed.host, hostRobots.groups, "OpenSEO-Handbook", parsed.pathname)
      .allowed
  );
}

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

async function fetchPage(
  ctx: CollectorContext,
  url: string,
  discoveredBy: DiscoveredBy,
  onThrottled?: () => void,
): Promise<{ snapshot: PageSnapshot; extra: PageExtra } | null> {
  const res = await crawlFetch(ctx, url, onThrottled);
  if (!res) return null;
  const header = (name: string) =>
    res.headers.find(([k]) => k === name)?.[1] ?? null;
  const contentType = header("content-type");
  const isHtml = contentType ? HTML_TYPE.test(contentType) : true;
  const facts = isHtml ? extractHtmlFacts(res.body, res.finalUrl) : null;
  // Main words, MinHash and in-page repeated blocks (FULL-READ §3.5).
  const blocks = isHtml ? pageBlocks(res.body) : [];
  const main = isHtml ? mainTextFacts(res.body, blocks) : null;
  const bytes = new TextEncoder().encode(res.body);
  const rawKey = isHtml
    ? await ctx.storeBody("rawHtml", res.finalUrl, bytes, "text/html")
    : null;
  return {
    snapshot: {
      url,
      finalUrl: res.finalUrl,
      status: res.status,
      contentType,
      rawKey,
      wordsRaw: facts?.words ?? 0,
      bytesRaw: bytes.byteLength,
      head: facts?.head ?? emptyHead(),
      h1: facts?.h1 ?? [],
      links: facts?.links ?? [],
      images: facts?.images ?? [],
      xRobotsTag: header("x-robots-tag"),
      markup: facts?.markup ?? emptyMarkup(),
      headers: keptHeaders(res.headers),
      ttfbMs: res.ttfbMs ?? null,
      discoveredBy,
      ...main,
      ...(isHtml ? { aiAddressed: scanAiAddressed(res.body) } : {}),
      ...(res.redirectChain.length > 0
        ? { redirectChain: res.redirectChain }
        : {}),
      ...(facts ? { doctype: facts.doctype } : {}),
    },
    extra: {
      jsonLdBlocks: facts?.jsonLdBlocks ?? [],
      skeleton: facts?.skeleton ?? "",
      bytes: bytes.byteLength,
      blocks,
    },
  };
}

function normalize(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    const asset =
      /\.(?:jpe?g|png|gif|webp|avif|svg|pdf|zip|mp4|mp3|css|js|ico|xml|txt)$/i;
    return asset.test(u.pathname) ? null : u.href;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Template clustering (ADR-006)
// ---------------------------------------------------------------------------

async function clusterTemplates(
  snapshots: readonly PageSnapshot[],
  extras: Map<string, PageExtra>,
): Promise<TemplatesData["templates"][number][]> {
  const html = snapshots.filter((s) => s.rawKey && s.status === 200);
  const patterns = pathPatterns(html.map((s) => s.url));
  const groups = new Map<
    string,
    { pattern: string; hash: string; urls: string[] }
  >();
  for (const snap of html) {
    const pattern = patterns.get(snap.url) ?? "/";
    const hash = (await sha256Hex(extras.get(snap.url)?.skeleton ?? "")).slice(
      0,
      8,
    );
    const key = `${pattern}:${hash}`;
    const group = groups.get(key) ?? { pattern, hash, urls: [] };
    group.urls.push(snap.url);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    urlPattern: g.pattern,
    skeletonHash: g.hash,
    urls: g.urls,
    samples: pickSamples(g.urls, (u) => extras.get(u)?.bytes ?? 0),
    boilerplate: templateBoilerplate(
      g.urls.map((u) => extras.get(u)?.blocks ?? []),
    ),
  }));
}

function pickSamples(urls: readonly string[], size: (url: string) => number) {
  const first = sort(
    urls,
    (a, b) => a.length - b.length || a.localeCompare(b),
  )[0];
  const bySize = sort(urls, (a, b) => size(a) - size(b));
  const median = bySize[Math.floor((bySize.length - 1) / 2)];
  const largest = bySize[bySize.length - 1];
  const picks: { url: string; reason: "first" | "median" | "largest" }[] = [];
  for (const [url, reason] of [
    [first, "first"],
    [median, "median"],
    [largest, "largest"],
  ] as const) {
    if (url && !picks.some((p) => p.url === url)) picks.push({ url, reason });
  }
  const ranks = [1, 2, 3] as const;
  return picks.flatMap((p, i) => {
    const rank = ranks[i];
    return rank ? [{ ...p, rank }] : [];
  });
}
