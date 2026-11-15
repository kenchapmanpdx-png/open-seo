import { sort } from "remeda";
import { sha256Hex } from "@/server/lib/audit/ids";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { decide } from "@/server/features/handbook/engine/robots";
import { SafeFetchBlockedError } from "@/server/features/handbook/engine/safe-fetch";
import type {
  CollectedData,
  Collector,
  CollectorContext,
  JsonLdData,
  JsonLdNode,
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
      const snapshots = await crawl(ctx, collected, options, extras);
      if (snapshots.length === 0) {
        return { status: "unavailable", reason: "no page could be fetched" };
      }
      return { status: "ok", snapshots };
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
): Promise<PageSnapshot[]> {
  const home = new URL("/", ctx.origin).href;
  const queue: string[] = [home, ...(options.seedUrls ?? [])];
  if (collected.sitemap?.status === "ok") {
    queue.push(...collected.sitemap.urls.map((u) => u.loc));
  }
  const robots = collected.robots?.status === "ok" ? collected.robots : null;
  const seen = new Set<string>();
  const snapshots: PageSnapshot[] = [];

  while (queue.length > 0 && snapshots.length < options.maxPages) {
    const url = normalize(queue.shift() ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const parsed = new URL(url);
    const hostRobots = robots?.hosts.find((h) => h.host === parsed.host);
    if (
      hostRobots &&
      !decide(
        parsed.host,
        hostRobots.groups,
        "OpenSEO-Handbook",
        parsed.pathname,
      ).allowed
    ) {
      continue;
    }
    const page = await fetchPage(ctx, url);
    if (!page) continue;
    const finalNorm = normalize(page.snapshot.finalUrl);
    if (finalNorm && finalNorm !== url && seen.has(finalNorm)) continue;
    if (finalNorm) seen.add(finalNorm);
    snapshots.push(page.snapshot);
    extras.set(url, page.extra);
    if (options.followLinks && page.snapshot.status === 200) {
      for (const link of page.snapshot.links) {
        const target = normalize(link.href);
        if (
          target &&
          new URL(target).host === parsed.host &&
          !seen.has(target)
        ) {
          queue.push(target);
        }
      }
    }
  }
  return snapshots;
}

async function fetchPage(
  ctx: CollectorContext,
  url: string,
): Promise<{ snapshot: PageSnapshot; extra: PageExtra } | null> {
  let res;
  try {
    res = await ctx.fetch(url);
  } catch (error) {
    if (!(error instanceof SafeFetchBlockedError)) {
      ctx.log("handbook.crawl.fetch_failed", { url, error: String(error) });
    }
    return null;
  }
  const header = (name: string) =>
    res.headers.find(([k]) => k === name)?.[1] ?? null;
  const contentType = header("content-type");
  const isHtml = contentType ? HTML_TYPE.test(contentType) : true;
  const facts = isHtml ? extractHtmlFacts(res.body, res.finalUrl) : null;
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
    },
    extra: {
      jsonLdBlocks: facts?.jsonLdBlocks ?? [],
      skeleton: facts?.skeleton ?? "",
      bytes: bytes.byteLength,
    },
  };
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
    hreflang: [],
  };
}

// ---------------------------------------------------------------------------
// JSON-LD

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
// ---------------------------------------------------------------------------

function parseBlock(raw: string, index: number) {
  try {
    const value: unknown = JSON.parse(raw);
    return {
      block: { index, raw, parseError: null },
      nodes: flattenNodes(value),
    };
  } catch (error) {
    return {
      block: {
        index,
        raw,
        parseError: error instanceof Error ? error.message : "parse error",
      },
      nodes: [],
    };
  }
}

/** Top-level nodes and `@graph` members; nested objects stay as properties. */
function flattenNodes(value: unknown): JsonLdNode[] {
  if (Array.isArray(value)) return value.flatMap(flattenNodes);
  if (!isRecord(value)) return [];
  const record = value;
  const graph = record["@graph"];
  if (Array.isArray(graph)) return graph.flatMap(flattenNodes);
  const type = record["@type"];
  const types = Array.isArray(type)
    ? type.filter((t): t is string => typeof t === "string")
    : typeof type === "string"
      ? [type]
      : [];
  const id = typeof record["@id"] === "string" ? record["@id"] : null;
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k !== "@type" && k !== "@id" && k !== "@context") properties[k] = v;
  }
  return [{ id, types, properties }];
}

// ---------------------------------------------------------------------------
// Template clustering (ADR-006)
// ---------------------------------------------------------------------------

const DYNAMIC_SEGMENT =
  /^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27}|[0-9a-f]{12,}|.*\d.*-.*|.*-.*\d.*)$/i;

/** Path pattern per ADR-006: dynamic segments and ≥3-sibling runs become `*`. */
export function pathPatterns(urls: readonly string[]): Map<string, string> {
  const segs = new Map(
    urls.map((u) => [u, new URL(u).pathname.split("/").filter(Boolean)]),
  );
  const out = new Map<string, string>();
  for (const [url, parts] of segs) {
    if (parts.length === 0) {
      out.set(url, "/");
      continue;
    }
    const pattern = parts.map((part, i) => {
      if (DYNAMIC_SEGMENT.test(part)) return "*";
      // Siblings: same depth, every other segment equal.
      let siblings = 0;
      for (const other of segs.values()) {
        if (other.length !== parts.length) continue;
        if (other.every((o, j) => j === i || o === parts[j])) siblings += 1;
      }
      return siblings >= 3 ? "*" : part;
    });
    out.set(url, "/" + pattern.join("/"));
  }
  return out;
}

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
