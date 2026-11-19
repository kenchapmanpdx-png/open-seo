/**
 * K2 — Collectors (ADR-004). Each collector runs once per run and writes one
 * keyed output into `CollectedData`. A collector that cannot run reports
 * `{ status: "unavailable", reason }`; dependent checks then report BLOCKED or
 * LIMITED, never PASS.
 */

export const COLLECTOR_KEYS = [
  "pages",
  "robots",
  "sitemap",
  "llms",
  "headers",
  "variants",
  "botFetch",
  "outbound",
  "jsonld",
  "templates",
  "render",
  "axe",
  "lighthouse",
] as const;
export type CollectorKey = (typeof COLLECTOR_KEYS)[number];

import type { AxeData, LighthouseData, RenderData } from "./render-data";

export type Unavailable = { status: "unavailable"; reason: string };
export type Collected<T> = ({ status: "ok" } & T) | Unavailable;

export type Collector<K extends CollectorKey> = {
  key: K;
  dependsOn: readonly CollectorKey[];
  collect: (
    ctx: CollectorContext,
    collected: Partial<CollectedData>,
  ) => Promise<CollectedData[K]>;
};

/** Runtime services a collector may use; all fetches go through `fetch`. */
export type CollectorContext = {
  runId: string;
  origin: string;
  /** SSRF-safe fetch (ADR-009): validated targets, manual redirects. */
  fetch: SafeFetch;
  /** Same SSRF policy without the site-host scope, for outbound link checks (P5-13). */
  fetchOffsite: SafeFetch;
  /** Persist a large body; returns its storage key (K4). */
  storeBody: (
    kind: string,
    url: string,
    bytes: Uint8Array,
    contentType: string,
  ) => Promise<string>;
  log: (event: string, fields: Record<string, unknown>) => void;
};

export type SafeFetchResult = {
  url: string;
  finalUrl: string;
  status: number;
  headers: ReadonlyArray<readonly [string, string]>;
  /** Decoded text, truncated at the run's byte cap. */
  body: string;
  truncated: boolean;
  redirectChain: ReadonlyArray<{ url: string; status: number }>;
  /** Whole call: pacing waits, every redirect hop and the body read. */
  timingMs: number;
  /** Final hop only: request sent → response headers received, ms. 1.6.0 */
  ttfbMs?: number;
};

export type SafeFetch = (
  url: string,
  init?: {
    userAgent?: string;
    method?: "GET" | "HEAD";
    maxRedirects?: number;
    /** Extra request headers (e.g. `range` for media sizes). 1.6.0 */
    headers?: Readonly<Record<string, string>>;
  },
) => Promise<SafeFetchResult>;

// ---------------------------------------------------------------------------
// Collector outputs
// ---------------------------------------------------------------------------

