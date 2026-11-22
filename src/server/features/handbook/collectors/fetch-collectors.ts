import { XMLParser } from "fast-xml-parser";
import { decide, parseRobots } from "@/server/features/handbook/engine/robots";
import { siblingHosts } from "@/server/features/handbook/engine/safe-fetch";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import {
  MD_MIRROR_CAP,
  mdMirrorTrigger,
} from "@/server/features/handbook/engine/escalations";
import {
  BOT_USER_AGENTS,
  type Collector,
  type CollectorContext,
  type LlmsData,
  type RobotsDecision,
  type RobotsHost,
  type SafeFetchResult,
  type SitemapData,
  type VariantsData,
} from "@/server/features/handbook/contracts/collectors";

/** Bot tokens whose robots.txt group is evaluated (handbook §18). */
export const ROBOTS_BOT_TOKENS = [
  ...Object.keys(BOT_USER_AGENTS),
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "Perplexity-User",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
] as const;

const ROBOTS_PATHS = ["/", "/llms.txt", "/sitemap.xml"];
const MAX_SITEMAPS = 50;
const MAX_SITEMAP_URLS = 50_000;

export async function tryFetch(
  ctx: CollectorContext,
  url: string,
  init?: Parameters<CollectorContext["fetch"]>[1],
): Promise<SafeFetchResult | null> {
  try {
    return await ctx.fetch(url, init);
  } catch (error) {
    ctx.log("handbook.collector.fetch_failed", { url, error: String(error) });
    return null;
  }
}

const header = (res: SafeFetchResult, name: string) =>
  res.headers.find(([k]) => k === name)?.[1] ?? null;

const bytesOf = (text: string) => new TextEncoder().encode(text);

export const robotsCollector: Collector<"robots"> = {
  key: "robots",
  dependsOn: [],
  async collect(ctx) {
    const hosts: RobotsHost[] = [];
    const decisions: RobotsDecision[] = [];
    for (const host of siblingHosts(new URL(ctx.origin).host)) {
      const url = `${new URL(ctx.origin).protocol}//${host}/robots.txt`;
      const res = await tryFetch(ctx, url, { maxRedirects: 0 });
      if (!res) continue;
      const ok = res.status === 200;
      const parsed = parseRobots(ok ? res.body : "");
      const storageKey = ok
        ? await ctx.storeBody("robotsTxt", url, bytesOf(res.body), "text/plain")
        : null;
      hosts.push({
        host,
        status: res.status,
        storageKey,
        groups: parsed.groups,
        sitemaps: parsed.sitemaps,
        parseWarnings: parsed.warnings,
      });
      for (const bot of ROBOTS_BOT_TOKENS) {
        for (const path of ROBOTS_PATHS) {
          decisions.push(decide(host, parsed.groups, bot, path));
        }
      }
    }
    if (hosts.length === 0) {
      return {
        status: "unavailable",
        reason: "robots.txt fetch failed on every host",
      };
    }
    return { status: "ok", hosts, decisions };
  },
};

const xml = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

function asArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

const SITEMAP_RETRY_MS = 2000;

