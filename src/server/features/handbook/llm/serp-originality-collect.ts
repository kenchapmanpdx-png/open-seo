import { z } from "zod";
import { isOrganizationType } from "../checks/schema-localbusiness";
import { sha256Hex } from "@/server/lib/audit/ids";
import { isGoogleRedirect } from "@/shared/google-serp-url";
import type {
  CollectedData,
  PageSnapshot,
  SafeFetch,
} from "@/server/features/handbook/contracts/collectors";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import type { HandbookMode } from "@/server/features/handbook/contracts/status";
import type {
  SerpBlockedReason,
  SerpCollection,
  SerpJudge,
  SerpOriginality,
} from "@/server/features/handbook/contracts/scaled-copy";
import { createLimiter } from "../collectors/limiter";
import type { HandbookRuntime, RunInput } from "../engine/runner";
import { headerValue, normalizeUrl } from "../checks/support";
import type { PageMapper } from "./map";
import { offsiteMapJob } from "./map-input";
import {
  DEFAULT_LOCATION,
  DEFAULT_SERP_PAGES,
  MAX_QUERY_WORDS,
  parseJson,
  SerpCreditError,
  type QueryDeriver,
  type SerpHit,
  type SerpLocation,
  type SerpLookup,
} from "./serp-originality-deps";

/**
 * SUPP-18 collection (SCALED-COPY §3.3, ADR-024): pick the pages, derive one
 * search query per page (one LLM call), read Google's top 10 through
 * DataForSEO (cached 7 days in the evidence store), fetch the competitor
 * pages and profile them with the map model. The verdict is WO-B11-009's
 * check, through `judge` on the result. Never throws: a stop becomes a BLOCKED reason on the records.
 */

/** DataForSEO live organic, depth 10 (one billed page): the per-lookup cap unit. */
const LOOKUP_USD = 0.002;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_COMPETITORS = 5;
const FETCH_TIMEOUT_MS = 10_000;
const PAGE_CONCURRENCY = 3;
const MAP_CONCURRENCY = 4;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SELECTED_TYPES = new Set<PageProfile["pageType"]>([
  "service",
  "product",
  "guide",
  "article",
  "category",
]);
const NON_HTML =
  /\.(pdf|docx?|xlsx?|pptx?|csv|txt|xml|json|zip|jpe?g|png|gif|webp|svg|mp4|mp3)$/i;

const REVIEW_NOTE = "REVIEW mode: search-results data not used, EP-7";

export type SerpDeps = {
  lookup: SerpLookup;
  deriveQueries: QueryDeriver | null;
  /** Map model for competitor profiles (own budget); null → no profiles. */
  mapper: PageMapper | null;
  /** SUPP-18 verdict caller on the same budget (WO-B11-009); null → no verdicts. */
  judge: SerpJudge | null;
  /** Holds `<projectId>/_serp-cache/<sha256>.json`. */
  cache: EvidenceStore;
  location?: SerpLocation;
  now?: () => Date;
};

type Selected = { page: PageSnapshot; profile: PageProfile };

/** Runner hook (checks stage): SUPP-18 collection when the option is on; one log line. */
export async function serpForRun(
  input: Pick<RunInput, "mode" | "origin" | "options" | "serp">,
  runtime: Pick<HandbookRuntime, "projectId" | "fetchOffsite" | "log">,
  collected: CollectedData,
  profiles: readonly PageProfile[] | undefined,
): Promise<SerpCollection | undefined> {
  if (!input.options?.serpOriginality) return undefined;
  const result = await collectSerpOriginality(
    {
      mode: input.mode,
      origin: input.origin,
      projectId: runtime.projectId,
      maxPages: input.options.serpOriginalityPages ?? DEFAULT_SERP_PAGES,
    },
    collected,
    profiles,
    runtime.fetchOffsite,
    input.serp,
  );
  if (result.status === "ran")
    runtime.log("handbook.serp", {
      pages: result.pages.length,
      blocked: result.blocked,
      lookupUsd: result.lookupUsd,
    });
  return result;
}

