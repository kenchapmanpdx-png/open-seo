// Page-cap notes for the runs list and run page (B13 WO-B13-014, E27).
// Handbook reads pages on its own and stops at its own limit; the linked
// site audit has a separate `maxPages`. Each note says which limit applied.
import { parseAuditConfig } from "@/server/lib/audit/types";

type CapRun = { coverageCapped: boolean; coverageRead: number | null };
type CapAudit = { pagesCrawled: number; config: string } | null;

export function capNotes(run: CapRun, audit: CapAudit): string[] {
  const read = run.coverageRead ?? 0;
  const notes: string[] = [];
  if (run.coverageCapped) {
    notes.push(
      `Handbook stopped at its page or time limit: ${read} pages read; results are incomplete.`,
    );
  }
  const maxPages = audit ? parseAuditConfig(audit.config)?.maxPages : null;
  if (audit && maxPages && audit.pagesCrawled >= maxPages) {
    notes.push(
      `Site audit stopped at its ${maxPages}-page limit (Handbook read ${read} pages on its own).`,
    );
  }
  return notes;
}