export const sitemapCollector: Collector<"sitemap"> = {
  key: "sitemap",
  dependsOn: ["robots"],
  async collect(ctx, collected) {
    const declared =
      collected.robots?.status === "ok"
        ? collected.robots.hosts.flatMap((h) => h.sitemaps)
        : [];
    const queue =
      declared.length > 0
        ? [...declared]
        : [new URL("/sitemap.xml", ctx.origin).href];
    const sources: SitemapData["sources"][number][] = [];
    const urls: SitemapData["urls"][number][] = [];
    const seen = new Set<string>();
    while (queue.length > 0 && sources.length < MAX_SITEMAPS) {
      const url = queue.shift() ?? "";
      if (seen.has(url)) continue;
      seen.add(url);
      let res = await tryFetch(ctx, url);
      // One retry on 5xx: a transient 503 on the sitemap drops every
      // sitemap-only URL from the crawl (WO-B11-091).
      if (res && res.status >= 500 && res.status <= 599) {
        await new Promise((r) => setTimeout(r, SITEMAP_RETRY_MS));
        res = await tryFetch(ctx, url);
      }
      if (!res || res.status !== 200) {
        const error = res
          ? `HTTP ${res.status}`
          : "fetch failed or out of scope";
        sources.push({
          url,
          status: res?.status ?? 0,
          kind: "invalid",
          storageKey: null,
          errors: [error],
        });
        continue;
      }
      const storageKey = await ctx.storeBody(
        "sitemap",
        url,
        bytesOf(res.body),
        "application/xml",
      );
      const parsed = parseSitemapXml(res.body);
      queue.push(...parsed.children);
      for (const entry of parsed.entries) {
        if (urls.length < MAX_SITEMAP_URLS)
          urls.push({ ...entry, source: url });
      }
      sources.push({
        url,
        status: res.status,
        kind: parsed.kind,
        storageKey,
        errors: parsed.errors,
      });
    }
    return { status: "ok", sources, urls };
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const textOf = (value: unknown) =>
  typeof value === "string" ? value.trim() : null;

/** `<urlset>` → entries; `<sitemapindex>` → child sitemap URLs. */
function parseSitemapXml(body: string) {
  const entries: { loc: string; lastmod: string | null }[] = [];
  const children: string[] = [];
  let doc: unknown;
  try {
    doc = xml.parse(body);
  } catch (error) {
    return {
      kind: "invalid" as const,
      entries,
      children,
      errors: [`XML parse error: ${String(error)}`],
    };
  }
  const root = isRecord(doc) ? doc : {};
  const index = root.sitemapindex;
  const urlset = root.urlset;
  if (isRecord(index)) {
    for (const s of asArray(index.sitemap).filter(isRecord)) {
      const loc = textOf(s.loc);
      if (loc) children.push(loc);
    }
    return { kind: "index" as const, entries, children, errors: [] };
  }
  if (isRecord(urlset)) {
    for (const u of asArray(urlset.url).filter(isRecord)) {
      const loc = textOf(u.loc);
      if (loc) entries.push({ loc, lastmod: textOf(u.lastmod) });
    }
    return { kind: "urlset" as const, entries, children, errors: [] };
  }
  return {
    kind: "invalid" as const,
    entries,
    children,
    errors: ["root element is neither <urlset> nor <sitemapindex>"],
  };
}

const MD_MIRROR_BASE = 5;

const mdMirrorUrl = (pageUrl: string) => {
  const u = new URL(pageUrl);
  return u.pathname.endsWith("/")
    ? `${u.origin}${u.pathname}index.html.md`
    : `${u.origin}${u.pathname}.md`;
};

const MD_LINK = /\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g;

export const llmsCollector: Collector<"llms"> = {
  key: "llms",
  dependsOn: ["pages"],
  async collect(ctx, collected) {
    const files: LlmsData["files"][number][] = [];
    for (const path of ["/llms.txt", "/llms-full.txt"]) {
      const url = new URL(path, ctx.origin).href;
      const res = await tryFetch(ctx, url, { maxRedirects: 0 });
      if (!res) continue;
      const ok = res.status === 200;
      const links = ok
        ? [...res.body.matchAll(MD_LINK)].map(
            (m) => new URL(m[1] ?? "", ctx.origin).href,
          )
        : [];
      files.push({
        url,
        status: res.status,
        contentType: header(res, "content-type"),
        storageKey: ok
          ? await ctx.storeBody("llmsTxt", url, bytesOf(res.body), "text/plain")
          : null,
        links,
        ...(ok ? { text: res.body.slice(0, 20_000) } : {}),
      });
    }
    const snapshots =
      collected.pages?.status === "ok" ? collected.pages.snapshots : [];
    const mdMirrors: LlmsData["mdMirrors"][number][] = [];
    const seen = new Set<string>();
    const probeMirrors = async (pages: typeof snapshots) => {
      for (const page of pages) {
        const mdUrl = mdMirrorUrl(page.finalUrl);
        if (seen.has(mdUrl)) continue;
        seen.add(mdUrl);
        const res = await tryFetch(ctx, mdUrl, { maxRedirects: 0 });
        mdMirrors.push({
          pageUrl: page.url,
          mdUrl,
          status: res?.status ?? 0,
          headers: res?.headers ?? [],
        });
      }
    };
    await probeMirrors(snapshots.slice(0, MD_MIRROR_BASE));
    // Escalation (FULL-READ §4 row 4, WO-B9-014): llms.txt or any mirror
    // answering 200 → probe the mirror of every live page, cap 200.
    const because = mdMirrorTrigger({ files, mdMirrors });
    if (because) {
      const rest = snapshots
        .slice(MD_MIRROR_BASE)
        .filter((s) => s.status === 200)
        .slice(0, MD_MIRROR_CAP - mdMirrors.length);
      ctx.log("handbook.md_mirror.escalate", { because, pages: rest.length });
      await probeMirrors(rest);
    }
    return { status: "ok", files, mdMirrors };
  },
};

const VARIANT_RETRY_DEFAULT_MS = 10_000;
const VARIANT_RETRY_MAX_MS = 15_000;

/** `Retry-After` in seconds (capped), else 10 s (a common Crawl-delay). */
function retryAfterMs(res: SafeFetchResult): number {
  const seconds = Number(header(res, "retry-after"));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, VARIANT_RETRY_MAX_MS)
    : VARIANT_RETRY_DEFAULT_MS;
}

export const variantsCollector: Collector<"variants"> = {
  key: "variants",
  dependsOn: ["pages"],
  async collect(ctx, collected) {
    const origin = new URL(ctx.origin);
    const [apex, www] = siblingHosts(origin.host);
    const inner =
      collected.pages?.status === "ok"
        ? collected.pages.snapshots.find(
            (s) => s.status === 200 && new URL(s.finalUrl).pathname.length > 1,
          )
        : undefined;
    const probes: [VariantsData["probes"][number]["kind"], string][] = [
      ["http-apex", `http://${apex}/`],
      ["http-www", `http://${www}/`],
      ["https-apex", `https://${apex}/`],
      ["https-www", `https://${www}/`],
      ["index-html", `${origin.origin}/index.html`],
      [
        "unknown-path",
        `${origin.origin}/handbook-probe-${Date.now().toString(36)}-not-found`,
      ],
      ["paginated-home", `${origin.origin}/page/2/`],
    ];
    if (inner) {
      const u = new URL(inner.finalUrl);
      const toggled = u.pathname.endsWith("/")
        ? u.pathname.slice(0, -1)
        : `${u.pathname}/`;
      probes.push([
        u.pathname.endsWith("/") ? "no-trailing-slash" : "trailing-slash",
        `${u.origin}${toggled}`,
      ]);
      if (/[a-z]/.test(u.pathname)) {
        probes.push([
          "uppercase-path",
          `${u.origin}${u.pathname.toUpperCase()}`,
        ]);
      }
    }
    const out: VariantsData["probes"][number][] = [];
    for (const [kind, url] of probes) {
      let res = await tryFetch(ctx, url);
      // One retry on 429: the probes run right after the crawl, and a
      // throttled answer says nothing about the variant (salonvata, B15).
      if (res?.status === 429) {
        const wait = retryAfterMs(res);
        await new Promise((r) => setTimeout(r, wait));
        res = await tryFetch(ctx, url);
      }
      if (res) {
        const facts = extractHtmlFacts(res.body, res.finalUrl);
        out.push({
          kind,
          url,
          finalUrl: res.finalUrl,
          status: res.status,
          redirectChain: res.redirectChain,
          title: facts.head.title,
          words: facts.words,
        });
      }
    }
    return { status: "ok", probes: out };
  },
};
