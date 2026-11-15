// Ported from Canonry/canonry@4b91e077 packages/integration-bing/src/{bing-client,constants}.ts
// and packages/contracts/src/retry.ts (withRetry, retryAfterDelayMs) — MIT, © 2026 Arber X and contributors
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software, subject to the MIT License (https://opensource.org/license/mit).
// Fork changes: read methods of ADR-014 §1 only (no submit/add-site); Workers-safe
// (global fetch + Web Crypto digest, no Node imports); responses parsed with Zod;
// retry loop inlined (GET-only, so every 5xx/network error is replayable).
import { z } from "zod";
import {
  BingApiError,
  bingBlockedUrlSchema,
  bingCrawlIssueSchema,
  bingCrawlStatsSchema,
  bingFeedSchema,
  bingQueryStatsSchema,
  bingRankAndTrafficStatsSchema,
  bingSiteSchema,
  bingSubmissionQuotaSchema,
  bingUrlInfoSchema,
} from "./bingTypes";

const BING_WMT_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
const BING_REQUEST_TIMEOUT_MS = 30_000;

// Bing's host limit is shared by every project on the instance, so a throttle
// is wait-and-succeed. Four retries at 2 s doubling to a 30 s ceiling covers
// about a minute of throttling per call.
const BING_MAX_RETRIES = 4;
const BING_RETRY_BASE_DELAY_MS = 2_000;
const BING_RETRY_MAX_DELAY_MS = 30_000;

// A call still throttled after the full retry budget is evidence about the
// ACCOUNT (Canonry measured `ThrottleUser` for over an hour): further calls with
// that key fail fast for this window instead of holding the limit open.
const BING_THROTTLE_COOLDOWN_MS = 10 * 60 * 1000;

function log(
  level: "info" | "warn" | "error",
  action: string,
  ctx: Record<string, unknown> = {},
): void {
  // Never pass the key in ctx; endpoints are built without it.
  const line = JSON.stringify({ module: "BingClient", action, ...ctx });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function redact(text: string, apiKey: string): string {
  return text.split(apiKey).join("***");
}

function requireText(value: string, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BingApiError(`${label} is required`, 400);
  }
}

function requireHttpUrl(value: string, label: string): void {
  requireText(value, label);
  let protocol: string;
  try {
    protocol = new URL(value).protocol;
  } catch {
    throw new BingApiError(`${label} must be a valid URL`, 400);
  }
  if (protocol !== "http:" && protocol !== "https:") {
    throw new BingApiError(`${label} must be an HTTP or HTTPS URL`, 400);
  }
}

/** Bing sometimes wraps an error body in `{"d":…}`; a miss reads as "not a throttle". */
function parseBingErrorCode(body: string): number | null {
  try {
    const parsed: unknown = JSON.parse(body);
    const root =
      parsed != null && typeof parsed === "object" && "d" in parsed
        ? parsed.d
        : parsed;
    if (root != null && typeof root === "object" && "ErrorCode" in root) {
      return typeof root.ErrorCode === "number" ? root.ErrorCode : null;
    }
  } catch {
    // Non-JSON body (an HTML error page): nothing to read.
  }
  return null;
}

async function bingFetchOnce(
  apiKey: string,
  endpoint: string,
): Promise<unknown> {
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${BING_WMT_API_BASE}/${endpoint}${separator}apikey=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      signal: AbortSignal.timeout(BING_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // No `cause`: the original error may carry the request URL, and the URL carries the key.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(
      `Bing request failed (${endpoint.split("?")[0]}): ${redact(message, apiKey)}`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    log("error", "http.auth-failed", { endpoint, httpStatus: res.status });
    throw new BingApiError(
      "Bing API key is invalid or unauthorized",
      res.status,
    );
  }
  if (res.status === 429) {
    log("error", "http.rate-limited", { endpoint, httpStatus: 429 });
    throw new BingApiError(
      "Bing API rate limit exceeded",
      429,
      null,
      res.headers.get("retry-after"),
    );
  }
  if (!res.ok) {
    const body = await res.text();
    const detail = redact(
      body.length <= 500 ? body : `${body.slice(0, 500)}… [truncated]`,
      apiKey,
    );
    // Bing reports throttling as a 400 with the condition in the body.
    const bingErrorCode = parseBingErrorCode(body);
    const err = new BingApiError(
      `Bing API error (${res.status}): ${detail}`,
      res.status,
      bingErrorCode,
      res.headers.get("retry-after"),
    );
    log("error", err.isThrottle ? "http.throttled" : "http.error", {
      endpoint,
      httpStatus: res.status,
      bingErrorCode,
    });
    throw err;
  }

  const text = await res.text();
  if (text.trim() === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BingApiError("Bing API returned invalid JSON", 502);
  }
  // Bing wraps responses in { d: … }.
  return parsed != null && typeof parsed === "object" && "d" in parsed
    ? parsed.d
    : parsed;
}

/** `Retry-After` as delta-seconds or an HTTP date → ms; null when absent/unparseable. */
function retryAfterMs(err: unknown): number | null {
  if (!(err instanceof BingApiError) || err.retryAfter == null) return null;
  const raw = err.retryAfter.trim();
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const at = Date.parse(raw);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

// Throttle cooldown per key, keyed by a digest so the secret is never a Map key.
// Module-level: the limit is on the account, shared by every caller in the isolate.
const throttleCooldownUntil = new Map<string, number>();

async function keyDigest(apiKey: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );
  return Array.from(new Uint8Array(bytes).slice(0, 6), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function cooldownRemainingMs(digest: string): number {
  const until = throttleCooldownUntil.get(digest);
  if (until == null) return 0;
  const remaining = until - Date.now();
  if (remaining <= 0) {
    throttleCooldownUntil.delete(digest);
    return 0;
  }
  return remaining;
}

function openCooldown(digest: string, err: BingApiError): void {
  const cooldownMs = Math.max(
    BING_THROTTLE_COOLDOWN_MS,
    retryAfterMs(err) ?? 0,
  );
  const now = Date.now();
  // A later failure never shortens an earlier, longer hold.
  const until = Math.max(
    throttleCooldownUntil.get(digest) ?? 0,
    now + cooldownMs,
  );
  throttleCooldownUntil.set(digest, until);
  log("error", "http.cooldown-open", { cooldownMs: until - now });
}

function isRetryable(err: unknown): boolean {
  if (err instanceof BingApiError) return err.isThrottle || err.status >= 500;
  return true; // network / timeout
}

function backoffMs(attempt: number, err: unknown): number {
  const fromHeader = retryAfterMs(err);
  if (fromHeader != null) return fromHeader;
  const raw = BING_RETRY_BASE_DELAY_MS * 2 ** attempt;
  return Math.min(BING_RETRY_MAX_DELAY_MS, Math.random() * raw);
}

// Still throttled after every retry: the key goes quiet for a while.
function markFinalFailure(err: unknown, attempt: number, digest: string): void {
  if (!(err instanceof BingApiError)) return;
  err.retryCount = attempt;
  if (err.isThrottle) openCooldown(digest, err);
}

async function fetchWithRetry(
  apiKey: string,
  endpoint: string,
  digest: string,
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await bingFetchOnce(apiKey, endpoint);
      if (attempt > 0)
        log("info", "http.retry-recovered", { endpoint, retryCount: attempt });
      return data;
    } catch (err) {
      if (attempt >= BING_MAX_RETRIES || !isRetryable(err)) {
        markFinalFailure(err, attempt, digest);
        throw err;
      }
      const delayMs = backoffMs(attempt, err);
      log("warn", "http.retry", {
        endpoint,
        attempt,
        delayMs: Math.round(delayMs),
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Every Bing call goes through here: cooldown check, retry with backoff
 * (throttle, 5xx, network), cooldown on a throttle that outlasts the budget,
 * then Zod validation of the unwrapped payload.
 */
async function bingFetch<T>(
  apiKey: string,
  endpoint: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const digest = await keyDigest(apiKey);
  const cooling = cooldownRemainingMs(digest);
  if (cooling > 0) {
    log("warn", "http.cooldown-skip", { endpoint, remainingMs: cooling });
    throw new BingApiError(
      `Bing API key is in a throttle cooldown for another ${Math.ceil(cooling / 1000)}s; call not attempted.`,
      429,
      null,
      String(Math.ceil(cooling / 1000)),
    );
  }

  const data = await fetchWithRetry(apiKey, endpoint, digest);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new BingApiError(
      `Bing API response for ${endpoint.split("?")[0]} did not match the expected shape`,
      502,
    );
  }
  return parsed.data;
}

function siteQuery(
  method: string,
  siteUrl: string,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({ siteUrl, ...extra });
  return `${method}?${params.toString()}`;
}

async function siteList<T>(
  apiKey: string,
  method: string,
  siteUrl: string,
  item: z.ZodType<T>,
): Promise<T[]> {
  requireText(apiKey, "API key");
  requireHttpUrl(siteUrl, "Site URL");
  const data = await bingFetch(
    apiKey,
    siteQuery(method, siteUrl),
    z.array(item).nullish(),
  );
  return data ?? [];
}

export async function getSites(apiKey: string) {
  requireText(apiKey, "API key");
  const data = await bingFetch(
    apiKey,
    "GetUserSites",
    z.array(bingSiteSchema).nullish(),
  );
  return data ?? [];
}

export async function getUrlInfo(apiKey: string, siteUrl: string, url: string) {
  requireText(apiKey, "API key");
  requireHttpUrl(siteUrl, "Site URL");
  requireHttpUrl(url, "URL");
  return bingFetch(
    apiKey,
    siteQuery("GetUrlInfo", siteUrl, { url }),
    bingUrlInfoSchema,
  );
}

/** Daily crawl counts (`GetCrawlStats`). */
export function getCrawlStats(apiKey: string, siteUrl: string) {
  return siteList(apiKey, "GetCrawlStats", siteUrl, bingCrawlStatsSchema);
}

export function getCrawlIssues(apiKey: string, siteUrl: string) {
  return siteList(apiKey, "GetCrawlIssues", siteUrl, bingCrawlIssueSchema);
}

/** Daily site clicks and impressions (`GetRankAndTrafficStats`), about six months back. */
export function getRankAndTrafficStats(apiKey: string, siteUrl: string) {
  return siteList(
    apiKey,
    "GetRankAndTrafficStats",
    siteUrl,
    bingRankAndTrafficStatsSchema,
  );
}

/** Weekly stats per search query (`GetQueryStats`). */
export function getQueryStats(apiKey: string, siteUrl: string) {
  return siteList(apiKey, "GetQueryStats", siteUrl, bingQueryStatsSchema);
}

/** Weekly stats per page (`GetPageStats`). Bing puts the page URL in `Query`. */
export function getPageStats(apiKey: string, siteUrl: string) {
  return siteList(apiKey, "GetPageStats", siteUrl, bingQueryStatsSchema);
}

/** Submitted sitemaps and feeds (`GetFeeds`). */
export function getFeeds(apiKey: string, siteUrl: string) {
  return siteList(apiKey, "GetFeeds", siteUrl, bingFeedSchema);
}

/** Pages and directories blocked from Bing results (`GetBlockedUrls`). */
export function getBlockedUrls(apiKey: string, siteUrl: string) {
  return siteList(apiKey, "GetBlockedUrls", siteUrl, bingBlockedUrlSchema);
}

/** URL submissions LEFT today and this month (`GetUrlSubmissionQuota`). */
export async function getUrlSubmissionQuota(apiKey: string, siteUrl: string) {
  requireText(apiKey, "API key");
  requireHttpUrl(siteUrl, "Site URL");
  return bingFetch(
    apiKey,
    siteQuery("GetUrlSubmissionQuota", siteUrl),
    bingSubmissionQuotaSchema,
  );
}

/**
 * WCF JSON date (`/Date(ms)/`, `/Date(ms-0700)/`) → ISO 8601. Null for a
 * missing value and for Bing's "never" sentinel (any value <= 0).
 */
export function parseBingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /\/Date\((-?\d+)(?:[-+]\d+)?\)\//.exec(value);
  if (!match) return null;
  const ms = Number.parseInt(match[1], 10);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

/** Calendar day (UTC) of a Bing stats row; Bing stamps rows at UTC midnight. */
export function bingDateToDay(value: string | null | undefined): string | null {
  const iso = parseBingDate(value);
  return iso ? iso.slice(0, 10) : null;
}

/** Bing sends `-1` (sometimes `0`) for "no position"; only a positive number is a position. */
export function bingPositionOrNull(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * Whether a crawl issue keeps a URL out of Bing results. `IssueType` is a
 * space-separated list of flags; anything other than None / SeoIssues /
 * SeoConcerns blocks serving, and a missing value counts as blocking.
 */
export function isBlockingCrawlIssue(
  issueType: string | null | undefined,
): boolean {
  const trimmed = issueType?.trim();
  if (!trimmed) return true;
  return trimmed
    .split(/\s+/)
    .some((flag) => !/^(?:None|Seo(?:Issues|Concerns))$/i.test(flag));
}
