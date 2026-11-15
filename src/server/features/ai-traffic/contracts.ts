import { z } from "zod";

/**
 * K9 — AI traffic (ADR-013). Vercel drain payload → stored event → class.
 * Field shapes follow Canonry `normalizedTrafficRequestSchema`
 * (MIT, © 2026 Arber X and contributors), reduced to what the fork stores.
 */

// One Vercel log-drain entry. Loose: Vercel sends many more fields.
export const vercelDrainEntrySchema = z.looseObject({
  id: z.string().min(1),
  timestamp: z.number(),
  projectId: z.string().min(1),
  source: z.string(),
  host: z.string().nullish(),
  proxy: z
    .looseObject({
      timestamp: z.number().nullish(),
      method: z.string().nullish(),
      host: z.string().nullish(),
      path: z.string().nullish(),
      userAgent: z.array(z.string()).nullish(),
      referer: z.string().nullish(),
      statusCode: z.number().int().nullish(),
      clientIp: z.string().nullish(),
    })
    .nullish(),
});

// Drain sources that represent an HTTP request; build/firewall lines are dropped.
export const DRAIN_REQUEST_SOURCES = [
  "static",
  "lambda",
  "edge",
  "external",
  "redirect",
] as const;

export const trafficEventSchema = z.object({
  eventId: z.string().min(1),
  observedAt: z.string().min(1),
  method: z.string().nullable(),
  host: z.string().nullable(),
  path: z.string().min(1),
  queryString: z.string().nullable(),
  status: z.number().int().nullable(),
  userAgent: z.string().nullable(),
  remoteIp: z.string().nullable(),
  referer: z.string().nullable(),
  sourceType: z.literal("vercel-drain"),
});
export type TrafficEvent = z.infer<typeof trafficEventSchema>;

export const TRAFFIC_CLASS_KINDS = [
  "crawler",
  "user_fetch",
  "referral",
  "self",
  "none",
] as const;

export const CRAWLER_VERIFICATION = [
  "verified",
  "claimed_unverified",
  "unknown_ai_like",
] as const;

export const trafficClassSchema = z.object({
  kind: z.enum(TRAFFIC_CLASS_KINDS),
  ruleId: z.string().nullable(),
  operator: z.string().nullable(),
  product: z.string().nullable(),
  purpose: z.string().nullable(),
  verification: z.enum(CRAWLER_VERIFICATION).nullable(),
  evidenceType: z.enum(["referer", "utm", "referer-utm"]).nullable(),
  rulesVersion: z.string().min(1),
});
export type TrafficClass = z.infer<typeof trafficClassSchema>;

const countRow = z.looseObject({
  operator: z.string(),
  product: z.string(),
  purpose: z.string().nullable(),
  verification: z.enum(CRAWLER_VERIFICATION).nullable(),
  hits: z.number().int().nonnegative(),
});

// UI + MCP `ai_traffic_summary` output. Loose for MCP forward-compat (K8 rule).
export const aiTrafficSummarySchema = z.looseObject({
  projectId: z.string(),
  from: z.string(),
  to: z.string(),
  crawlers: z.array(countRow),
  userFetches: z.array(countRow),
  referrals: z.array(countRow),
  topPaths: z.array(
    z.looseObject({ path: z.string(), hits: z.number().int().nonnegative() }),
  ),
  discarded: z.number().int().nonnegative(),
});
