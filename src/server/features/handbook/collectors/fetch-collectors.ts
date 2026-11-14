import { XMLParser } from "fast-xml-parser";
import { sha256Hex } from "@/server/lib/audit/ids";
import { decide, parseRobots } from "@/server/features/handbook/engine/robots";
import { siblingHosts } from "@/server/features/handbook/engine/safe-fetch";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import {
  BOT_USER_AGENTS,
  type BotFetchData,
  type BotName,
  type Collector,
  type CollectorContext,
  type CollectedData,
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

async function tryFetch(
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
      const res = await tryFetch(ctx, url);
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
      });
    }
    const pages =
      collected.pages?.status === "ok"
        ? collected.pages.snapshots.slice(0, 5)
        : [];
    const mdMirrors = [];
    for (const page of pages) {
      const u = new URL(page.finalUrl);
      const mdUrl = u.pathname.endsWith("/")
        ? `${u.origin}${u.pathname}index.html.md`
        : `${u.origin}${u.pathname}.md`;
      const res = await tryFetch(ctx, mdUrl, { maxRedirects: 0 });
      mdMirrors.push({ pageUrl: page.url, mdUrl, status: res?.status ?? 0 });
    }
    return { status: "ok", files, mdMirrors };
  },
};

/** Home + up to 5 template sample URLs. */
function probeUrls(
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
  max = 6,
) {
  const urls = [new URL("/", ctx.origin).href];
  if (collected.templates?.status === "ok") {
    for (const t of collected.templates.templates) {
      const first = t.samples[0]?.url;
      if (first && !urls.includes(first)) urls.push(first);
    }
  }
  return urls.slice(0, max);
}

export const headersCollector: Collector<"headers"> = {
  key: "headers",
  dependsOn: ["templates"],
  async collect(ctx, collected) {
    const responses = [];
    for (const url of probeUrls(ctx, collected)) {
      const res = await tryFetch(ctx, url);
      if (res)
        responses.push({
          url: res.finalUrl,
          status: res.status,
          headers: res.headers,
        });
    }
    if (responses.length === 0)
      return { status: "unavailable", reason: "no response" };
    return { status: "ok", responses };
  },
};

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
      const res = await tryFetch(ctx, url);
      if (res) {
        out.push({
          kind,
          url,
          finalUrl: res.finalUrl,
          status: res.status,
          redirectChain: res.redirectChain,
        });
      }
    }
    return { status: "ok", probes: out };
  },
};

const isBotName = (key: string): key is BotName => key in BOT_USER_AGENTS;

const CHALLENGE_MARKERS = [
  /<title>\s*Just a moment/i,
  /cf-chl-|challenge-platform/i,
  /Attention Required! \| Cloudflare/i,
  /captcha/i,
];

export const botFetchCollector: Collector<"botFetch"> = {
  key: "botFetch",
  dependsOn: ["templates"],
  async collect(ctx, collected) {
    const fetches: BotFetchData["fetches"][number][] = [];
    const agents: {
      bot: BotFetchData["fetches"][number]["bot"];
      userAgent?: string;
    }[] = [
      { bot: "browser" },
      ...Object.keys(BOT_USER_AGENTS)
        .filter(isBotName)
        .map((bot) => ({ bot, userAgent: BOT_USER_AGENTS[bot] })),
    ];
    for (const url of probeUrls(ctx, collected, 3)) {
      for (const { bot, userAgent } of agents) {
        const res = await tryFetch(ctx, url, { userAgent });
        if (!res) continue;
        const blocked =
          res.status === 403 || res.status === 429 || res.status === 503
            ? `HTTP ${res.status}`
            : CHALLENGE_MARKERS.some((m) => m.test(res.body.slice(0, 20_000)))
              ? "challenge page"
              : null;
        fetches.push({
          url,
          bot,
          status: res.status,
          finalUrl: res.finalUrl,
          bytes: bytesOf(res.body).byteLength,
          words: extractHtmlFacts(res.body, res.finalUrl).words,
          bodySha256: await sha256Hex(res.body),
          blockedReason: blocked,
        });
      }
    }
    if (fetches.length === 0)
      return { status: "unavailable", reason: "no response" };
    return { status: "ok", fetches };
  },
};
