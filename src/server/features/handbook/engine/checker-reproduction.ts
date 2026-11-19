import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { EvidenceDraft } from "@/server/features/handbook/contracts/check";
import type { ItemStatus } from "@/server/features/handbook/contracts/status";
import { normalizeUrl } from "../checks/support";
import type { PendingResult } from "./runner";

/** Evidence that comes from a third-party checker rather than a direct fetch. */
const CHECKER_KINDS = new Set<EvidenceDraft["kind"]>([
  "lighthouse",
  "axe",
  "crux",
]);

/**
 * P1-04 (handbook §0 "Checkers are evidence, not findings"): every finding
 * that rests only on checker output (Lighthouse, axe, CrUX) must cite URLs the
 * crawler fetched directly; collector and check errors are logged in
 * `checkerErrors` and listed in the report.
 */
export function checkerReproduction(
  collected: CollectedData,
  pending: readonly PendingResult[],
  checkerErrors: readonly string[],
): { status: ItemStatus; note: string } {
  const pages = collected.pages;
  if (pages.status !== "ok")
    return { status: "BLOCKED", note: "pages unavailable: no direct fetches" };
  const fetched = new Set(pages.snapshots.map((s) => normalizeUrl(s.url)));
  let checkerOnly = 0;
  const unreproduced = new Set<string>();
  for (const { result } of pending) {
    const kindOf = new Map(result.evidence.map((e) => [e.ref, e.kind]));
    for (const finding of result.findings) {
      const kinds = finding.evidenceRefs.map((ref) => kindOf.get(ref));
      if (kinds.length === 0 || !kinds.every((k) => k && CHECKER_KINDS.has(k)))
        continue;
      checkerOnly += 1;
      for (const url of finding.urls)
        if (!fetched.has(normalizeUrl(url))) unreproduced.add(url);
    }
  }
  const errors = `${checkerErrors.length} checker error(s) logged`;
  if (unreproduced.size > 0)
    return {
      status: "OPEN",
      note: `checker-only findings cite URLs never fetched directly: ${[...unreproduced].slice(0, 5).join(", ")}; ${errors}`,
    };
  return {
    status: "PASS",
    note: `${checkerOnly} checker-only finding(s), every URL also fetched directly; ${errors}`,
  };
}
