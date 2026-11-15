// Ported from Canonry/canonry@4b91e077 packages/integration-traffic/src/classifier.ts — MIT, © 2026 Arber X and contributors
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software, subject to the MIT License (https://opensource.org/license/mit).
// Fork changes: input is K9 `TrafficEvent`; `hostOf`/`hostMatchesDomain` copied from
// packages/contracts/src/url-normalize.ts; paid/organic split dropped (K9 has no field);
// one entry `classifyTrafficEvent` returns K9 `TrafficClass`.

import { assessAgentTrust } from "./agent-trust";
import type { TrafficClass, TrafficEvent } from "./contracts";
import { hasVerificationDataFor, verifyIpForRuleDecision } from "./ip-verify";
import {
  DEFAULT_AI_CRAWLER_RULES,
  DEFAULT_AI_REFERRER_RULES,
  FORK_SELF_UA_PATTERNS,
  RULES_VERSION,
  SELF_TRAFFIC_USER_AGENT_PATTERNS,
} from "./rules";

// Rules with this `purpose` represent per-user, on-demand fetches from an AI
// surface (ChatGPT-User, Perplexity-User, …), not bulk crawl.
const USER_FETCH_PURPOSE = "user-agent";

type CrawlerVerification = NonNullable<TrafficClass["verification"]>;
type EvidenceType = NonNullable<TrafficClass["evidenceType"]>;

/** Lowercased host without `www.` from a URL or bare hostname. */
function hostOf(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let hostname: string;
  try {
    hostname = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    ).hostname;
  } catch {
    return null;
  }
  return hostname ? hostname.replace(/^www\./i, "").toLowerCase() : null;
}

/** True when `candidate` is the same host as `domain`, or a subdomain of it. */
function hostMatchesDomain(
  candidate: string | null | undefined,
  domain: string | null | undefined,
): boolean {
  const candidateHost = hostOf(candidate);
  const domainHost = hostOf(domain);
  if (!candidateHost || !domainHost) return false;
  return (
    candidateHost === domainHost || candidateHost.endsWith(`.${domainHost}`)
  );
}

function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

// UTM source values are often a short label (`utm_source=chatgpt` for
// `chatgpt.com`): match the first DNS label of the rule's domain too.
function utmTokenMatchesDomain(utmSource: string, domain: string): boolean {
  if (hostMatchesDomain(utmSource, domain)) return true;
  const firstLabel = normalizeHost(domain).split(".")[0];
  return Boolean(firstLabel) && normalizeHost(utmSource) === firstLabel;
}

function utmSourceFromQuery(queryString: string | null): string | null {
  if (!queryString) return null;
  const source = new URLSearchParams(queryString).get("utm_source");
  return source ? normalizeHost(source) : null;
}

function utmSourceFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return utmSourceFromQuery(new URL(value).search.replace(/^\?/, ""));
  } catch {
    return null;
  }
}

/** Canonry's own tooling plus the fork's own fetchers. */
function isSelfTraffic(event: TrafficEvent): boolean {
  const userAgent = event.userAgent?.trim();
  if (!userAgent) return false;
  return [...SELF_TRAFFIC_USER_AGENT_PATTERNS, ...FORK_SELF_UA_PATTERNS].some(
    (pattern) => pattern.test(userAgent),
  );
}

function classifyCrawler(event: TrafficEvent) {
  const userAgent = event.userAgent?.trim();
  if (!userAgent) return null;
  for (const rule of DEFAULT_AI_CRAWLER_RULES) {
    // User-fetch rules route through classifyAiUserFetch; matching them here
    // would double-count human-in-the-loop fetches as machine crawl.
    if (rule.purpose === USER_FETCH_PURPOSE) continue;
    if (rule.userAgentPatterns.some((pattern) => pattern.test(userAgent))) {
      // UA match is spoofable: only an IP inside the operator's published
      // ranges lifts `claimed_unverified` to `verified`.
      const decision = verifyIpForRuleDecision(event.remoteIp, rule.id);
      const verification: CrawlerVerification = decision.verified
        ? "verified"
        : "claimed_unverified";
      return { rule, verification };
    }
  }
  return null;
}

function classifyAiUserFetch(event: TrafficEvent) {
  const userAgent = event.userAgent?.trim();
  if (!userAgent) return null;
  for (const rule of DEFAULT_AI_CRAWLER_RULES) {
    if (rule.purpose !== USER_FETCH_PURPOSE) continue;
    if (rule.userAgentPatterns.some((pattern) => pattern.test(userAgent))) {
      const decision = verifyIpForRuleDecision(event.remoteIp, rule.id);
      const trust = assessAgentTrust({
        rule,
        userAgent,
        path: event.path,
        verification: decision,
        listPublished: hasVerificationDataFor(rule.id),
      });
      // Fork: K9 has no trust field. A likely-fake agent request (scanner
      // path, undocumented UA) is stored as `unknown_ai_like` so rollups and
      // reports never count it as a genuine agent fetch.
      const verification: CrawlerVerification = decision.verified
        ? "verified"
        : trust.trust === "likely_fake"
          ? "unknown_ai_like"
          : "claimed_unverified";
      return { rule, verification };
    }
  }
  return null;
}

function classifyAiReferral(event: TrafficEvent) {
  const candidates: Array<[string | null, EvidenceType, boolean]> = [
    [hostOf(event.referer), "referer", false],
    [utmSourceFromQuery(event.queryString), "utm", true],
    // Edge-cached pages: only sub-resource requests reach the origin, carrying
    // the landing URL's UTM in their referer.
    [utmSourceFromUrl(event.referer), "referer-utm", true],
  ];
  for (const [value, evidenceType, isUtm] of candidates) {
    if (!value) continue;
    const rule = DEFAULT_AI_REFERRER_RULES.find((candidate) =>
      isUtm
        ? utmTokenMatchesDomain(value, candidate.domain)
        : hostMatchesDomain(value, candidate.domain),
    );
    if (rule) return { rule, sourceDomain: value, evidenceType };
  }
  return null;
}

const EMPTY = {
  ruleId: null,
  operator: null,
  product: null,
  purpose: null,
  verification: null,
  evidenceType: null,
  rulesVersion: RULES_VERSION,
} satisfies Omit<TrafficClass, "kind">;

/** self → crawler → user_fetch → referral → none (Canonry's order). */
export function classifyTrafficEvent(event: TrafficEvent): TrafficClass {
  if (isSelfTraffic(event)) return { ...EMPTY, kind: "self" };

  const crawler = classifyCrawler(event);
  if (crawler) {
    return {
      ...EMPTY,
      kind: "crawler",
      ruleId: crawler.rule.id,
      operator: crawler.rule.operator,
      product: crawler.rule.product,
      purpose: crawler.rule.purpose,
      verification: crawler.verification,
    };
  }

  const userFetch = classifyAiUserFetch(event);
  if (userFetch) {
    return {
      ...EMPTY,
      kind: "user_fetch",
      ruleId: userFetch.rule.id,
      operator: userFetch.rule.operator,
      product: userFetch.rule.product,
      purpose: userFetch.rule.purpose,
      verification: userFetch.verification,
    };
  }

  const referral = classifyAiReferral(event);
  if (referral) {
    return {
      ...EMPTY,
      kind: "referral",
      ruleId: referral.rule.domain,
      operator: referral.rule.operator,
      product: referral.rule.product,
      evidenceType: referral.evidenceType,
    };
  }

  return { ...EMPTY, kind: "none" };
}
