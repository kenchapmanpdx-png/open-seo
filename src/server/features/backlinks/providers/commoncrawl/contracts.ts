import { z } from "zod";

/**
 * K12 — Common Crawl domain-graph backlink baseline (ADR-016). Release-id
 * shape from Canonry `integration-commoncrawl/src/constants.ts`
 * (MIT, © 2026 Arber X and contributors).
 */

const CC_MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";
export const ccReleaseIdSchema = z
  .string()
  .regex(
    new RegExp(`^cc-main-(\\d{4})-(${CC_MONTH}-${CC_MONTH}-${CC_MONTH})$`),
  );

export const ccBacklinkRowSchema = z.object({
  targetDomain: z.string().min(1),
  linkingDomain: z.string().min(1),
  numHosts: z.number().int().nonnegative(),
});
export type CcBacklinkRow = z.infer<typeof ccBacklinkRowSchema>;

// UI + MCP `cc_backlinks_get` output.
export const ccBacklinkSummarySchema = z.looseObject({
  projectId: z.string(),
  domain: z.string(),
  releaseId: ccReleaseIdSchema.nullable(),
  previousReleaseId: ccReleaseIdSchema.nullable(),
  referringDomains: z.number().int().nonnegative(),
  newDomains: z.number().int().nonnegative(),
  lostDomains: z.number().int().nonnegative(),
  topLinkingDomains: z.array(
    z.looseObject({ domain: z.string(), numHosts: z.number().int() }),
  ),
});