export type PageSnapshot = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string | null;
  rawKey: string | null;
  wordsRaw: number;
  /** Raw HTML size in bytes (decoded text, before the byte cap). */
  bytesRaw: number;
  /** Parsed facts every raw-HTML check reads, so bodies stay out of memory. */
  head: {
    title: string | null;
    metaDescription: string | null;
    canonical: string | null;
    robotsMeta: string | null;
    lang: string | null;
    viewport: string | null;
    og: Record<string, string>;
    twitter: Record<string, string>;
    /** Every other named `<meta>` (generator, article:*, theme-color…), lower-case keys. */
    meta: Record<string, string>;
    hreflang: ReadonlyArray<{ lang: string; href: string }>;
  };
  h1: readonly string[];
  links: ReadonlyArray<{
    href: string;
    text: string;
    rel: string | null;
    target: string | null;
    ariaLabel: string | null;
  }>;
  images: ReadonlyArray<{
    src: string;
    dataSrc: string | null;
    srcset: string | null;
    alt: string | null;
    width: string | null;
    height: string | null;
    loading: string | null;
    fetchpriority: string | null;
  }>;
  xRobotsTag: string | null;
  markup: PageMarkup;
  /**
   * Response headers of the crawl fetch: lower-cased names, `set-cookie`
   * values dropped, each value ≤ 2 kB (ADR-021). Headers-by-value checks read
   * these instead of re-fetching the page. 1.5.0
   */
  headers?: ReadonlyArray<readonly [string, string]>;
  /** Time to first byte of the crawl fetch, ms. 1.5.0 */
  ttfbMs?: number | null;
  /** How the crawl found this URL (render = second pass, JS-only link). 1.5.0 */
  discoveredBy?: DiscoveredBy;
  /**
   * Page-unique main-content words: page text minus the template's
   * boilerplate blocks (FULL-READ §3.11, SUPP-03, P3-12). 1.5.1
   */
  mainWords?: number;
  /** 128 MinHash values over 5-word shingles of the main text (near-duplicate pages). 1.5.1 */
  minhash?: readonly number[];
  /** Main-text blocks (≥ 40 words) repeated on this page or across the site, with counts. 1.5.1 */
  duplicateBlocks?: ReadonlyArray<{ text: string; count: number }>;
  /**
   * FNV-1a hashes of the page's block sentences (≥ 20 chars, lower-cased),
   * ≤ 400, document order (SUPP-17 shared-sentence sets, ADR-022). 1.7.0
   */
  sentenceHashes?: readonly number[];
  /**
   * Raw-HTML texts addressed to AI assistants (SUPP-19 Pattern A / B,
   * ADR-022): location, hidden flag, matched text ≤ 200 chars. 1.7.0
   */
  aiAddressed?: ReadonlyArray<AiAddressedText>;
};

/** Where a SUPP-19 text sits in the raw HTML (ADR-022). 1.7.0 */
export type AiAddressedText = {
  location: "text" | "comment" | "attribute" | "meta" | "jsonld";
  /** Comment / attribute / meta / JSON-LD, or an element hidden by attribute or inline style. */
  hidden: boolean;
  pattern: "A" | "B";
  text: string;
};

export const DISCOVERED_BY = ["raw", "sitemap", "seed", "render"] as const;
export type DiscoveredBy = (typeof DISCOVERED_BY)[number];

/** `<video>` element facts (FULL-READ §3.12). Raw HTML; rendered DOM adds first-screen flags (K3). */
export type MarkupVideo = {
  src: string | null;
  poster: string | null;
  autoplay: boolean;
  muted: boolean;
  controls: boolean;
  /** `preload` attribute as written (null = absent). 1.5.0 */
  preload?: string | null;
  loop?: boolean;
  width?: string | null;
  height?: string | null;
  /** CSS `aspect-ratio` from the inline style, if any. 1.5.0 */
  aspectRatio?: string | null;
  sources?: ReadonlyArray<{ src: string; type: string | null }>;
  tracks?: ReadonlyArray<{ kind: string | null; src: string | null }>;
  /** Present in the raw (server) HTML, not only after render. 1.5.0 */
  inRawHtml?: boolean;
};

export const EMBED_PROVIDERS = [
  "youtube",
  "vimeo",
  "wistia",
  "loom",
  "other",
] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

/** Video `<iframe>` embed facts (FULL-READ §3.12). 1.5.0 */
export type MarkupEmbed = {
  provider: EmbedProvider;
  videoId: string | null;
  src: string;
  loading: string | null;
  width: string | null;
  height: string | null;
  aspectRatio: string | null;
  /** Click-to-load thumbnail instead of the player iframe at load. */
  facade: boolean;
};

