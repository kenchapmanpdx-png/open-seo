import type {
  CheckResult,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import { SUPP_BY_ID } from "../registry-supp";
import { ACCESS_S1, PAGE_SCOPED_S1 } from "./s1-scope";

/** Runner-enforced K1 invariants on one check result; the first violation, or null. */
export function contractViolation(
  check: HandbookCheck,
  result: CheckResult,
  registry: ReadonlyMap<string, RegistryEntry>,
): string | null {
  const refs = new Set(result.evidence.map((e) => e.ref));
  const owned = new Set(check.itemIds);
  for (const v of result.statuses) {
    if (!owned.has(v.itemId)) return `verdict for foreign item ${v.itemId}`;
    if (v.status === "PASS" && !v.evidenceRefs.some((r) => refs.has(r))) {
      return `PASS on ${v.itemId} without evidence`;
    }
  }
  for (const f of result.findings) {
    if (f.itemIds.length === 0 || f.itemIds.some((id) => !owned.has(id))) {
      return `finding "${f.title}" cites items outside the check`;
    }
    if (!f.evidenceRefs.some((r) => refs.has(r)))
      return `finding "${f.title}" without evidence`;
    const id = f.itemIds[0] ?? "";
    const primary = registry.get(id) ?? SUPP_BY_ID.get(id);
    if (
      primary &&
      f.severity !== primary.severityDefault &&
      !f.severityReason
    ) {
      return `finding "${f.title}" changes severity without a reason`;
    }
    // WO-B20-015 (d): every S1 has its condition in the ADR-034 table.
    if (f.severity === "S1" && !PAGE_SCOPED_S1.has(id) && !ACCESS_S1.has(id))
      return `S1 finding "${f.title}" on ${id} has no ADR-034 S1 entry`;
    if (f.fixability === "LIMITED" && !f.limitedReason) {
      return `LIMITED finding "${f.title}" without limitedReason`;
    }
  }
  return null;
}
