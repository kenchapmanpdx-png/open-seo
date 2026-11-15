// Ported from Canonry/canonry@4b91e077 packages/integration-bing/src/types.ts — MIT, © 2026 Arber X and contributors
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software, subject to the MIT License (https://opensource.org/license/mit).
// Fork changes: only the shapes the kept read methods use (ADR-014 §1); each is a
// Zod schema so responses are validated at the boundary (AGENTS.md). Loose objects
// keep Bing's extra fields (`__type`) without failing.
import { z } from "zod";

/** Bing dates are WCF JSON dates (`/Date(ms)/`); `parseBingDate` turns them into ISO. */
const wcfDate = z.string();
const optionalDate = wcfDate.nullish();

export const bingSiteSchema = z.looseObject({
  Url: z.string(),
  // Live `GetUserSites` field; Canonry's older `Verified` was always undefined.
  IsVerified: z.boolean().optional(),
});
export type BingSite = z.infer<typeof bingSiteSchema>;

export const bingUrlInfoSchema = z.looseObject({
  Url: z.string(),
  DocumentSize: z.number().optional(),
  AnchorCount: z.number().optional(),
  DiscoveryDate: optionalDate,
  LastCrawledDate: optionalDate,
  IsPage: z.boolean().optional(),
  HttpStatus: z.number().optional(),
  TotalChildUrlCount: z.number().optional(),
  HttpCode: z.number().optional(),
  InIndexDate: optionalDate,
  CacheDate: optionalDate,
});
export type BingUrlInfo = z.infer<typeof bingUrlInfoSchema>;

/**
 * One row of `GetQueryStats` / `GetPageStats`. `Query` holds the search query for
 * query stats and the PAGE URL for page stats. `Date` is a weekly bucket.
 * `AvgClickPosition` is `-1` when the row had no clicks.
 */
export const bingQueryStatsSchema = z.looseObject({
  Query: z.string(),
  Date: wcfDate,
  Impressions: z.number(),
  Clicks: z.number(),
  AvgClickPosition: z.number(),
  AvgImpressionPosition: z.number(),
});
export type BingQueryStats = z.infer<typeof bingQueryStatsSchema>;

/** `GetRankAndTrafficStats`: one row per DAY. */
export const bingRankAndTrafficStatsSchema = z.looseObject({
  Date: wcfDate,
  Clicks: z.number(),
  Impressions: z.number(),
});
export type BingRankAndTrafficStats = z.infer<
  typeof bingRankAndTrafficStatsSchema
>;

/** `GetCrawlStats`: one row per day. */
export const bingCrawlStatsSchema = z.looseObject({
  Date: wcfDate,
  CrawledPages: z.number(),
  InIndex: z.number(),
  CrawlErrors: z.number(),
  InLinks: z.number().optional(),
  Code2xx: z.number().optional(),
  Code301: z.number().optional(),
  Code302: z.number().optional(),
  Code4xx: z.number().optional(),
  Code5xx: z.number().optional(),
  AllOtherCodes: z.number().optional(),
  BlockedByRobotsTxt: z.number().optional(),
  ConnectionTimeout: z.number().optional(),
  ContainsMalware: z.number().optional(),
  DnsFailures: z.number().optional(),
});
export type BingCrawlStats = z.infer<typeof bingCrawlStatsSchema>;

/**
 * `GetCrawlIssues` (`UrlWithCrawlIssues`). Every live capture returned an empty
 * list, so `IssueType` / `Date` stay as the legacy fallbacks.
 */
export const bingCrawlIssueSchema = z.looseObject({
  Url: z.string(),
  HttpCode: z.number(),
  InLinks: z.number().optional(),
  Issues: z.union([z.number(), z.string()]).optional(),
  Date: optionalDate,
  IssueType: z.string().optional(),
});
export type BingCrawlIssue = z.infer<typeof bingCrawlIssueSchema>;

/** `GetFeeds`: a submitted sitemap, sitemap index or feed. */
export const bingFeedSchema = z.looseObject({
  Url: z.string(),
  Type: z.string(),
  Status: z.string(),
  UrlCount: z.number(),
  FileSize: z.number(),
  Compressed: z.boolean(),
  Submitted: optionalDate,
  LastCrawled: optionalDate,
});
export type BingFeed = z.infer<typeof bingFeedSchema>;

/** `GetUrlSubmissionQuota`. Both figures are what is LEFT today / this month. */
export const bingSubmissionQuotaSchema = z.looseObject({
  DailyQuota: z.number(),
  MonthlyQuota: z.number(),
});
export type BingSubmissionQuota = z.infer<typeof bingSubmissionQuotaSchema>;

/** `GetBlockedUrls`. `EntityType` 0 = page, 1 = directory; `RequestType` 0 = cache only, 1 = full removal. */
export const bingBlockedUrlSchema = z.looseObject({
  Url: z.string(),
  Date: optionalDate,
  DaysToExpire: z.number().optional(),
  EntityType: z.number().optional(),
  RequestType: z.number().optional(),
});
export type BingBlockedUrl = z.infer<typeof bingBlockedUrlSchema>;

/**
 * Bing error codes that mean "you are going too fast". Bing answers a throttle
 * with HTTP 400 and `{"ErrorCode":5,"Message":"ERROR!!! ThrottleHost"}`
 * (5 = per host, 4 = per API key).
 */
const BING_THROTTLE_ERROR_CODES = new Set([4, 5]);

export class BingApiError extends Error {
  status: number;
  /** Bing's own `ErrorCode` from the response body, when it sent one. */
  bingErrorCode: number | null;
  isThrottle: boolean;
  /** Raw `Retry-After` header; never any other response header. */
  retryAfter: string | null;
  /** Retries the client made before giving up; zero when refused locally. */
  retryCount = 0;

  constructor(
    message: string,
    status: number,
    bingErrorCode: number | null = null,
    retryAfter: string | null = null,
  ) {
    super(message);
    this.name = "BingApiError";
    this.status = status;
    this.bingErrorCode = bingErrorCode;
    this.retryAfter = retryAfter;
    this.isThrottle =
      status === 429 ||
      (bingErrorCode != null && BING_THROTTLE_ERROR_CODES.has(bingErrorCode));
  }
}