/** Raw-HTML structure facts for CRAWL / PERF / A11Y checks (one parse pass). */
export type PageMarkup = {
  headings: ReadonlyArray<{
    level: number;
    text: string;
    /** Nearest enclosing landmark element, if any. */
    landmark: "header" | "nav" | "footer" | "aside" | null;
  }>;
  mainCount: number;
  /** aria-label / aria-labelledby id of each `<nav>` (null = unlabelled). */
  navLabels: ReadonlyArray<string | null>;
  scripts: ReadonlyArray<{
    src: string | null;
    type: string | null;
    async: boolean;
    defer: boolean;
    inHead: boolean;
  }>;
  /** `<link>` tags other than canonical / hreflang (preload, preconnect, alternate, stylesheet…). */
  headLinks: ReadonlyArray<{
    rel: string;
    href: string;
    as: string | null;
    type: string | null;
  }>;
  buttons: ReadonlyArray<{ text: string; ariaLabel: string | null }>;
  videos: ReadonlyArray<MarkupVideo>;
  /** Video iframe embeds (YouTube, Vimeo, Wistia, Loom, …). 1.5.0 */
  embeds?: ReadonlyArray<MarkupEmbed>;
  counts: {
    tables: number;
    lists: number;
    forms: number;
    iframes: number;
    videos: number;
  };
  /** Visible text (scripts/styles/templates skipped), collapsed, ≤20,000 chars. */
  text: string;
  /** Words inside `data-nosnippet` elements (raw HTML). 1.5.1 */
  nosnippetWords?: number;
  /**
   * Start of the page's first answer paragraph (first `<p>` of ≥ 15 words
   * outside nav / header / footer / aside) when it sits inside
   * `data-nosnippet`; absent otherwise (SUPP-13). 1.6.0
   */
  firstAnswerNosnippet?: string;
  /** Runs of ≥ 3 lines that read as a list but are not `<ul>`/`<ol>` (e.g. `<br>`-separated "•" lines). 1.5.1 */
  fakeListRuns?: ReadonlyArray<{ sample: string; lines: number }>;
  /**
   * Prose paragraphs: text of each `<p>` outside header / nav / footer /
   * aside / form / li / td / th / blockquote, with the index of the
   * preceding H2 (−1 before the first); ≤ 20,000 chars in total (copy
   * quality, ADR-023). 1.7.0
   */
  prose?: ReadonlyArray<{ h2: number; text: string }>;
};

export type RobotsGroup = {
  userAgents: readonly string[];
  rules: ReadonlyArray<{ type: "allow" | "disallow"; path: string }>;
};

export type RobotsHost = {
  host: string;
  status: number;
  storageKey: string | null;
  groups: readonly RobotsGroup[];
  sitemaps: readonly string[];
  parseWarnings: readonly string[];
};

/** Decision for one bot token on one path, after RFC 9309 group selection. */
export type RobotsDecision = {
  host: string;
  bot: string;
  path: string;
  allowed: boolean;
  /** User-agent line of the group that matched ("*" when it fell back). */
  matchedGroup: string;
  matchedRule: string | null;
};

export type RobotsData = {
  hosts: readonly RobotsHost[];
  decisions: readonly RobotsDecision[];
};

export type SitemapData = {
  sources: ReadonlyArray<{
    url: string;
    status: number;
    kind: "index" | "urlset" | "invalid";
    storageKey: string | null;
    errors: readonly string[];
  }>;
  urls: ReadonlyArray<{ loc: string; lastmod: string | null; source: string }>;
};

export type LlmsData = {
  files: ReadonlyArray<{
    url: string;
    status: number;
    contentType: string | null;
    storageKey: string | null;
    links: readonly string[];
    /** Body text when 200, ≤20,000 chars (contracts 1.2.0; fact table). */
    text?: string;
  }>;
  mdMirrors: ReadonlyArray<{
    pageUrl: string;
    mdUrl: string;
    status: number;
    headers: ReadonlyArray<readonly [string, string]>;
  }>;
};

export type HeadersData = {
  responses: ReadonlyArray<{
    url: string;
    status: number;
    headers: ReadonlyArray<readonly [string, string]>;
  }>;
};

export const URL_VARIANT_KINDS = [
  "http-apex",
  "http-www",
  "https-apex",
  "https-www",
  "trailing-slash",
  "no-trailing-slash",
  "index-html",
  "unknown-path",
  "uppercase-path",
  /** `/page/2/` on the home URL (paginated-home duplicates). 1.5.1 */
  "paginated-home",
] as const;
export type UrlVariantKind = (typeof URL_VARIANT_KINDS)[number];