/** SUPP-18 collection; REVIEW mode → `na` (EP-7: no search-results data). */
async function collectSerpOriginality(
  run: {
    mode: HandbookMode;
    origin: string;
    projectId: string;
    maxPages: number;
  },
  collected: CollectedData,
  profiles: readonly PageProfile[] | undefined,
  fetchOffsite: SafeFetch,
  deps: SerpDeps | null | undefined,
): Promise<SerpCollection> {
  if (run.mode === "REVIEW") return { status: "na", note: REVIEW_NOTE };
  const location = deps?.location ?? DEFAULT_LOCATION;
  const selected = selectPages(collected, profiles ?? [], run.origin).slice(
    0,
    run.maxPages,
  );
  const base = (page: Selected, query = ""): SerpOriginality => ({
    url: page.page.url,
    query,
    querySource: "derived",
    location: location.label,
    language: location.language,
    results: [],
    verdict: null,
    blocked: null,
  });
  const stop = (reason: SerpBlockedReason): SerpCollection => ({
    status: "ran",
    blocked: reason,
    lookupUsd: 0,
    judge: null,
    pages: selected.map((p) => ({
      record: { ...base(p), blocked: reason },
      competitors: [],
    })),
  });
  if (!deps) return stop("dataforseo credit");
  // No map stage (LLM off or budget) means no page types to select by.
  if (!profiles || !deps.deriveQueries) return stop("llm budget");
  if (selected.length === 0)
    return {
      status: "ran",
      blocked: null,
      lookupUsd: 0,
      judge: deps.judge,
      pages: [],
    };
  const raw = await deps.deriveQueries(
    selected.map(({ page, profile }) => ({
      title: page.head.title ?? "",
      h1: page.h1[0] ?? "",
      topic: profile.topic,
    })),
  );
  if (!raw) return stop("llm budget");

  const brands = brandKeys(run.origin, collected);
  const ownHost = bareHost(run.origin);
  const cap = run.maxPages * LOOKUP_USD;
  const state = { lookupUsd: 0, credit: false, budget: false };
  // Pages that share a query share one lookup (in flight or done).
  const lookups = new Map<string, Promise<SerpHit[] | null>>();
  const limit = createLimiter(PAGE_CONCURRENCY);
  const pages = await Promise.all(
    selected.map((page, i) =>
      limit(async () => {
        const query = stripBrand(raw[i] ?? "", brands);
        const record = base(page, query);
        const blocked = (reason: SerpBlockedReason) => ({
          record: { ...record, blocked: reason },
          competitors: [],
        });
        if (!query) return blocked("serp pages unavailable");
        if (state.credit) return blocked("dataforseo credit");
        const id = query.toLowerCase();
        const pending =
          lookups.get(id) ??
          cachedLookup(deps, run.projectId, query, location, {
            canSpend: () => state.lookupUsd + LOOKUP_USD <= cap + 1e-9,
            spend: (usd) => {
              state.lookupUsd += usd;
            },
          }).catch((error: unknown) => {
            if (error instanceof SerpCreditError) state.credit = true;
            return null;
          });
        lookups.set(id, pending);
        const hits = await pending;
        if (!hits)
          return blocked(
            state.credit ? "dataforseo credit" : "serp pages unavailable",
          );
        const others = hits.filter((h) => bareHost(h.url) !== ownHost);
        const fetched = await Promise.all(
          others.map(async (h) => ({
            hit: h,
            ...(NON_HTML.test(pathOf(h.url))
              ? { fetch: "non-html" as const, html: null }
              : await fetchCompetitor(fetchOffsite, h.url)),
          })),
        );
        record.results = fetched.map((f) => ({
          rank: f.hit.rank,
          url: f.hit.url,
          fetch: f.fetch,
        }));
        const ok = fetched.filter((f) => f.fetch === "ok" && f.html);
        if (ok.length < MIN_COMPETITORS)
          return blocked("serp pages unavailable");
        const competitors = await profileCompetitors(deps.mapper, ok);
        if (competitors === "budget") {
          state.budget = true;
          return blocked("llm budget");
        }
        return { record, competitors };
      }),
    ),
  );
  return {
    status: "ran",
    blocked: state.credit
      ? "dataforseo credit"
      : state.budget
        ? "llm budget"
        : null,
    lookupUsd: Number(state.lookupUsd.toFixed(4)),
    judge: deps.judge,
    pages,
  };
}

/**
 * Service, product, guide, article and category pages (K14 names; never
 * home / contact / about / legal): the best-linked page of each template
 * first, then the rest by internal in-links.
 */
function selectPages(
  collected: CollectedData,
  profiles: readonly PageProfile[],
  origin: string,
): Selected[] {
  const { pages, templates } = collected;
  const snapshots = pages.status === "ok" ? pages.snapshots : [];
  const profileOf = new Map(
    profiles
      .filter((p) => p.scope === "page")
      .map((p) => [normalizeUrl(p.url), p]),
  );
  const templateOf = new Map<string, string>();
  if (templates.status === "ok")
    for (const t of templates.templates)
      for (const url of t.urls) templateOf.set(normalizeUrl(url), t.key);
  const inLinks = new Map<string, Set<string>>();
  for (const s of snapshots) {
    const from = normalizeUrl(s.url);
    for (const link of s.links) {
      const to = absolute(link.href, s.url);
      if (!to || to === from) continue;
      const set = inLinks.get(to) ?? new Set<string>();
      set.add(from);
      inLinks.set(to, set);
    }
  }
  const home = normalizeUrl(new URL("/", origin).href);
  const links = (url: string) => inLinks.get(normalizeUrl(url))?.size ?? 0;
  const seen = new Set<string>();
  const candidates: Selected[] = [];
  for (const page of snapshots) {
    const url = normalizeUrl(page.url);
    const profile = profileOf.get(url);
    if (page.status !== 200 || url === home || seen.has(url)) continue;
    if (!profile || !SELECTED_TYPES.has(profile.pageType)) continue;
    seen.add(url);
    candidates.push({ page, profile });
  }
  candidates.sort(
    (a, b) =>
      links(b.page.url) - links(a.page.url) ||
      a.page.url.localeCompare(b.page.url),
  );
  const firstOfTemplate: Selected[] = [];
  const rest: Selected[] = [];
  const templatesSeen = new Set<string>();
  for (const c of candidates) {
    const url = normalizeUrl(c.page.url);
    const key = templateOf.get(url) ?? url;
    if (templatesSeen.has(key)) rest.push(c);
    else {
      templatesSeen.add(key);
      firstOfTemplate.push(c);
    }
  }
  return [...firstOfTemplate, ...rest];
}

