import { sort } from "remeda";
import { sha256Hex } from "@/server/lib/audit/ids";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { mainTextFacts } from "@/server/features/handbook/engine/minhash";
import { parseBlock } from "./jsonld-parse";
import { decide } from "@/server/features/handbook/engine/robots";
import { crawlFetch } from "@/server/features/handbook/engine/interstitial";
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
};

type PageExtra = { jsonLdBlocks: string[]; skeleton: string; bytes: number };

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
  const discover = (raw: string, by: DiscoveredBy) => {
    const url = normalize(raw);
    if (!url || source.has(url)) return;
    source.set(url, by);
    if (robotsAllowed(collected, url)) discovered.push(url);
  };
  const pending = () =>
    infiniteSpaceGuard(discovered).filter((u) => !attempted.has(u));

  for (const url of [home, ...(options.seedUrls ?? [])]) discover(url, "seed");
  if (collected.sitemap?.status === "ok") {
    for (const u of collected.sitemap.urls) discover(u.loc, "sitemap");
  }

  for (;;) {
    const room = options.maxPages - snapshots.length;
    const next = pending();
    if (room <= 0 || next.length === 0) break;
    const wave =
      next.length > room ? stratifiedFill(groupByPattern(next), room) : next;
    for (const url of wave) {
      if (snapshots.length >= options.maxPages) break;
      attempted.add(url);
      const page = await fetchPage(ctx, url, source.get(url) ?? "raw");
      if (!page) continue;
      const finalNorm = normalize(page.snapshot.finalUrl);
      if (finalNorm && finalNorm !== url && attempted.has(finalNorm)) {
        // Redirect to a page already crawled: keep a body-less stub so link
        // checks see `url → finalUrl` (P3-08). No rawKey/links/extras, so
        // templates and JSON-LD skip it; page-fact checks filter finalUrl = url.
        snapshots.push({
          ...page.snapshot,
          rawKey: null,
          links: [],
          images: [],
        });
        continue;
      }
      if (finalNorm) attempted.add(finalNorm);
      snapshots.push(page.snapshot);
      extras.set(url, page.extra);
      if (options.followLinks && page.snapshot.status === 200) {
        for (const link of sameHostLinks(page.snapshot)) discover(link, "raw");
      }
    }
  }
  const unread = pending().length;
  return {
    snapshots,
    coverage: {
      discovered: snapshots.length + unread,
      read: snapshots.length,
      capped: unread > 0,
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
    },
  };
}

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
): Promise<{ snapshot: PageSnapshot; extra: PageExtra } | null> {
  const res = await crawlFetch(ctx, url);
  if (!res) return null;
  const header = (name: string) =>
    res.headers.find(([k]) => k === name)?.[1] ?? null;
  const contentType = header("content-type");
  const isHtml = contentType ? HTML_TYPE.test(contentType) : true;
  const facts = isHtml ? extractHtmlFacts(res.body, res.finalUrl) : null;
  // Main words, MinHash and in-page repeated blocks (FULL-READ §3.5).
  const main = isHtml ? mainTextFacts(res.body) : null;
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
      discoveredBy,
      ...main,
    },
    extra: {
      jsonLdBlocks: facts?.jsonLdBlocks ?? [],
      skeleton: facts?.skeleton ?? "",
      bytes: bytes.byteLength,
    },
  };
}

const HEADER_VALUE_MAX = 2048;

/** Crawl response headers as stored on the snapshot (ADR-021): no cookies, values ≤ 2 kB. */
function keptHeaders(
  headers: ReadonlyArray<readonly [string, string]>,
): [string, string][] {
  return headers.flatMap(([name, value]): [string, string][] => {
    const key = name.toLowerCase();
    return key === "set-cookie"
      ? []
      : [[key, value.slice(0, HEADER_VALUE_MAX)]];
  });
}

function normalize(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    if (
      /\.(?:jpe?g|png|gif|webp|avif|svg|pdf|zip|mp4|mp3|css|js|ico|xml|txt)$/i.test(
        u.pathname,
      )
    ) {
      return null;
    }
    return u.href;
  } catch {
    return null;
  }
}

function emptyMarkup(): PageSnapshot["markup"] {
  return {
    headings: [],
    mainCount: 0,
    navLabels: [],
    scripts: [],
    headLinks: [],
    buttons: [],
    videos: [],
    counts: { tables: 0, lists: 0, forms: 0, iframes: 0, videos: 0 },
    text: "",
  };
}

function emptyHead(): PageSnapshot["head"] {
  return {
    title: null,
    metaDescription: null,
    canonical: null,
    robotsMeta: null,
    lang: null,
    viewport: null,
    og: {},
    twitter: {},
    meta: {},
    hreflang: [],
  };
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
