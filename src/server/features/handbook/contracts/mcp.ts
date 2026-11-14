import { z } from "zod";
import { severitySchema } from "./registry-types";
import { handbookModeSchema, itemStatusSchema } from "./status";

/**
 * K8 — MCP tool schemas. Registered beside upstream tools in B4; handlers
 * authorize with `withMcpProjectAuth` (tenant scoping invariant).
 */

export const HANDBOOK_MCP_TOOL_NAMES = [
  "handbook_audit_run",
  "handbook_findings_get",
  "handbook_status_export",
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

export const handbookAuditRunOutput = z.object({
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

export const handbookFindingsGetOutput = z.object({
  runId: z.string(),
  handbookVersion: z.string(),
  grade: z.string().nullable(),
  score: z.number().nullable(),
  findings: z.array(
    z.object({
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
});

export const handbookStatusExportInput = {
  projectId,
  runId,
  format: z.enum(["status-md", "report-json"]).default("status-md"),
};

export const handbookStatusExportOutput = z.object({
  runId: z.string(),
  format: z.enum(["status-md", "report-json"]),
  content: z.string(),
});
