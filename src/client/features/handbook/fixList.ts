import { sort } from "remeda";
import { buildCsv } from "@/client/lib/csv";
import type {
  HandbookCategory,
  ReportJson,
} from "@/server/features/handbook/contracts/exports";
import { SEVERITY_LABELS } from "./labels";

/**
 * Fix List (B14 WO-B14-003, fork/NOVICE-UI.md §2): a run's findings as a
 * to-do list. Pure helpers; `FixList.tsx` renders them.
 */
export type Finding = ReportJson["findings"][number];
export type CategoryFilter = "all" | HandbookCategory;

const FIX_GROUPS = [
  { key: "must", severities: ["S1"] },
  { key: "should", severities: ["S2"] },
  { key: "nice", severities: ["S3", "S4"] },
] as const;

/** Scored findings plus the unscored additional ones (both are fixes). */
export function fixFindings(report: ReportJson): Finding[] {
  return [...report.findings, ...(report.additionalFindings ?? [])];
}

/**
 * Findings by priority group. Within a group: open rows first, then
 * deterministic before AI-judged, then most pages first; done rows sink.
 */
export function buildFixGroups(
  findings: Finding[],
  filter: CategoryFilter,
  done: ReadonlySet<string>,
) {
  const visible = findings.filter(
    (f) => filter === "all" || (f.categories ?? []).includes(filter),
  );
  return FIX_GROUPS.map((group) => ({
    key: group.key,
    label: SEVERITY_LABELS[group.severities[0]].label,
    help: SEVERITY_LABELS[group.severities[0]].help,
    findings: sort(
      visible.filter((f) =>
        (group.severities as readonly string[]).includes(f.severity),
      ),
      (a, b) =>
        Number(done.has(a.code)) - Number(done.has(b.code)) ||
        Number(a.source === "llm") - Number(b.source === "llm") ||
        b.urls.length - a.urls.length,
    ),
  }));
}

/** Checklist items the app could not check, with their reason. */
export function blockedItems(report: ReportJson) {
  return report.items.filter((i) => i.status === "BLOCKED");
}

const CSV_URL_LIMIT = 50;

/** CSV in priority order: one row per finding, up to 50 URLs per row. */
export function fixListCsv(findings: Finding[]): string {
  const rows = buildFixGroups(findings, "all", new Set()).flatMap((group) =>
    group.findings.map((f) => [
      group.label,
      (f.categories ?? []).join(" "),
      f.title,
      f.fix,
      f.urls.length,
      f.urls.slice(0, CSV_URL_LIMIT).join(" "),
    ]),
  );
  return buildCsv(
    ["priority", "categories", "title", "how_to_fix", "pages_count", "pages"],
    rows,
  );
}

/** Done checkboxes live in the browser only; storage failures are ignored. */
const doneKey = (runId: string) => `fork:fix-done:${runId}`;
type DoneStorage = Pick<Storage, "getItem" | "setItem">;

export function loadDone(runId: string, storage: DoneStorage): Set<string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(doneKey(runId)) ?? "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((c): c is string => typeof c === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function saveDone(
  runId: string,
  done: ReadonlySet<string>,
  storage: DoneStorage,
) {
  try {
    storage.setItem(doneKey(runId), JSON.stringify([...done]));
  } catch {
    // No persistence (private mode, quota): the checkbox still toggles.
  }
}

/**
 * Why the grade is provisional, or null: the runner notes "render
 * unavailable: <reason>" on BLOCKED items (WO-B4-006, WO-B13-007).
 */
export function provisionalReason(report: ReportJson): string | null {
  const note = report.items.find((i) =>
    i.note?.startsWith("render unavailable"),
  )?.note;
  if (!note) return null;
  return (
    note.replace(/^render unavailable:?\s*/, "").replace(/\.$/, "") ||
    "render unavailable"
  );
}
