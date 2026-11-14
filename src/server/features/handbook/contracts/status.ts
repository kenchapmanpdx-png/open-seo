import { z } from "zod";

/**
 * Item status model (ADR-005). PASS = handbook DONE / EP-7 PASS. PARTIAL and
 * LIMITED score 0.5; BLOCKED, NA and DEFERRED are excluded from scoring.
 */
export const ITEM_STATUSES = [
  "PASS",
  "PARTIAL",
  "OPEN",
  "BLOCKED",
  "NA",
  "LIMITED",
  "DEFERRED",
] as const;
export const itemStatusSchema = z.enum(ITEM_STATUSES);
export type ItemStatus = z.infer<typeof itemStatusSchema>;

/** When several checks cover one item, the highest-ranked verdict wins. */
export const ITEM_STATUS_PRECEDENCE: readonly ItemStatus[] = [
  "OPEN",
  "PARTIAL",
  "LIMITED",
  "PASS",
  "BLOCKED",
  "DEFERRED",
  "NA",
];

export const HANDBOOK_MODES = ["BUILD", "AUDIT", "MAINTAIN", "REVIEW"] as const;
export const handbookModeSchema = z.enum(HANDBOOK_MODES);
export type HandbookMode = z.infer<typeof handbookModeSchema>;

export const SITE_TIERS = ["T1", "T2", "T3", "T4"] as const;
export const siteTierSchema = z.enum(SITE_TIERS);
export type SiteTier = z.infer<typeof siteTierSchema>;

export const FIXABILITY = ["FIXABLE", "LIMITED"] as const;
export type Fixability = (typeof FIXABILITY)[number];

export const EFFORTS = ["S", "M", "L"] as const;
export type Effort = (typeof EFFORTS)[number];

export const RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const SP_CODES = [
  "SP1",
  "SP2",
  "SP3",
  "SP4",
  "SP5",
  "SP6",
  "SP7",
  "SP8",
  "SP9",
  "SP10",
  "SP11",
  "SP12",
] as const;
export type SpCode = (typeof SP_CODES)[number];

/** Site Profile answer: `?` = insufficient evidence (handbook UNKNOWN rule). */
export type SpValue = "Y" | "N" | "?";
export type Confidence = "high" | "medium" | "low";

export type SiteProfileAnswer = {
  code: SpCode;
  value: SpValue;
  evidence: string;
  confidence: Confidence;
};
