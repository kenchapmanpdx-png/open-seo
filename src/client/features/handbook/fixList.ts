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
  return FIX_GROUPS.map((group) => {
    const sorted = sort(
      visible.filter((f) =>
        (group.severities as readonly string[]).includes(f.severity),
      ),
      (a, b) =>
        Number(done.has(a.code)) - Number(done.has(b.code)) ||
        Number(a.source === "llm") - Number(b.source === "llm") ||
        b.urls.length - a.urls.length,
    );
    // WO-B22-001: S3 / S4 findings with no stated search or AI effect fold
    // into a collapsed "Housekeeping" section; S1 / S2 never fold.
    const folds = (f: Finding) =>
      group.key === "nice" && f.effect === "hygiene";
    return {
      key: group.key,
      label: SEVERITY_LABELS[group.severities[0]].label,
      help: SEVERITY_LABELS[group.severities[0]].help,
      /** One per finding: the CSV and the counts behind the grade. */
      findings: sorted,
      /** What the list shows: same-title findings as one row (WO-B16-004). */
      rows: mergeSameTitle(
        sorted.filter((f) => !folds(f)),
        done,
      ),
      /** Folded rows, shown collapsed under the group. */
      housekeeping: mergeSameTitle(sorted.filter(folds), done),
    };
  });
}

/**
 * Same-title findings in one priority group shown as one row (B16 WO-B16-004,
 * ADR-030 §6): display only, every finding stays a sub-row with its own done
 * state. A row is done when all its findings are; done rows sink.
 */
export type FixRow = { title: string; findings: Finding[]; done: boolean };

function mergeSameTitle(
  findings: Finding[],
  done: ReadonlySet<string>,
): FixRow[] {
  const byTitle = new Map<string, Finding[]>();
  for (const f of findings) {
    const members = byTitle.get(f.title);
    if (members) members.push(f);
    else byTitle.set(f.title, [f]);
  }
  const rows = [...byTitle].map(([title, members]) => ({
    title,
    findings: members,
    done: members.every((f) => done.has(f.code)),
  }));
  return sort(rows, (a, b) => Number(a.done) - Number(b.done));
}

const TOP_FIXES = 5;

/** Dashboard card (WO-B14-006): first open Must, then Should rows, ≤ 5. */
export function topFixes(findings: Finding[], done: ReadonlySet<string>) {
  const [must, should] = buildFixGroups(findings, "all", done);
  return [...must.rows, ...should.rows]
    .filter((row) => !row.done)
    .slice(0, TOP_FIXES);
}

/** Checklist items the app could not check, with their reason. */
export function blockedItems(report: Pick<ReportJson, "items">) {
  return report.items.filter((i) => i.status === "BLOCKED");
}

/**
 * Why a check could not run, in plain words (B16 WO-B16-002, ADR-030 §7).
 * First matching note wins; the table is mirrored in fork/RUNBOOK.md
 * § "Couldn't check". `expected` causes need no action.
 */
const BLOCKED_CAUSES = [
  {
    // WO-B19-016: the browser helper ran, its speed test did not.
    key: "speed",
    match: /^lighthouse unavailable/i,
    label: "Speed checks did not run",
    action:
      "The browser helper's speed test failed during this check. Check again.",
    expected: false,
  },
  {
    key: "browser",
    match: /render unavailable|^(render|axe|lighthouse) unavailable|sidecar/i,
    label: "Needs the browser helper",
    action: "Start it, then Check again.",
    expected: false,
  },
  {
    key: "ai-budget",
    match: /^llm (budget|credits)|requires more credits/i,
    label: "The AI review ran out of budget or credits",
    action: "Add credits or raise the AI budget, then Check again.",
    expected: false,
  },
  {
    key: "ai-off",
    match: /^no llm key|LLM map stage/i,
    label: "Needs the AI review",
    action: "Optional. Add an AI key in the settings to run these.",
    expected: true,
  },
  {
    key: "ai-unsure",
    match: /^llm unsure/i,
    label: "The AI reviewer was not sure",
    action: "Look at these yourself; Details says why.",
    expected: true,
  },
  {
    key: "crux",
    match: /CRUX_API_KEY|CrUX API/,
    label: "Needs a free Google key (CrUX)",
    action: "Optional. Real-visitor speed data needs it.",
    expected: true,
  },
  {
    key: "search-data",
    match: /serp pages unavailable|dataforseo credit/i,
    label: "Needs search-results data",
    action: "Add DataForSEO credit, then Check again.",
    expected: false,
  },
  {
    key: "owner-fact",
    match: /^gate ".*" = \?/,
    label: "Needs a fact only you know",
    action: "Expected. Details shows the question; check it yourself.",
    expected: true,
  },
  {
    key: "owner-decision",
    match: /^Owner to record/,
    label: "Needs your decision",
    action:
      "Expected. Decide which AI bots may read the site; Details lists them.",
    expected: true,
  },
  {
    key: "off",
    match: /^operator: /,
    label: "Turned off in this app",
    action: "Expected.",
    expected: true,
  },
  {
    key: "pages",
    match: /pages unavailable|stats on fewer than two pages/i,
    label: "Not enough pages were read",
    action: "Check again; if it repeats, the site blocked the reader.",
    expected: false,
  },
  {
    key: "check-failed",
    match: /^check (error|contract violation)/,
    label: "The check itself failed",
    action: "Check again; if it repeats, report it as a bug.",
    expected: false,
  },
] as const;

