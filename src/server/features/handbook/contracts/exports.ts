import { z } from "zod";
import { severitySchema } from "./registry-types";
import {
  handbookModeSchema,
  itemStatusSchema,
  siteTierSchema,
  SP_CODES,
} from "./status";

/**
 * K7 — Exports. `reportJsonSchema` is the machine-readable report (also the
 * input to the client report and the Vercel snapshot). The status.md template
 * follows handbook EP-5 `seo-geo-status.md`; REVIEW mode renders the EP-7
 * report layout instead.
 */

export const REPORT_JSON_VERSION = "1";

export const reportJsonSchema = z.object({
  reportVersion: z.literal(REPORT_JSON_VERSION),
  contractsVersion: z.string(),
  handbookVersion: z.string(),
  generatedAt: z.string(),
  site: z.object({ origin: z.string().url(), platform: z.string().nullable() }),
  run: z.object({
    id: z.string(),
    mode: handbookModeSchema,
    tier: siteTierSchema,
    tierEvidence: z.string(),
    startedAt: z.string(),
    finishedAt: z.string().nullable(),
  }),
  score: z
    .object({
      final: z.number(),
      uncapped: z.number(),
      grade: z.enum(["A", "B", "C", "D", "F"]),
      capReason: z.string().nullable(),
      phases: z.array(
        z.object({
          phase: z.string(),
          weight: z.number(),
          score: z.number().nullable(),
          driver: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
  siteProfile: z.array(
    z.object({
      code: z.enum(SP_CODES),
      value: z.enum(["Y", "N", "?"]),
      evidence: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  ),
  findings: z.array(
    z.object({
      code: z.string().regex(/^F\d{2,3}$/),
      severity: severitySchema,
      phase: z.string(),
      sectionRef: z.string(),
      title: z.string(),
      detail: z.string(),
      fix: z.string(),
      fixability: z.enum(["FIXABLE", "LIMITED"]),
      limitedReason: z.string().nullable(),
      effort: z.enum(["S", "M", "L"]),
      source: z.enum(["deterministic", "llm"]),
      itemIds: z.array(z.string()),
      urls: z.array(z.string()),
      evidence: z.array(
        z.object({ kind: z.string(), url: z.string(), excerpt: z.string() }),
      ),
    }),
  ),
  items: z.array(
    z.object({
      itemId: z.string(),
      phase: z.string(),
      status: itemStatusSchema,
      note: z.string().nullable(),
      findingCodes: z.array(z.string()),
    }),
  ),
  release: z.object({
    status: z.enum(["CLEAR", "RELEASE_BLOCKED", "NOT_APPLICABLE"]),
    blockingItemIds: z.array(z.string()),
  }),
  checkerErrors: z.array(z.string()),
  outsideScope: z.array(z.string()),
});
export type ReportJson = z.infer<typeof reportJsonSchema>;

/** Section order of the exported `seo-geo-status.md` (handbook EP-5). */
export const STATUS_MD_SECTIONS = [
  "Site Profile",
  "Decisions",
  "Phase gates",
  "Release",
  "Checklist (§41 copy)",
  "Blocked / owner needed",
  "Deferred (trigger)",
] as const;

/** Section order of the REVIEW-mode report (handbook EP-7). */
export const REVIEW_REPORT_SECTIONS = [
  "Header",
  "Grade",
  "Site Profile",
  "Top fixes",
  "Findings by severity",
  "Passes",
  "Limited (platform)",
  "Blocked (owner access)",
  "Outside scope — noted",
  "Checker errors",
  "Residual weaknesses",
] as const;

export type StatusMdRenderer = (report: ReportJson) => string;
