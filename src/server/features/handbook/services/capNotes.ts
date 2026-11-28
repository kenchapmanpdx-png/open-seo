// Page-cap and scope notes for the runs list and run page (B13 WO-B13-014,
// E27; B18 WO-B18-015).
// Handbook reads pages on its own and stops at its own limit; the linked
// site audit has a separate `maxPages`. Each note says which limit applied.
import { parseAuditConfig } from "@/server/lib/audit/types";
import { scopeLines } from "@/server/features/handbook/engine/depth";
import type { CrawlScope } from "@/server/features/handbook/contracts/exports";

type CapRun = { coverageCapped: boolean; coverageRead: number | null };
type CapAudit = { pagesCrawled: number; config: string } | null;

const SHORT_NAME_NOTE =
  "This site refuses the app's full crawler name; pages were read with the short name OpenSEO-Handbook/1.0.";

export function capNotes(
  run: CapRun,
  audit: CapAudit,
  /** The run report's coverage, when it is loaded (run page). */
  coverage?: { shortName?: true; scope?: CrawlScope },
): string[] {
  const read = run.coverageRead ?? 0;
  const notes: string[] = [];
  // WO-B27-001: one info line, no severity, no score effect.
  if (coverage?.shortName) notes.push(SHORT_NAME_NOTE);
  // WO-B27-003 / 004: runs that stored their scope quote its one limit.
  if (coverage?.scope)
    return [
      ...notes,
      ...scopeLines(coverage.scope, { read, capped: run.coverageCapped }),
    ];
  if (run.coverageCapped) {
    notes.push(
      `Handbook stopped at its page or time limit: ${read} pages read; results are incomplete.`,
    );
  }
  const config = audit ? parseAuditConfig(audit.config) : null;
  const maxPages = config?.maxPages;
  if (audit && maxPages && audit.pagesCrawled >= maxPages) {
    notes.push(
      `Site audit stopped at its ${maxPages}-page limit (Handbook read ${read} pages).`,
    );
  }
  // Scope the user chose on Check a site (B18 WO-B18-015).
  if (config?.excludePaths?.length) {
    notes.push(`Sections left out: ${config.excludePaths.join(", ")}.`);
  }
  return notes;
}
