import { publicFetch } from "@/server/lib/public-fetch";
import {
  isCrawlableUrl,
  normalizeAndValidateStartUrl,
} from "@/server/lib/audit/url-policy";
import { readTextUpTo } from "@/server/lib/audit/html-response";
import type {
  SafeFetch,
  SafeFetchResult,
} from "@/server/features/handbook/contracts/collectors";

/**
 * The one outbound seam for handbook collectors (ADR-009).
 *
 * - Targets must be http(s), pass `isCrawlableUrl`, and sit on a host in
 *   `allowedHosts` (the project host + its apex/www sibling).
 * - Each distinct host gets a DNS check (`normalizeAndValidateStartUrl`) once.
 * - Redirects are manual; every hop is re-validated. A hop that leaves the
 *   allowed hosts is not followed: the 3xx is returned as the final response.
 * - Requests are paced per host and bodies are capped.
 */
export type SafeFetchOptions = {
  /** `"any"` = off-site fetches (outbound link checks); policy + DNS checks still apply. */
  allowedHosts: readonly string[] | "any";
  maxBytes?: number;
  timeoutMs?: number;
  /** Minimum gap between two requests to the same host. */
  minIntervalMs?: number;
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  checkHost?: (host: string) => Promise<void>;
  /**
   * WO-B27-001: a default-name request the site refuses (connection dropped,
   * 403, 406) is sent once more with `HANDBOOK_SHORT_USER_AGENT`; when that
   * answers, every later default-name request of this fetcher uses it.
   */
  shortNameRetry?: boolean;
};

export class SafeFetchBlockedError extends Error {
  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    super(`fetch blocked (${reason}): ${url}`);
  }
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MIN_INTERVAL_MS = 300;
const MAX_REDIRECTS = 10;

export const HANDBOOK_USER_AGENT =
  "Mozilla/5.0 (compatible; OpenSEO-Handbook/1.0; +https://openseo.so)";

/**
 * WO-B27-001: the same name without the "Mozilla/5.0 (compatible; …)"
 * wrapper. Some firewalls drop any client that claims "Mozilla" without a
 * browser's handshake (evolvedmechanical.com, 2026-11-28); this form still
 * names the app, so robots.txt rules for `OpenSEO-Handbook` keep applying.
 */
export const HANDBOOK_SHORT_USER_AGENT =
  "OpenSEO-Handbook/1.0 (+https://openseo.so)";

/** Answers that mean "not you" rather than "not this page". */
const REFUSED_STATUS = new Set([403, 406]);
const isTimeout = (error: unknown) =>
  error instanceof Error &&
  (error.name === "TimeoutError" || error.name === "AbortError");

/** `example.com` → [`example.com`, `www.example.com`] (and the reverse). */
export function siblingHosts(host: string): string[] {
  const bare = host.replace(/^www\./, "");
  return [bare, `www.${bare}`];
}

