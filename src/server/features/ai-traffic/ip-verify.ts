// Ported from Canonry/canonry@4b91e077 packages/integration-traffic/src/{ip-verify,ip-range-manifest}.ts — MIT, © 2026 Arber X and contributors
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software, subject to the MIT License (https://opensource.org/license/mit).
// Fork: ip-range-manifest.ts merged in; refresh script is fork/scripts/refresh-ip-ranges.ts.
/**
 * IP-range verification for bot operators that publish their crawler IPs.
 *
 * **Why this exists.** UA-string classification (`classifyCrawler`) is
 * spoofable per-request — any scraper can send
 * `User-Agent: Googlebot/2.1`. Operators that care about being
 * trustworthy publish the IP ranges their crawlers operate from; we use
 * those to promote `claimed_unverified` → `verified` when the request's
 * source IP falls in the published range.
 *
 * **Coverage today.** Operators with ranges bundled under
 * `./ip-ranges/<operator>.json`:
 *   - Googlebot              (developers.google.com/static/crawling/ipranges/common-crawlers.json)
 *   - bingbot                (www.bing.com/toolbox/bingbot.json)
 *   - OpenAI GPTBot          (openai.com/gptbot.json)
 *   - OpenAI ChatGPT-User    (openai.com/chatgpt-user.json)
 *   - OpenAI OAI-SearchBot   (openai.com/searchbot.json)
 *   - OpenAI OAI-AdsBot      (openai.com/adsbot.json)
 *   - OpenAI ChatGPT integrations (openai.com/chatgpt-connectors.json)
 *   - PerplexityBot          (www.perplexity.com/perplexitybot.json)
 *   - Perplexity-User        (www.perplexity.com/perplexity-user.json)
 *   - ClaudeBot, Claude-SearchBot, Claude-User
 *                            (claude.com/crawling/bots.json — Anthropic's
 *                             shared crawler-origin manifest does not split
 *                             ranges by bot, so these three rules verify
 *                             against the same published set.)
 *   - Claude-Agent           (claude.com/.well-known/sail — Anthropic's
 *                             hosted-browser egress, a SAIL file.)
 *   - Google-Agent           (developers.google.com/static/crawling/ipranges/user-triggered-agents.json
 *                             — Google's agentic user-request list.)
 *   - Google-GeminiNotebook  (developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json)
 *   - Google-CloudVertexBot  (Google common crawlers manifest)
 *   - Parallel ShapBot, Applebot, Common Crawl CCBot
 *   - DuckDuckBot, DuckAssistBot
 *   - MistralAI-User, MistralAI-Index
 *   - Amazonbot, Amzn-SearchBot, Amzn-User
 *
 * **Not covered (yet).** Meta, ByteDance, DeepSeek, xAI, You.com, Cohere,
 * Diffbot, Yandex, and Baidu do not publish a compatible range source.
 * Parallel's Shap-User and MistralAI-Training are also UA-only. Add them the moment an
 * official source appears; never infer crawler identity from cloud ASNs.
 *
 * **User-fetch agents and on-device fetches.** A user-triggered fetch
 * (`ChatGPT-User`, `Claude-User`, `Perplexity-User`, …) does not always
 * leave the operator's servers. Some surfaces fetch the URL server-side,
 * so it egresses from the operator's cloud IP and verifies here. A local
 * app can instead fetch straight from the user's device, egressing from
 * the user's own residential or cellular IP, which no operator publishes
 * and never could. That on-device case is structurally unverifiable: a
 * genuine user fetch then stays `claimed_unverified` permanently, and
 * that is correct, not a coverage gap. Treat the `ai_user_fetch` channel
 * count as the signal; an IP-confirmed `verified` is a bonus subset.
 *
 * **Refresh.** Run `fork/scripts/refresh-ip-ranges.ts` to re-fetch all
 * bundled lists from the publishers. The script is git-friendly: it
 * writes pretty-printed JSON so diffs show exactly which prefixes the
 * operator added/removed. Publishers that serve HTML (Amazon) or a SAIL
 * file (Anthropic's Claude-Agent) are converted to the same JSON shape.
 */
import { createHash } from "node:crypto";
import { sort } from "remeda";
import amazonbotRaw from "./ip-ranges/amazonbot.json";
import amznSearchbotRaw from "./ip-ranges/amzn-searchbot.json";
import amznUserRaw from "./ip-ranges/amzn-user.json";
import anthropicRaw from "./ip-ranges/anthropic.json";
import applebotRaw from "./ip-ranges/applebot.json";
import bingbotRaw from "./ip-ranges/bingbot.json";
import ccbotRaw from "./ip-ranges/ccbot.json";
import chatgptConnectorsRaw from "./ip-ranges/chatgpt-connectors.json";
import chatgptUserRaw from "./ip-ranges/chatgpt-user.json";
import claudeAgentRaw from "./ip-ranges/claude-agent.json";
import duckassistbotRaw from "./ip-ranges/duckassistbot.json";
import duckduckbotRaw from "./ip-ranges/duckduckbot.json";
import googleUserTriggeredRaw from "./ip-ranges/google-user-triggered-agents.json";
import googleUserFetchersRaw from "./ip-ranges/google-user-triggered-fetchers.json";
import googlebotRaw from "./ip-ranges/googlebot.json";
import gptbotRaw from "./ip-ranges/gptbot.json";
import mistralAiIndexRaw from "./ip-ranges/mistral-ai-index.json";
import mistralAiUserRaw from "./ip-ranges/mistral-ai-user.json";
import oaiAdsbotRaw from "./ip-ranges/oai-adsbot.json";
import oaiSearchbotRaw from "./ip-ranges/oai-searchbot.json";
import parallelShapbotRaw from "./ip-ranges/parallel-shapbot.json";
import perplexityUserRaw from "./ip-ranges/perplexity-user.json";
import perplexitybotRaw from "./ip-ranges/perplexitybot.json";

/** Exact bundled IP-range manifest consulted for a verification decision. */
export interface TrafficVerificationManifest {
  /** Stable identity: source + publisher version + canonical prefix-content digest. */
  id: string;
  source: string;
  version: string;
}

// --- ip-range-manifest.ts ---

/** A publisher IP-range entry. Exactly one address-family field is present. */
export type IpRangePrefix =
  | { ipv4Prefix: string; ipv6Prefix?: never }
  | { ipv4Prefix?: never; ipv6Prefix: string };

export interface ValidatedIpRangeManifestPayload {
  creationTime: string;
  prefixes: IpRangePrefix[];
}

export type IpRangeManifestValidationResult =
  | { ok: true; value: ValidatedIpRangeManifestPayload }
  | { ok: false; error: string };

export interface ParsedIp {
  readonly version: 4 | 6;
  readonly addr: bigint;
}

/** CIDR pre-parsed into the form needed for fast membership checks. */
export interface ParsedCidr {
  readonly version: 4 | 6;
  /** Network address as a BigInt (IPv6) or IPv4-as-BigInt for uniformity. */
  readonly network: bigint;
  /** Mask as a BigInt — `network & mask === addr & mask` proves membership. */
  readonly mask: bigint;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `Array#sort()`'s default order (UTF-16 code units), without mutating. */
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function stableJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? JSON.stringify(value)
      : JSON.stringify(String(value));
  }
  if (typeof value !== "object") return JSON.stringify(`[${typeof value}]`);
  if (seen.has(value)) return '"[circular]"';

  seen.add(value);
  const result = Array.isArray(value)
    ? `[${value.map((entry) => stableJson(entry, seen)).join(",")}]`
    : `{${sort(Object.keys(value), byCodeUnit)
        .map(
          (key) =>
            `${JSON.stringify(key)}:${stableJson(Reflect.get(value, key), seen)}`,
        )
        .join(",")}}`;
  seen.delete(value);
  return result;
}

