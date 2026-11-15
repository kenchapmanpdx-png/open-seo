import { z } from "zod";

/** K10 — Bing Webmaster Tools + AI Performance import (ADR-014). */

export const bingSiteBindingSchema = z.object({
  projectId: z.string().min(1),
  // Exactly as BWT `GetUserSites` lists it; chosen from that list, never typed.
  siteUrl: z.string().url(),
});

// One row of a BWT AI Performance CSV export. Header names are mapped by the
// importer; the fixture from the first real export pins them.
export const bingAiPerformanceRowSchema = z.object({
  date: z.iso.date().nullable(),
  query: z.string().min(1).nullable(),
  page: z.string().url().nullable(),
  citations: z.number().int().nonnegative(),
});
export type BingAiPerformanceRow = z.infer<typeof bingAiPerformanceRowSchema>;

// UI + MCP `bing_summary` output.
export const bingSummarySchema = z.looseObject({
  projectId: z.string(),
  siteUrl: z.string().nullable(),
  verified: z.boolean().nullable(),
  lastSyncAt: z.string().nullable(),
  lastError: z.string().nullable(),
  clicks28d: z.number().int().nullable(),
  impressions28d: z.number().int().nullable(),
  blockingCrawlIssues: z.number().int().nonnegative(),
  aiCitations28d: z.number().int().nullable(),
  aiLastImportAt: z.string().nullable(),
});
