import {
  sleep,
  withRetry,
} from "@/server/features/handbook/engine/transient-retry";
import type {
  CollectorContext,
  SafeFetchResult,
} from "@/server/features/handbook/contracts/collectors";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { SafeFetchBlockedError } from "@/server/features/handbook/engine/safe-fetch";

/**
 * Interstitial / bot-challenge detector (ADR-021, FULL-READ §3.8). A WAF or
 * bot-check layer that answers HTTP 200 with a "verifying your browser" page
 * hands crawlers a near-empty document instead of the content (SUPP-07).
 *
 * Three rules, first match wins:
 * - vendor: header / body signatures of known bot-check products;
 * - generic: ≤ 40 words AND (`location.reload` | meta refresh | challenge
 *   script) AND no canonical;
 * - hash: the same small body (≤ 2 kB) on ≥ 3 distinct URLs
 *   (`smallBodyHashTracker`, fed by the caller).
 */
export type Interstitial = {
  vendor: string | null;
  rule: "vendor" | "generic" | "hash";
};

type Headers = ReadonlyArray<readonly [string, string]>;

type Signature = {
  vendor: string;
  /** Body-only markers some vendors also inject into normal pages: only on small bodies. */
  smallOnly?: boolean;
  match: (body: string, header: (name: string) => string | null) => boolean;
};

/** Markers only challenge / block pages carry (not every proxied page). */
const SIGNATURES: readonly Signature[] = [
  {
    vendor: "cloudflare",
    match: (body, header) =>
      /challenge/i.test(header("cf-mitigated") ?? "") ||
      /__cf_chl|cf-chl-|challenge-platform/i.test(body) ||
      /<title>\s*(Just a moment|Attention Required! \| Cloudflare)/i.test(body),
  },
  {
    vendor: "openresty",
    smallOnly: true,
    match: (body) =>
      /One moment, please/i.test(body) &&
      /request is being verified|Please wait/i.test(body),
  },
  {
    vendor: "imunify360",
    smallOnly: true,
    match: (body) =>
      /imunify360|webshield/i.test(body) &&
      /captcha|bot-protection|verif|access denied/i.test(body),
  },
  {
    vendor: "sucuri",
    match: (body, header) =>
      header("x-sucuri-id") !== null &&
      /Sucuri WebSite Firewall|Access Denied|sucuri\.net\/privacy/i.test(body),
  },
  {
    vendor: "akamai",
    match: (body, header) =>
      /Reference\s*#\s*[\d.a-f]+/i.test(body) &&
      (/AkamaiGHost/i.test(header("server") ?? "") ||
        /AkamaiGHost|errors\.edgesuite\.net/i.test(body)),
  },
  {
    vendor: "incapsula",
    smallOnly: true,
    match: (body) => /_Incapsula_Resource/.test(body),
  },
  {
    vendor: "datadome",
    match: (body, header) =>
      header("x-datadome") !== null &&
      /captcha-delivery\.com|geo\.captcha-delivery/i.test(body),
  },
  {
    vendor: "perimeterx",
    smallOnly: true,
    match: (body) => /_pxCaptcha|px-captcha|captcha\.px-cdn\.net/i.test(body),
  },
  {
    vendor: "aws-waf",
    smallOnly: true,
    match: (body, header) =>
      /aws-waf-token|awswaf|AwsWafIntegration/i.test(body) ||
      /captcha|challenge/i.test(header("x-amzn-waf-action") ?? ""),
  },
];

const GENERIC_TRIGGER =
  /location\.reload|<meta[^>]+http-equiv\s*=\s*["']?refresh|<script[^>]*>[^<]*(challenge|captcha)|<script[^>]+src\s*=\s*["'][^"']*(challenge|captcha)/i;
/** Title-only markers kept from the pre-B9 detector (a reCAPTCHA form on a normal page is not a challenge). */
const GENERIC_TITLE = /<title>[^<]*(captcha|access denied|are you a robot)/i;
const GENERIC_MAX_WORDS = 40;
/** Challenge pages are small; a full page with an injected vendor script is not one. */
const SMALL_PAGE_CHARS = 50_000;
/** Signatures sit near the top of a challenge page; scanning more only adds false positives. */
const SCAN_CHARS = 20_000;