/**
 * Parse an IPv4 or IPv6 address into a BigInt. The entire string must be a
 * valid address; partial numeric parses and whitespace are rejected.
 */
export function parseIp(ip: string): ParsedIp | null {
  if (typeof ip !== "string" || ip.length === 0) return null;

  // IPv4-mapped IPv6 (e.g. ::ffff:192.0.2.1) is treated as IPv4 so it can
  // match the publishers' IPv4 lists.
  const mappedMatch = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mappedMatch) return parseIp(mappedMatch[1]);

  if (ip.includes(":")) {
    const sides = ip.split("::");
    if (sides.length > 2) return null;
    const left = sides[0].length > 0 ? sides[0].split(":") : [];
    const right =
      sides.length === 2 && sides[1].length > 0 ? sides[1].split(":") : [];
    const groupCount = left.length + right.length;
    if (sides.length === 1 && groupCount !== 8) return null;
    // `::` must compress at least one 16-bit group.
    if (sides.length === 2 && groupCount >= 8) return null;

    const fill = 8 - groupCount;
    const groups: string[] = [
      ...left,
      ...Array.from({ length: fill }, () => "0"),
      ...right,
    ];
    let addr = 0n;
    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
      addr = (addr << 16n) | BigInt(Number.parseInt(group, 16));
    }
    return { version: 6, addr };
  }

  const octets = ip.split(".");
  if (octets.length !== 4) return null;
  let addr = 0n;
  for (const octet of octets) {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(octet)) return null;
    const value = Number(octet);
    if (value > 255) return null;
    addr = (addr << 8n) | BigInt(value);
  }
  return { version: 4, addr };
}