export type VariantsData = {
  probes: ReadonlyArray<{
    kind: UrlVariantKind;
    url: string;
    finalUrl: string;
    status: number;
    redirectChain: ReadonlyArray<{ url: string; status: number }>;
    /** Body facts, so a 404 body can be compared with live templates (P3-11). */
    title: string | null;
    words: number;
  }>;
};

export const BOT_USER_AGENTS = {
  Googlebot:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  Bingbot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/131.0.0.0 Safari/537.36",
  GPTBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
  "OAI-SearchBot":
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
  ClaudeBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  PerplexityBot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
} as const;
export type BotName = keyof typeof BOT_USER_AGENTS;

export type BotFetchData = {
  fetches: ReadonlyArray<{
    url: string;
    bot: BotName | "browser";
    status: number;
    finalUrl: string;
    bytes: number;
    words: number;
    bodySha256: string;
    blockedReason: string | null;
    /** Repeat round for ×2 parity fetches; absent = 1. 1.5.1 */
    round?: 1 | 2;
    /** First 400 chars of the body, kept only when `blockedReason` is set (stored evidence). 1.6.0 */
    excerpt?: string;
  }>;
  /**
   * Robots + live-fetch result per AI / search crawler token (≈ 23 tokens,
   * wider than the fixed `BotName` set fetched above). 1.5.1
   */
  policyMap?: ReadonlyArray<{
    token: string;
    robotsAllowed: boolean;
    status: number;
    blockedReason: string | null;
  }>;
};

/** Outbound (off-site) links found on crawled pages, fetched as browser and as one bot (P5-13). */
export type OutboundData = {
  links: ReadonlyArray<{
    url: string;
    sourceUrls: readonly string[];
    browser: { status: number; finalUrl: string } | null;
    bot: { name: BotName; status: number; finalUrl: string } | null;
  }>;
};

export type JsonLdNode = {
  id: string | null;
  types: readonly string[];
  /** Flattened top-level properties; nested nodes referenced by @id. */
  properties: Record<string, unknown>;
};

export type JsonLdData = {
  pages: ReadonlyArray<{
    url: string;
    blocks: ReadonlyArray<{
      index: number;
      raw: string;
      parseError: string | null;
    }>;
    nodes: readonly JsonLdNode[];
  }>;
};

export type TemplatesData = {
  templates: ReadonlyArray<{
    key: string;
    urlPattern: string;
    skeletonHash: string;
    urls: readonly string[];
    samples: ReadonlyArray<{
      url: string;
      rank: 1 | 2 | 3;
      reason: "first" | "median" | "largest";
    }>;
    /**
     * Text blocks shared by ≥ 80 % of the template's pages, stored once per
     * template (FULL-READ §3.11, ADR-021). Page-unique text = page text minus
     * these blocks. 1.5.0
     */
    boilerplate?: { blocks: readonly string[]; words: number };
  }>;
};

/** Crawl coverage (ADR-018): read < discovered when the page cap applied. 1.5.0 */
export type Coverage = {
  discovered: number;
  read: number;
  capped: boolean;
};

export type CollectedData = {
  /** `coverage`: discovered vs read when the page cap applied (ADR-018). 1.5.1 */
  pages: Collected<{ snapshots: readonly PageSnapshot[]; coverage?: Coverage }>;
  robots: Collected<RobotsData>;
  sitemap: Collected<SitemapData>;
  llms: Collected<LlmsData>;
  headers: Collected<HeadersData>;
  variants: Collected<VariantsData>;
  botFetch: Collected<BotFetchData>;
  outbound: Collected<OutboundData>;
  jsonld: Collected<JsonLdData>;
  templates: Collected<TemplatesData>;
  render: Collected<RenderData>;
  axe: Collected<AxeData>;
  lighthouse: Collected<LighthouseData>;
};