const compact = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

/** Host label ("acme" of www.acme.com) and Organization / WebSite names, compacted. */
function brandKeys(origin: string, collected: CollectedData): Set<string> {
  const host = bareHost(origin);
  const keys = new Set([compact(host), compact(host.split(".")[0] ?? "")]);
  const pages = collected.jsonld.status === "ok" ? collected.jsonld.pages : [];
  for (const page of pages)
    for (const node of page.nodes) {
      const name = node.properties.name;
      const brandNode = node.types.some(
        (t) => t === "WebSite" || isOrganizationType(t),
      );
      if (brandNode && typeof name === "string") keys.add(compact(name));
    }
  return new Set([...keys].filter((k) => k.length >= 3));
}

/** Drop any run of words that spells a brand key ("Blue Tree Funding", "bluetreefunding's"); ≤ 8 words. */
function stripBrand(query: string, brands: ReadonlySet<string>): string {
  const words = query.replace(/["“”]/g, "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; ) {
    let skip = 0;
    for (let j = words.length; j > i && !skip; j--)
      if (brands.has(compact(words.slice(i, j).join("")))) skip = j - i;
    if (skip) i += skip;
    else out.push(words[i++] ?? "");
  }
  return out.slice(0, MAX_QUERY_WORDS).join(" ").slice(0, 120);
}

async function cachedLookup(
  deps: SerpDeps,
  projectId: string,
  query: string,
  location: SerpLocation,
  cost: { canSpend: () => boolean; spend: (usd: number) => void },
): Promise<SerpHit[] | null> {
  const id = [query.toLowerCase(), location.code, location.language].join("|");
  const key = `${projectId}/_serp-cache/${await sha256Hex(id)}.json`;
  const now = (deps.now ?? (() => new Date()))();
  const bytes = await deps.cache.get(key);
  const cached = bytes
    ? cacheSchema.safeParse(parseJson(new TextDecoder().decode(bytes))).data
    : undefined;
  // Entries written before goto links were resolved are re-read.
  const fresh =
    cached &&
    now.getTime() - Date.parse(cached.fetchedAt) < CACHE_MS &&
    !cached.hits.some((h) => isGoogleRedirect(h.url));
  if (cached && fresh) return cached.hits;
  if (!cost.canSpend()) return null;
  const { hits, costUsd } = await deps.lookup(query, location);
  cost.spend(costUsd);
  const body = JSON.stringify({ fetchedAt: now.toISOString(), hits });
  await deps.cache.put(key, new TextEncoder().encode(body), "application/json");
  return hits;
}

const cacheSchema = z.object({
  fetchedAt: z.string(),
  hits: z.array(z.object({ rank: z.number(), url: z.string() })),
});

/** Browser UA, 10 s timeout, one retry; status 200 HTML only. */
async function fetchCompetitor(
  fetchOffsite: SafeFetch,
  url: string,
): Promise<{ fetch: "ok" | "failed" | "non-html"; html: string | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await withTimeout(
      fetchOffsite(url, { userAgent: BROWSER_UA }),
    ).catch(() => null);
    if (!res || res.status !== 200) continue;
    const type = headerValue(res.headers, "content-type") ?? "text/html";
    if (!type.includes("html")) return { fetch: "non-html", html: null };
    return { fetch: "ok", html: res.body };
  }
  return { fetch: "failed", html: null };
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Map-model profiles of the fetched competitors; "budget" when the SUPP-18 budget ran out. */
async function profileCompetitors(
  mapper: PageMapper | null,
  pages: ReadonlyArray<{ hit: SerpHit; html: string | null }>,
): Promise<PageProfile[] | "budget"> {
  if (!mapper) return "budget";
  const limit = createLimiter(MAP_CONCURRENCY);
  const outcomes = await Promise.all(
    pages.map((p) =>
      limit(() => mapper.profile(offsiteMapJob(p.hit.url, p.html ?? ""))),
    ),
  );
  const profiles = outcomes.flatMap((o) => (o.profile ? [o.profile] : []));
  const outOfBudget = outcomes.some(
    (o) => !o.profile && (o.reason === "budget" || o.reason === "credits"),
  );
  return outOfBudget && profiles.length < MIN_COMPETITORS ? "budget" : profiles;
}

function bareHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function absolute(href: string, base: string): string | null {
  try {
    return normalizeUrl(new URL(href, base).href);
  } catch {
    return null;
  }
}