/** Parse a full `1.2.3.0/24` or `2001:db8::/32` CIDR string. */
export function parseCidr(cidr: string): ParsedCidr | null {
  if (typeof cidr !== "string") return null;
  const slash = cidr.indexOf("/");
  if (
    slash <= 0 ||
    slash !== cidr.lastIndexOf("/") ||
    slash === cidr.length - 1
  )
    return null;
  const ipPart = cidr.slice(0, slash);
  const prefixStr = cidr.slice(slash + 1);
  if (!/^(?:0|[1-9]\d{0,2})$/.test(prefixStr)) return null;

  const parsed = parseIp(ipPart);
  if (!parsed) return null;
  const prefix = Number(prefixStr);
  const totalBits = parsed.version === 4 ? 32 : 128;
  if (prefix > totalBits) return null;

  const allOnes = (1n << BigInt(totalBits)) - 1n;
  const mask =
    (allOnes >> BigInt(totalBits - prefix)) << BigInt(totalBits - prefix);
  return {
    version: parsed.version,
    network: parsed.addr & mask,
    mask,
  };
}

function canonicalPrefixKey(entry: unknown): string {
  if (isRecord(entry)) {
    const hasIpv4 = Object.hasOwn(entry, "ipv4Prefix");
    const hasIpv6 = Object.hasOwn(entry, "ipv6Prefix");
    if (hasIpv4 !== hasIpv6) {
      const value = entry[hasIpv4 ? "ipv4Prefix" : "ipv6Prefix"];
      if (typeof value === "string") {
        const parsed = parseCidr(value);
        const expectedVersion = hasIpv4 ? 4 : 6;
        if (parsed?.version === expectedVersion) {
          const hexWidth = parsed.version === 4 ? 8 : 32;
          const network = parsed.network.toString(16).padStart(hexWidth, "0");
          const mask = parsed.mask.toString(16).padStart(hexWidth, "0");
          return `cidr:${parsed.version}:${network}:${mask}`;
        }
      }
    }
  }
  return `invalid:${stableJson(entry)}`;
}

/**
 * SHA-256 of the executable prefix content. Valid CIDRs are normalized to
 * address family, network, and mask, then sorted so publisher reordering does
 * not create a new snapshot identity. Invalid payloads still receive a stable
 * fail-closed identity for provenance.
 */
