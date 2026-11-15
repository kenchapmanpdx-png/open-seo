import { ITEM_SCORE } from "@/server/features/handbook/contracts/scoring";
import type { ItemStatus } from "@/server/features/handbook/contracts/status";
import type { Intake } from "./intake";
import type { ItemStatusRow, PendingResult } from "./runner";

const row = (
  itemId: string,
  status: ItemStatus,
  note: string,
): ItemStatusRow => ({
  itemId,
  status,
  score: ITEM_SCORE[status],
  note,
  checkIds: ["runner.process"],
});

const list = (xs: readonly ItemStatusRow[]) =>
  `${xs
    .slice(0, 12)
    .map((r) => r.itemId)
    .join(", ")}${xs.length > 12 ? ` (+${xs.length - 12})` : ""}`;

/** Items the runner decides itself; they carry no finding of their own. */
const PROCESS_ITEMS = new Set(["P0-01", "P1-03", "P1-04", "RV-01", "RV-02"]);
const ANSWERED = new Set<ItemStatus>([
  "PASS",
  "OPEN",
  "PARTIAL",
  "BLOCKED",
  "NA",
  "LIMITED",
]);

/**
 * WO-B4-006 process items (S4, never cap the grade). P1-03: every OPEN /
 * PARTIAL item has a finding (findings citing stored evidence is enforced in
 * `materialize`). RV-01: every REVIEW item in scope is answered (PASS /
 * finding / BLOCKED / NA / LIMITED; DEFERRED is not an answer). P0-01 and
 * RV-02 are confirmed when the exports render (`buildReportJson`).
 */
export function processVerdicts(
  rows: ItemStatusRow[],
  pending: readonly PendingResult[],
  intake: Intake,
): ItemStatusRow[] {
  const cited = new Set(
    pending.flatMap((p) => p.result.findings.flatMap((f) => f.itemIds)),
  );
  const scoped = rows.filter(
    (r) => intake.applicable.has(r.itemId) && !PROCESS_ITEMS.has(r.itemId),
  );
  const orphans = scoped.filter(
    (r) =>
      (r.status === "OPEN" || r.status === "PARTIAL") && !cited.has(r.itemId),
  );
  const unanswered = scoped.filter((r) => !ANSWERED.has(r.status));
  const verdict: Record<string, ItemStatusRow> = {
    "P1-03": row(
      "P1-03",
      orphans.length > 0 ? "OPEN" : "PASS",
      orphans.length > 0
        ? `OPEN/PARTIAL items without a finding: ${list(orphans)}`
        : `${scoped.filter((r) => r.status === "OPEN" || r.status === "PARTIAL").length} OPEN/PARTIAL items, each with ≥ 1 finding; every finding cites stored evidence`,
    ),
    "RV-01": row(
      "RV-01",
      unanswered.length > 0 ? "OPEN" : "PASS",
      unanswered.length > 0
        ? `${unanswered.length} of ${scoped.length} items not answered (DEFERRED): ${list(unanswered)}; no ranking, traffic or backlink data used`
        : `all ${scoped.length} items answered; no ranking, traffic or backlink data used`,
    ),
  };
  return rows.map((r) =>
    intake.applicable.has(r.itemId) && verdict[r.itemId]
      ? verdict[r.itemId]
      : r,
  );
}