export function detectInterstitial(
  body: string,
  headers: Headers,
  url: string,
): Interstitial | null {
  const head = body.slice(0, SCAN_CHARS);
  const header = (name: string) =>
    headers.find(([k]) => k.toLowerCase() === name)?.[1] ?? null;
  const small = body.length <= SMALL_PAGE_CHARS;
  const vendor = SIGNATURES.find(
    (s) => (small || !s.smallOnly) && s.match(head, header),
  );
  if (vendor) return { vendor: vendor.vendor, rule: "vendor" };
  if (GENERIC_TITLE.test(head)) return { vendor: null, rule: "generic" };
  if (!GENERIC_TRIGGER.test(head)) return null;
  const facts = extractHtmlFacts(body, url);
  return facts.words <= GENERIC_MAX_WORDS && !facts.head.canonical
    ? { vendor: null, rule: "generic" }
    : null;
}

/** `interstitial:<vendor|generic|hash>` — the `blockedReason` string (WO-B9-008). */
export function interstitialReason(hit: Interstitial): string {
  return `interstitial:${hit.vendor ?? hit.rule}`;
}

export const SMALL_BODY_BYTES = 2048;
const HASH_MIN_URLS = 3;

/**
 * Identical small bodies across distinct URLs: add every response, then
 * `repeated()` lists the hashes seen on ≥ 3 URLs. Callers scope one tracker
 * per user agent, so a site-wide SPA shell the browser also gets can be
 * excluded by comparing with the browser's hashes.
 */
export function smallBodyHashTracker() {
  const urlsByHash = new Map<string, Set<string>>();
  return {
    add(url: string, bytes: number, sha256: string) {
      if (bytes > SMALL_BODY_BYTES) return;
      const urls = urlsByHash.get(sha256) ?? new Set<string>();
      urls.add(url);
      urlsByHash.set(sha256, urls);
    },
    repeated(): Set<string> {
      return new Set(
        [...urlsByHash]
          .filter(([, urls]) => urls.size >= HASH_MIN_URLS)
          .map(([hash]) => hash),
      );
    },
  };
}

/** Wait before re-fetching a page the crawl got an interstitial for. */
const INTERSTITIAL_RETRY_MS = 6000;

/**
 * Crawl fetch (browser UA) with the interstitial rule: a challenged page is
 * re-fetched once after 6 s (bot checks often clear); the run log keeps the
 * flag and a 400-char excerpt when it is still challenged. Vendor + generic
 * rules only — a small SPA shell repeats on every URL, so no hash rule here.
 */
export async function crawlFetch(
  ctx: CollectorContext,
  url: string,
): Promise<SafeFetchResult | null> {
  const challengeOf = (r: SafeFetchResult) =>
    detectInterstitial(r.body, r.headers, r.finalUrl);
  let first: SafeFetchResult | null = null;
  const res = await withRetry(
    async () => {
      const r = (await tryFetch(ctx, url)) ?? first;
      first ??= r;
      return r;
    },
    {
      tries: 2,
      retryable: (r) => r !== null && challengeOf(r) !== null,
      wait: () => sleep(INTERSTITIAL_RETRY_MS),
    },
  );
  const challenged = first ? challengeOf(first) : null;
  if (!res || !challenged) return res;
  const still = detectInterstitial(res.body, res.headers, res.finalUrl);
  ctx.log("handbook.crawl.interstitial", {
    url,
    status: res.status,
    reason: interstitialReason(challenged),
    stillChallenged: still !== null,
    excerpt: still ? res.body.slice(0, 400) : null,
  });
  return res;
}

async function tryFetch(ctx: CollectorContext, url: string) {
  try {
    return await ctx.fetch(url);
  } catch (error) {
    if (!(error instanceof SafeFetchBlockedError)) {
      ctx.log("handbook.crawl.fetch_failed", { url, error: String(error) });
    }
    return null;
  }
}