export function ipRangeManifestContentHash(value: unknown): string {
  const prefixes = isRecord(value) ? value.prefixes : undefined;
  const canonical = Array.isArray(prefixes)
    ? sort(prefixes.map(canonicalPrefixKey), byCodeUnit)
    : [`invalid-prefixes:${stableJson(prefixes)}`];
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * Validate and normalize a publisher response before it becomes executable
 * verification data. Every entry must name exactly one address family and
 * contain one fully valid CIDR.
 */
export function validateIpRangeManifestPayload(
  value: unknown,
): IpRangeManifestValidationResult {
  if (!isRecord(value))
    return { ok: false, error: "response must be a JSON object" };

  const creationTime = value.creationTime;
  if (typeof creationTime !== "string" || creationTime.trim().length === 0) {
    return { ok: false, error: "response missing `creationTime` version" };
  }
  if (!Array.isArray(value.prefixes)) {
    return { ok: false, error: "response missing `prefixes` array" };
  }

  const prefixes: IpRangePrefix[] = [];
  for (const [index, entry] of value.prefixes.entries()) {
    if (!isRecord(entry)) {
      return { ok: false, error: `prefixes[${index}] must be an object` };
    }

    const hasIpv4 = Object.hasOwn(entry, "ipv4Prefix");
    const hasIpv6 = Object.hasOwn(entry, "ipv6Prefix");
    if (hasIpv4 === hasIpv6) {
      return {
        ok: false,
        error: `prefixes[${index}] must contain exactly one IP prefix`,
      };
    }

    const field = hasIpv4 ? "ipv4Prefix" : "ipv6Prefix";
    const cidr = entry[field];
    if (typeof cidr !== "string") {
      return {
        ok: false,
        error: `prefixes[${index}].${field} must be a string`,
      };
    }
    const parsed = parseCidr(cidr);
    const expectedVersion = hasIpv4 ? 4 : 6;
    if (!parsed || parsed.version !== expectedVersion) {
      return {
        ok: false,
        error: `prefixes[${index}].${field} is not a valid IPv${expectedVersion} CIDR`,
      };
    }

    prefixes.push(hasIpv4 ? { ipv4Prefix: cidr } : { ipv6Prefix: cidr });
  }

  return {
    ok: true,
    value: {
      creationTime: creationTime.trim(),
      prefixes,
    },
  };
}

// --- ip-verify.ts ---

export interface IpVerificationDecision {
  verified: boolean;
  /** Exact vendored publisher snapshot consulted for this decision. */
  manifest: TrafficVerificationManifest | null;
}

interface VerificationData {
  readonly ranges: ParsedCidr[];
  readonly manifest: TrafficVerificationManifest | null;
}

/**
 * Maps a classifier rule id (the `id` field on `AiCrawlerRule` in
 * `rules.ts`) to the ranges file for that operator. Rules with no
 * entry here can't be verified by IP — they stay
 * `claimed_unverified` after UA classification. Missing entries are
 * intentional (no publisher data) and should be added the moment an
 * operator publishes ranges.
 */
const RULE_ID_TO_RANGES: Record<string, unknown> = {
  // OpenAI publishes separate lists for each traffic surface because the
  // ranges differ between products.
  // src: https://openai.com/gptbot.json
  "openai-gptbot": gptbotRaw,
  // src: https://openai.com/chatgpt-user.json
  "openai-chatgpt-user": chatgptUserRaw,
  // src: https://openai.com/searchbot.json
  "openai-searchbot": oaiSearchbotRaw,
  // src: https://openai.com/adsbot.json
  "openai-adsbot": oaiAdsbotRaw,
  // src: https://openai.com/chatgpt-connectors.json
  "openai-chatgpt-connector": chatgptConnectorsRaw,

  // Search engines.
  // src: https://developers.google.com/static/crawling/ipranges/common-crawlers.json
  googlebot: googlebotRaw,
  // src: https://www.bing.com/toolbox/bingbot.json
  // (also covers Copilot grounding — Microsoft routes Copilot's
  // web fetches through bingbot infrastructure)
  bingbot: bingbotRaw,

  // Google-Agent — Google's agentic user-triggered fetcher (Project
  // Mariner et al.). Verified against Google's user-triggered-agents
  // list. Google publishes a different shared list for its non-agentic
  // user-triggered fetchers such as Gemini Notebook.
  // src: https://developers.google.com/static/crawling/ipranges/user-triggered-agents.json
  "google-agent": googleUserTriggeredRaw,
  // src: https://developers.google.com/static/crawling/ipranges/user-triggered-fetchers-google.json
  "google-gemini-notebook": googleUserFetchersRaw,
  // Google documents CloudVertexBot as a common crawler.
  "google-cloudvertexbot": googlebotRaw,

  // Perplexity — split between crawler and user-on-behalf fetcher,
  // same shape as OpenAI's split.
  // src: https://www.perplexity.com/perplexitybot.json
  "perplexity-bot": perplexitybotRaw,
  // src: https://www.perplexity.com/perplexity-user.json
  "perplexity-user": perplexityUserRaw,

  // Parallel publishes ranges for ShapBot, but not Shap-User.
  // src: https://docs.parallel.ai/resources/shapbot.json
  "parallel-shapbot": parallelShapbotRaw,

  // Other publisher manifests with the common Google-style schema.
  // src: https://search.developer.apple.com/applebot.json
  applebot: applebotRaw,
  // src: https://index.commoncrawl.org/ccbot.json
  ccbot: ccbotRaw,
  // src: https://duckduckgo.com/duckduckbot.json
  duckduckbot: duckduckbotRaw,
  // src: https://duckduckgo.com/duckassistbot.json
  duckassistbot: duckassistbotRaw,
  // src: https://mistral.ai/mistralai-user-ips.json
  "mistral-ai-user": mistralAiUserRaw,
  // src: https://mistral.ai/mistralai-index-ips.json
  "mistral-ai-index": mistralAiIndexRaw,

  // Amazon publishes embedded JSON in documentation pages. The refresh script
  // extracts it and normalizes bare host addresses to /32 or /128.
  // src: https://developer.amazon.com/amazonbot/ip-addresses/
  amazonbot: amazonbotRaw,
  // src: https://developer.amazon.com/amazonbot/searchbot-ip-addresses/
  "amzn-searchbot": amznSearchbotRaw,
  // src: https://developer.amazon.com/amazonbot/live-ip-addresses/
  "amzn-user": amznUserRaw,

  // Anthropic publishes one shared crawler-origin manifest. It confirms
  // Anthropic origin but does not attribute a prefix to ClaudeBot,
  // Claude-SearchBot, or Claude-User individually, so all three classifier
  // rules map to the same file and the UA remains the product discriminator.
  // src: https://claude.com/crawling/bots.json
  "anthropic-claudebot": anthropicRaw,
  "claude-searchbot": anthropicRaw,
  "claude-user": anthropicRaw,
  // Claude-Agent (Anthropic-hosted browsers) egresses from its own list,
  // published as a SAIL file the refresh script converts to this shape.
  // src: https://claude.com/.well-known/sail
  "claude-agent": claudeAgentRaw,
};

function manifestMetadata(raw: unknown): TrafficVerificationManifest | null {
  if (!isRecord(raw)) return null;
  const record = raw;
  const source =
    typeof record._source === "string" ? record._source.trim() : "";
  const version =
    typeof record.creationTime === "string" ? record.creationTime.trim() : "";
  if (!source || !version) return null;
  const contentHash = ipRangeManifestContentHash(raw);
  return { id: `${source}#${version}#sha256:${contentHash}`, source, version };
}

function verificationDataFromRaw(raw: unknown): VerificationData {
  const validation = validateIpRangeManifestPayload(raw);
  const ranges: ParsedCidr[] = [];
  if (validation.ok) {
    for (const entry of validation.value.prefixes) {
      const parsed = parseCidr(entry.ipv4Prefix ?? entry.ipv6Prefix);
      if (parsed) ranges.push(parsed);
    }
  }
  return { ranges, manifest: manifestMetadata(raw) };
}

function decideIpVerification(
  ip: string | null | undefined,
  data: VerificationData,
): IpVerificationDecision {
  // A manifest only CHECKED this request when there was both an address to
  // test and a parsed range set to test it against. Missing either means
  // nothing was consulted, so returning the manifest here would assert a check
  // that never ran — the same claim `backfill.ts` deliberately refuses to make
  // when it replays a sample whose IP was never retained. Returning null is
  // what makes the two outcomes below distinguishable: `manifest: X` means X
  // rejected this IP, `manifest: null` means no comparison happened at all.
  if (!ip || data.ranges.length === 0)
    return { verified: false, manifest: null };
  const parsed = parseIp(ip);
  if (!parsed) return { verified: false, manifest: null };
  for (const cidr of data.ranges) {
    if (parsed.version !== cidr.version) continue;
    if ((parsed.addr & cidr.mask) === cidr.network) {
      return { verified: true, manifest: data.manifest };
    }
  }
  return { verified: false, manifest: data.manifest };
}

/**
 * Parses every operator's prefixes into the BigInt form at module-load
 * time. Roughly 4,500 prefixes across all manifests today, parsed once per
 * process boot; a verification scans only the one mapped manifest (currently
 * at most ~1,100 prefixes). Could be O(log N) with a sorted-range search if
 * hot — not needed yet. The publisher
 * metadata is cached beside the ranges so every classification can retain
 * the exact vendored snapshot used without any runtime I/O.
 */
const CACHE: Map<string, VerificationData> = (() => {
  const cache = new Map<string, VerificationData>();
  for (const [ruleId, raw] of Object.entries(RULE_ID_TO_RANGES)) {
    cache.set(ruleId, verificationDataFromRaw(raw));
  }
  return cache;
})();

/**
 * Decide whether an IP falls in the published ranges for a crawler rule and
 * return the exact vendored manifest that was consulted, or null when none
 * was. Provenance is retained when the IP was actually compared against a
 * parsed range set — whether it matched or not — so callers can distinguish
 * "rejected by snapshot X" from "nothing checked this request". An absent or
 * malformed IP, a rule with no published ranges, and a manifest that failed
 * validation all yield `manifest: null`, because no comparison took place.
 * Resolved without runtime I/O.
 */
export function verifyIpForRuleDecision(
  ip: string | null | undefined,
  ruleId: string,
): IpVerificationDecision {
  const data = CACHE.get(ruleId);
  return data
    ? decideIpVerification(ip, data)
    : { verified: false, manifest: null };
}

/** Whether a rule id has any verification data available at all. */
export function hasVerificationDataFor(ruleId: string): boolean {
  const data = CACHE.get(ruleId);
  return !!data && data.ranges.length > 0;
}
