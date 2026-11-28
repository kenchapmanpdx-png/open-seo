import {
  createSafeFetch,
  SafeFetchBlockedError,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import { decide, parseRobots } from "@/server/features/handbook/engine/robots";
import type { SafeFetchResult } from "@/server/features/handbook/contracts/collectors";

/**
 * WO-B20-010: before "Check a site" writes a project or a run, the website
 * must answer. `host` already passed `domainField` (public hostname, not an
 * IP); this adds DNS (SafeFetch's policy check), one home-page fetch and the
 * robots.txt verdict for the app, so a typo or a site the run cannot read
 * fails as a form error.
 * WO-B27-001: a site that drops the full app name is retested once with the
 * short one (SafeFetch `shortNameRetry`), the same rule the run uses.
 * WO-B27-002: each failure says what happened and whether retrying helps;
 * "Check the spelling" only when the name does not resolve.
 * The reason is returned, not thrown: a thrown AppError reaches the client as
 * its bare code. Every reason is built here from the host, a status number
 * and fixed words, so it carries no server internals.
 */
export async function verifyWebsite(
  host: string,
): Promise<{ ok: true; domain: string } | { ok: false; reason: string }> {
  const fetcher = createSafeFetch({
    allowedHosts: siblingHosts(host),
    timeoutMs: 15_000,
    maxBytes: 64 * 1024,
    shortNameRetry: true,
  });
  let home: SafeFetchResult;
  try {
    home = await fetcher(`https://${host}/`, { method: "GET" });
  } catch (error) {
    console.warn("handbook.verifyWebsite", host, error);
    return { ok: false, reason: failureReason(host, error) };
  }
  const answered = statusReason(host, home);
  if (answered) return { ok: false, reason: answered };
  if (!(await robotsAllowHome(fetcher, new URL(home.finalUrl).host))) {
    return {
      ok: false,
      reason: `${host}'s robots.txt does not allow OpenSEO-Handbook to read the home page, and the app obeys it. Trying again will not help unless the site changes its robots.txt.`,
    };
  }
  return { ok: true, domain: host };
}

const NOT_AGAIN = "Trying again will not help until the site changes this.";
const AGAIN = "Trying again later can help.";

function failureReason(host: string, error: unknown): string {
  if (error instanceof SafeFetchBlockedError) {
    return error.reason === "dns"
      ? `${host} does not exist (no DNS record). Check the spelling.`
      : `${host} cannot be checked (${error.reason}).`;
  }
  const code = errorCode(error);
  if (code === "timeout")
    return `${host} did not answer within 15 seconds. The site may be slow or down. ${AGAIN}`;
  if (code === "dns")
    return `${host} does not exist (no DNS record). Check the spelling.`;
  if (code === "refused")
    return `${host} refused the connection: nothing answers on HTTPS. ${AGAIN}`;
  if (code === "closed")
    return `${host} closed the connection before answering, for the app's full and short crawler names. Its firewall likely blocks automated checks. ${NOT_AGAIN}`;
  if (code === "tls")
    return `${host} has an HTTPS certificate problem, so the connection was not made (browsers warn too). ${NOT_AGAIN}`;
  // workerd reports a missing DNS record as a bare fetch failure.
  return `${host} did not answer. The name may not exist or the site may be offline. ${AGAIN}`;
}

const STATUS_WORDS: Record<number, string> = {
  401: "login required",
  403: "forbidden",
  404: "not found",
  406: "not acceptable",
  410: "gone",
  429: "too many requests",
  500: "server error",
  502: "bad gateway",
  503: "unavailable",
  504: "gateway timeout",
};

/** A home page the run cannot read: HTTP error, redirect loop, or a redirect off the site. */
function statusReason(host: string, home: SafeFetchResult): string | null {
  const { status } = home;
  if (status >= 400) {
    const words = STATUS_WORDS[status];
    const label = words ? `HTTP ${status} (${words})` : `HTTP ${status}`;
    const retry = status === 429 || status >= 500 ? AGAIN : NOT_AGAIN;
    return `${host} answered the home page with ${label}. ${retry}`;
  }
  if (status >= 300) {
    const location = home.headers.find(([k]) => k === "location")?.[1];
    const target = location ? safeHost(location, home.finalUrl) : null;
    if (target && !siblingHosts(host).includes(target))
      return `${host} redirects to ${target}. Check ${target} instead.`;
    return `${host} redirects in a loop and never reaches a page. ${NOT_AGAIN}`;
  }
  return null;
}

async function robotsAllowHome(
  fetcher: ReturnType<typeof createSafeFetch>,
  host: string,
): Promise<boolean> {
  const robots = await fetcher(`https://${host}/robots.txt`).catch(() => null);
  if (!robots || robots.status !== 200) return true;
  const { groups } = parseRobots(robots.body);
  // robots path: the home page "/" has no query string.
  return decide(host, groups, "OpenSEO-Handbook", "/").allowed;
}

function safeHost(location: string, base: string): string | null {
  try {
    return new URL(location, base).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Undici / Node error codes, read from the error and its cause. */
function errorCode(
  error: unknown,
): "timeout" | "dns" | "refused" | "closed" | "tls" | null {
  const parts: string[] = [];
  for (let e: unknown = error, depth = 0; e && depth < 4; depth += 1) {
    if (!(e instanceof Error)) break;
    parts.push(e.name, e.message);
    if ("code" in e && typeof e.code === "string") parts.push(e.code);
    e = e.cause;
  }
  const text = parts.join(" ");
  if (/TimeoutError|AbortError|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/.test(text))
    return "timeout";
  if (/ENOTFOUND|EAI_AGAIN/.test(text)) return "dns";
  if (/ECONNREFUSED/.test(text)) return "refused";
  if (/CERT|SSL|TLS|self[- ]signed|certificate/i.test(text)) return "tls";
  if (
    /ECONNRESET|UND_ERR_SOCKET|other side closed|socket hang up|connection lost/i.test(
      text,
    )
  )
    return "closed";
  return null;
}