export function createSafeFetch(options: SafeFetchOptions): SafeFetch {
  // Compared against URL.hostname, so a `host:port` entry drops its port.
  const hosts = options.allowedHosts;
  const anyHost = hosts === "any";
  const allowed = new Set(
    hosts === "any"
      ? []
      : hosts.map((h) => h.toLowerCase().replace(/:\d+$/, "")),
  );
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const minInterval = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const doFetch =
    options.fetchImpl ??
    ((url: string, init: RequestInit) => publicFetch(url, init));
  const checkHost =
    options.checkHost ??
    (async (host: string) => {
      await normalizeAndValidateStartUrl(`https://${host}/`);
    });
  const hostChecks = new Map<string, Promise<void>>();
  const nextSlot = new Map<string, number>();
  // WO-B27-001: set once the site answered the short name after refusing
  // the default one; never set for a site that answers the default name.
  let shortName = false;
  // Both names refused once: no further retests (no retry bursts).
  let retestSpent = false;

  const validate = async (url: string) => {
    if (!isCrawlableUrl(url)) throw new SafeFetchBlockedError(url, "policy");
    const host = new URL(url).hostname.toLowerCase();
    if (!anyHost && !allowed.has(host))
      throw new SafeFetchBlockedError(url, "scope");
    let check = hostChecks.get(host);
    if (!check) {
      check = checkHost(host);
      hostChecks.set(host, check);
    }
    try {
      await check;
    } catch {
      throw new SafeFetchBlockedError(url, "dns");
    }
    return host;
  };

  const pace = async (host: string) => {
    const now = Date.now();
    const slot = Math.max(now, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + minInterval);
    if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
  };

  /** Default name; one short-name retest when the site refuses it (WO-B27-001). */
  const sendDefault = async (
    send: (userAgent: string) => Promise<Response>,
  ): Promise<Response> => {
    let first: Response;
    try {
      first = await send(HANDBOOK_USER_AGENT);
    } catch (error) {
      if (!options.shortNameRetry || retestSpent || isTimeout(error))
        throw error;
      const retest = await send(HANDBOOK_SHORT_USER_AGENT).catch(() => null);
      if (!retest || retest.status >= 400) {
        await retest?.body?.cancel();
        retestSpent = true;
        throw error;
      }
      shortName = true;
      return retest;
    }
    if (
      !options.shortNameRetry ||
      retestSpent ||
      !REFUSED_STATUS.has(first.status)
    )
      return first;
    const retest = await send(HANDBOOK_SHORT_USER_AGENT).catch(() => null);
    if (!retest || retest.status >= 400) {
      await retest?.body?.cancel();
      retestSpent = true;
      return first;
    }
    await first.body?.cancel();
    shortName = true;
    return retest;
  };

  return async (url, init = {}) => {
    const started = Date.now();
    const chain: { url: string; status: number }[] = [];
    const maxRedirects = init.maxRedirects ?? MAX_REDIRECTS;
    let current = url;
    for (;;) {
      const host = await validate(current);
      let sent = Date.now();
      const send = async (userAgent: string) => {
        await pace(host);
        sent = Date.now();
        return doFetch(current, {
          method: init.method ?? "GET",
          redirect: "manual",
          headers: {
            ...init.headers,
            "user-agent": userAgent,
            accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      };
      const response = init.userAgent
        ? await send(init.userAgent)
        : shortName
          ? await send(HANDBOOK_SHORT_USER_AGENT)
          : await sendDefault(send);
      const ttfbMs = Date.now() - sent;
      const location = response.headers.get("location");
      const isRedirect = response.status >= 300 && response.status < 400;
      if (isRedirect && location && chain.length < maxRedirects) {
        const next = new URL(location, current).href;
        const nextHost = new URL(next).hostname.toLowerCase();
        if (allowed.has(nextHost) && isCrawlableUrl(next)) {
          chain.push({ url: current, status: response.status });
          await response.body?.cancel();
          current = next;
          continue;
        }
      }
      return finish(response, {
        shortName: shortName && !init.userAgent,
        url,
        finalUrl: current,
        chain,
        started,
        ttfbMs,
        maxBytes,
        // A ranged request answered with the whole body (200, not 206) is
        // not read: media bodies are never downloaded (FULL-READ §3.12).
        skipBody:
          init.method === "HEAD" ||
          (init.headers?.range !== undefined && response.status !== 206),
      });
    }
  };
}

async function finish(
  response: Response,
  meta: {
    url: string;
    finalUrl: string;
    chain: { url: string; status: number }[];
    started: number;
    ttfbMs: number;
    maxBytes: number;
    skipBody: boolean;
    shortName: boolean;
  },
): Promise<SafeFetchResult> {
  const { url, finalUrl, chain, started, ttfbMs, maxBytes } = meta;
  const headers = [...response.headers.entries()].map(
    ([k, v]) => [k.toLowerCase(), v] as const,
  );
  if (meta.skipBody) await response.body?.cancel();
  const body = meta.skipBody ? "" : await readTextUpTo(response, maxBytes + 1);
  const truncated = new TextEncoder().encode(body).byteLength > maxBytes;
  return {
    url,
    finalUrl,
    status: response.status,
    headers,
    body: truncated ? body.slice(0, maxBytes) : body,
    truncated,
    redirectChain: chain,
    timingMs: Date.now() - started,
    ttfbMs,
    ...(meta.shortName ? { shortName: true as const } : {}),
  };
}