const OTHER_CAUSE = {
  key: "other",
  label: "Could not be checked (other)",
  action: "Details shows the reason.",
  expected: false,
};

type BlockedItem = ReturnType<typeof blockedItems>[number];
type BlockedCause = {
  key: string;
  label: string;
  action: string;
  expected: boolean;
  items: BlockedItem[];
};

/** Blocked items grouped by cause, in table order; never drops an item. */
export function blockedCauses(
  report: Pick<ReportJson, "items">,
): BlockedCause[] {
  const groups = new Map<string, BlockedCause>();
  for (const item of blockedItems(report)) {
    const found = BLOCKED_CAUSES.find((c) => c.match.test(item.note ?? ""));
    const cause = found
      ? {
          key: found.key,
          label: found.label,
          action: found.action,
          expected: found.expected,
        }
      : OTHER_CAUSE;
    const group = groups.get(cause.key) ?? { ...cause, items: [] };
    group.items.push(item);
    groups.set(cause.key, group);
  }
  const order = [...BLOCKED_CAUSES.map((c) => c.key), OTHER_CAUSE.key];
  return sort(
    [...groups.values()],
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
  );
}

/** "21 checks" / "1 check". */
export const checksCount = (n: number) => (n === 1 ? "1 check" : `${n} checks`);

const CSV_URL_LIMIT = 50;

/** CSV in priority order: one row per finding, up to 50 URLs per row. */
export function fixListCsv(findings: Finding[]): string {
  const rows = buildFixGroups(findings, "all", new Set()).flatMap((group) =>
    group.findings.map((f) => [
      group.label,
      (f.categories ?? []).join(" "),
      f.effect ?? "",
      f.title,
      f.fix,
      f.urls.length,
      f.urls.slice(0, CSV_URL_LIMIT).join(" "),
    ]),
  );
  return buildCsv(
    [
      "priority",
      "categories",
      "effect",
      "title",
      "how_to_fix",
      "pages_count",
      "pages",
    ],
    rows,
  );
}

/** `window.localStorage` itself throws in some sandboxed frames. */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
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
/**
 * WO-B20-003: which open must-fix finding(s) capped the grade, by title and
 * page count ("Capped at 39 by: <title> on 2 pages"). Null when not capped.
 * The codes come from the stored cap reason ("open S1: F01, F03").
 */
export function capNote(report: {
  score: { final: number; capReason: string | null } | null;
  findings: ReadonlyArray<Pick<Finding, "code" | "title" | "urls">>;
}): string | null {
  const reason = report.score?.capReason;
  if (!reason || !report.score) return null;
  const codes = new Set(reason.replace(/^open S1:\s*/, "").split(/,\s*/));
  const causes = report.findings
    .filter((f) => codes.has(f.code))
    .map((f) => {
      const n = f.urls.length;
      return n > 0 ? `${f.title} on ${n} page${n === 1 ? "" : "s"}` : f.title;
    });
  return `Capped at ${report.score.final} by: ${causes.length > 0 ? causes.join("; ") : reason}`;
}

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

/**
 * "This grade is not final" banner (B16 WO-B16-003, ADR-030 §8). Display
 * only: the stored reason and the export wording stay "provisional".
 */
export function notFinalNote(input: {
  reason: string | null;
  runDate: string;
  newerRunId: string | null;
}) {
  if (!input.reason) return null;
  const date = new Date(input.runDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return {
    title: "This grade is not final",
    body: `Checked on ${date} without the browser helper (${helperProblem(input.reason)}), so pages that need JavaScript were not fully checked.`,
    newerRunId: input.newerRunId,
  };
}

/** The stored reason in plain words; the raw text stays under Details. */
function helperProblem(reason: string) {
  if (/not configured/i.test(reason)) return "it was not set up";
  if (/unreachable|fetch failed|no sidecar/i.test(reason))
    return "it was not running";
  return "it returned an error";
}

/** Newest completed run of the same site that started after `run`, or null. */
export function newerCompletedRun(
  runs: readonly {
    id: string;
    origin: string;
    status: string;
    startedAt: string | Date;
  }[],
  run: { id: string; origin: string; startedAt: string | Date },
): string | null {
  const after = new Date(run.startedAt).getTime();
  const newer = runs.filter(
    (r) =>
      r.id !== run.id &&
      r.origin === run.origin &&
      r.status === "completed" &&
      new Date(r.startedAt).getTime() > after,
  );
  return (
    sort(
      newer,
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )[0]?.id ?? null
  );
}
