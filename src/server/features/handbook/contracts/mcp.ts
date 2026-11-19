import { z } from "zod";
import { severitySchema } from "./registry-types";
import { handbookModeSchema, itemStatusSchema } from "./status";

/**
 * K8 — MCP tool schemas. Registered beside upstream tools in B4; handlers
 * authorize with `withMcpProjectAuth` (tenant scoping invariant). Outputs are
 * loose objects (1.3.0): published MCP outputs must accept added fields.
 */

export const HANDBOOK_MCP_TOOL_NAMES = [
  "handbook_audit_run",
  "handbook_findings_get",
  "handbook_status_export",
  "handbook_copy_rules_get",
] as const;

const projectId = z.string().min(1).describe("OpenSEO project ID.");
const runId = z
  .string()
  .optional()
  .describe("Handbook run ID. If omitted, uses the project's latest run.");

export const handbookAuditRunInput = {
  projectId,
  mode: handbookModeSchema
    .optional()
    .describe("Handbook mode; defaults to the project's setting."),
  maxPages: z.number().int().min(1).max(500).optional(),
};

export const handbookAuditRunOutput = z.looseObject({
  runId: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  dashboardUrl: z.string(),
});

export const handbookFindingsGetInput = {
  projectId,
  runId,
  severity: z.array(severitySchema).optional(),
  status: z.array(itemStatusSchema).optional(),
  limit: z.number().int().min(1).max(200).default(50),
};

export const handbookFindingsGetOutput = z.looseObject({
  runId: z.string(),
  handbookVersion: z.string(),
  grade: z.string().nullable(),
  score: z.number().nullable(),
  findings: z.array(
    z.looseObject({
      code: z.string(),
      severity: severitySchema,
      title: z.string(),
      itemIds: z.array(z.string()),
      urls: z.array(z.string()),
      fix: z.string(),
      fixability: z.enum(["FIXABLE", "LIMITED"]),
    }),
  ),
  truncated: z.boolean(),
  /**
   * Present when ≥ 1 returned finding is in phase P5 or cites SUPP-17 /
   * SUPP-18: load the copy rules before rewriting page copy (ADR-024). 1.7.0
   */
  copyRules: z
    .looseObject({
      tool: z.literal("handbook_copy_rules_get"),
      version: z.string(),
    })
    .optional(),
});

export const handbookStatusExportInput = {
  projectId,
  runId,
  format: z.enum(["status-md", "report-json"]).default("status-md"),
};

export const handbookStatusExportOutput = z.looseObject({
  runId: z.string(),
  format: z.enum(["status-md", "report-json"]),
  content: z.string(),
});

/** Copy rules pack (fork/skills/copy-rules, ADR-024); read-only. 1.7.0 */
export const handbookCopyRulesGetInput = {};

export const handbookCopyRulesGetOutput = z.looseObject({
  version: z.string(),
  text: z.string(),
});
