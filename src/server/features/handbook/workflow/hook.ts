import type { WorkflowStep } from "cloudflare:workers";
import { pgStep } from "@/server/workflows/pgStep";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";

/**
 * One-line hook target in `runAuditPhases` (ADR-001). Flag off → one cheap
 * step and return, without importing the engine. A handbook failure is
 * logged and swallowed: it never fails the upstream audit.
 */
export async function runHandbookPhase(
  step: WorkflowStep,
  params: { auditId: string; projectId: string; startUrl: string },
) {
  try {
    const setting = await pgStep(
      step,
      "handbook-setting-v1",
      undefined,
      async () => {
        const row = await HandbookRepository.getProjectSetting(
          params.projectId,
        );
        return row?.enabled
          ? { mode: row.mode, tierOverride: row.tierOverride }
          : null;
      },
    );
    if (!setting) return;
    await pgStep(
      step,
      "handbook-run-v1",
      { retries: { limit: 1, delay: "30 seconds" }, timeout: "30 minutes" },
      async () => {
        const { HandbookService } =
          await import("@/server/features/handbook/services/HandbookService");
        const seedUrls = await HandbookService.listCrawledUrls(params.auditId);
        return HandbookService.executeRun({
          // Deterministic per audit: a step retry reuses the same run row.
          runId: `hb-${params.auditId}`,
          projectId: params.projectId,
          auditId: params.auditId,
          origin: new URL(params.startUrl).origin,
          seedUrls,
          mode: setting.mode,
          tierOverride: setting.tierOverride,
        });
      },
    );
  } catch (error) {
    console.error("handbook.phase.failed", {
      auditId: params.auditId,
      error: String(error),
    });
  }
}
