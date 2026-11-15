import { z } from "zod";

/** K13 — Agency layer: white-label brand, client record, outcome record (ADR-017). */

export const agencyBrandSchema = z.object({
  agencyName: z.string().trim().min(1).max(120),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  contactLine: z.string().max(200).nullable(),
  footerText: z.string().max(400).nullable(),
  hideOpenseoCredit: z.boolean(),
});
export type AgencyBrand = z.infer<typeof agencyBrandSchema>;

export const REPORT_CADENCES = ["none", "monthly", "quarterly"] as const;

export const agencyClientSchema = z.object({
  projectId: z.string().min(1),
  clientName: z.string().trim().min(1).max(200),
  contactName: z.string().max(200).nullable(),
  contactEmail: z.email().nullable(),
  reportCadence: z.enum(REPORT_CADENCES),
  notes: z.string().max(4000).nullable(),
});

// Handbook P11: outcome record at +4 and +12 weeks after a fix batch.
export const OUTCOME_OFFSETS_WEEKS = [4, 12] as const;

export const OUTCOME_CHECK_STATUSES = [
  "scheduled",
  "done",
  "skipped",
  "failed",
] as const;
export const outcomeCheckStatusSchema = z.enum(OUTCOME_CHECK_STATUSES);

export const OUTCOME_METRICS = [
  "handbook_status",
  "index_state",
  "gsc_impressions_28d",
  "gsc_clicks_28d",
  "bing_clicks_28d",
  "ai_referrals_28d",
  "ai_crawler_hits_verified_28d",
  "ai_answer_mentions",
] as const;

export const outcomeMetricSchema = z.object({
  url: z.string().url(),
  itemId: z.string().min(1),
  metric: z.enum(OUTCOME_METRICS),
  // Strings so status words and numbers share a column; null = BLOCKED source.
  before: z.string().nullable(),
  after: z.string().nullable(),
  source: z.string().min(1),
  evidencePath: z.string().nullable(),
});
export type OutcomeMetric = z.infer<typeof outcomeMetricSchema>;
