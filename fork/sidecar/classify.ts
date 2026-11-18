/**
 * Requests the sidecar records then aborts (K3 1.2.0, ADR-021):
 * - beacon: analytics / tag / ad / pixel endpoints, so an audit render never
 *   fires the client's tags from the audit IP (only when `blockBeacons`).
 * - media: video / audio bodies are never downloaded; sizes come from HEAD
 *   requests in the engine (FULL-READ §3.12).
 * Detection (P7-04) still sees every request: aborted ones stay in the log.
 */

const BEACON_HOSTS =
  /(^|\.)(google-analytics\.com|googletagmanager\.com|analytics\.google\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com|connect\.facebook\.net|facebook\.com|snap\.licdn\.com|px\.ads\.linkedin\.com|bat\.bing\.com|clarity\.ms|hotjar\.com|hotjar\.io|analytics\.tiktok\.com|cdn\.segment\.com|api\.segment\.io|plausible\.io|stats\.wp\.com|pixel\.wp\.com|static\.ads-twitter\.com|analytics\.twitter\.com|t\.co|ct\.pinterest\.com|sc-static\.net|tr\.snapchat\.com|cdn\.mxpnl\.com|api-js\.mixpanel\.com|heapanalytics\.com|fullstory\.com|mouseflow\.com|static\.klaviyo\.com|js\.hs-analytics\.net|track\.hubspot\.com|js\.hs-scripts\.com)$/i;

/**
 * GA4 / UA hit endpoints on first-party or proxied hosts. Script names alone
 * ("analytics.js") are not matched: a site's own file may carry that name.
 */
const BEACON_PATHS = /(^|\/)(g|j|r)\/collect$/i;

const MEDIA_EXT =
  /\.(mp4|m4v|webm|mov|ogv|ogg|mp3|m4a|wav|aac|flac|m3u8|mpd)$/i;

export type AbortReason = "beacon" | "media";

export function classifyRequest(
  url: string,
  resourceType: string,
  blockBeacons: boolean,
): AbortReason | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (resourceType === "media" || MEDIA_EXT.test(parsed.pathname))
    return "media";
  if (!blockBeacons) return null;
  if (BEACON_HOSTS.test(parsed.hostname)) return "beacon";
  if (resourceType !== "document" && BEACON_PATHS.test(parsed.pathname))
    return "beacon";
  return null;
}

/** Video `<iframe>` src hosts (YouTube, Vimeo, Wistia, Loom); `.source` is passed into the page. */
export const VIDEO_EMBED =
  /(youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com|vimeo\.com|fast\.wistia\.(net|com)|wistia\.com|loom\.com)/i;

/** Concurrency cap from `HANDBOOK_SIDECAR_MAX_RENDERS` (ADR-018), default 3, 1…8. */
export function maxRendersFromEnv(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : 3;
}
