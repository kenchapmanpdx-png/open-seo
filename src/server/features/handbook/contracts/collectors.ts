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
  timingMs: number;
};

export type SafeFetch = (
  url: string,
  init?: { userAgent?: string; method?: "GET" | "HEAD"; maxRedirects?: number },
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
  videos: ReadonlyArray<{
    src: string | null;
    poster: string | null;
    autoplay: boolean;
    muted: boolean;
    controls: boolean;
  }>;
  counts: {
    tables: number;
    lists: number;
    forms: number;
    iframes: number;
    videos: number;
  };
  /** Visible text (scripts/styles/templates skipped), collapsed, ≤20,000 chars. */
  text: string;
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
  }>;
};

export type RenderData = {
  pages: ReadonlyArray<{
    url: string;
    js: {
      finalUrl: string;
      status: number | null;
      renderedKey: string;
      words: number;
      requests: ReadonlyArray<{
        url: string;
        resourceType: string;
        status: number | null;
        /** Started before the load event (Resource Timing); absent from older sidecars. 1.1.0 */
        beforeLoad?: boolean;
      }>;
      opacityZeroWords: number;
      /** `<form>` count in the rendered DOM (P2-08 JS-only forms). 1.3.0 */
      forms?: number;
      firstScreenActions: ReadonlyArray<{
        tag: string;
        text: string;
        href: string | null;
      }>;
    };
    noJs: { status: number | null; nojsKey: string; words: number };
    firstScreenKey: string | null;
    consoleErrors: readonly string[];
  }>;
};

export type AxeData = {
  pages: ReadonlyArray<{
    url: string;
    violations: ReadonlyArray<{
      id: string;
      impact: "minor" | "moderate" | "serious" | "critical" | null;
      help: string;
      nodes: number;
      sampleTargets: readonly string[];
      /** Visible text of the sample nodes, ≤120 chars each, same order (P8-02). 1.3.0 */
      sampleTexts?: readonly string[];
    }>;
  }>;
};

export type LighthouseData = {
  pages: ReadonlyArray<{
    url: string;
    formFactor: "mobile" | "desktop";
    environment: string;
    performance: number | null;
    lcpMs: number | null;
    cls: number | null;
    tbtMs: number | null;
    lcpElement: string | null;
    storageKey: string | null;
    /** Lighthouse `render-blocking-resources` items (P7-05). 1.3.0 */
    renderBlocking?: ReadonlyArray<{ url: string; wastedMs: number }>;
  }>;
};

export type CollectedData = {
  pages: Collected<{ snapshots: readonly PageSnapshot[] }>;
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
