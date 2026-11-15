import type { TrafficEvent } from "../../../../src/server/features/ai-traffic/contracts";
import {
  AI_PREFILTER_UA_SUBSTRINGS,
  AI_REFERRER_DOMAINS,
} from "../../../../src/server/features/ai-traffic/rules";

// ADR-013 §1 step 5: only AI-looking requests leave Vercel. Deliberately
// broader than the classifier (substring, any case); the app decides.

const UA_TOKENS = AI_PREFILTER_UA_SUBSTRINGS.map((token) =>
  token.toLowerCase(),
);

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesAiDomain(value: string | null): boolean {
  if (!value) return false;
  const token = value
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  return AI_REFERRER_DOMAINS.some(
    (domain) =>
      token === domain ||
      token.endsWith(`.${domain}`) ||
      token === domain.split(".")[0],
  );
}

function utmSource(query: string | null): string | null {
  return query ? new URLSearchParams(query).get("utm_source") : null;
}

export function isAiCandidate(event: TrafficEvent): boolean {
  const userAgent = event.userAgent?.toLowerCase();
  if (userAgent && UA_TOKENS.some((token) => userAgent.includes(token)))
    return true;
  if (event.referer) {
    if (matchesAiDomain(hostOf(event.referer))) return true;
    const refererQuery = event.referer.split("?")[1] ?? null;
    if (matchesAiDomain(utmSource(refererQuery))) return true;
  }
  return matchesAiDomain(utmSource(event.queryString));
}
