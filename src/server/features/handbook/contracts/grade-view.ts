import type { ReportJson } from "./exports";

type Score = ReportJson["score"];

/** The words a not-graded run states on every screen and export (WO-B21-001). */
export const NOT_GRADED_LABEL = "Not graded";

/**
 * WO-B21-001: the one reader of a report's grade. A run that read no page has
 * `score.notGradedReason` set (`scoreReport`); its stored `grade` / `final`
 * are not shown anywhere. Every consumer of the grade goes through this.
 */
export function gradeView(
  score: Score | undefined,
):
  | { kind: "graded"; grade: string; final: number }
  | { kind: "not-graded"; reason: string }
  | { kind: "none" } {
  if (!score) return { kind: "none" };
  if (score.notGradedReason)
    return { kind: "not-graded", reason: score.notGradedReason };
  return { kind: "graded", grade: score.grade, final: score.final };
}

/**
 * Why a report is not graded, or null. No page read (`coverage.read === 0`),
 * or a stored run without coverage whose `pages` collector was unavailable
 * (the runner notes "pages unavailable: …" on the items it blocked). A legacy
 * run without coverage that read pages stays graded.
 */
export function notGradedReasonOf(report: {
  run: { coverage?: { read: number } };
  items: ReadonlyArray<{ note?: string | null }>;
}): string | null {
  const note =
    report.items.find((i) => /^pages unavailable/i.test(i.note ?? ""))?.note ??
    null;
  const read = report.run.coverage?.read;
  if (read === 0) return note ?? "no page of the site answered the crawler";
  return read === undefined ? note : null;
}

/** The render collector's note when the site answered a non-2xx status. */
const RENDER_HTTP =
  /^render unavailable: render HTTP (\d{3}) \(no-JS (\d{3})\)/;

/**
 * WO-B24-001: the status the target site refused the browser helper with, or
 * null. A refusal is a 4xx other than 429 on the JS or no-JS render (the
 * helper ran; the site blocks automated browsers). 5xx, 429, timeouts and
 * helper faults are not refusals.
 */
export function siteRefusedStatus(
  items: ReadonlyArray<{ note?: string | null }>,
): number | null {
  for (const item of items) {
    const m = RENDER_HTTP.exec(item.note ?? "");
    if (!m) continue;
    const bad = [m[1], m[2]].map(Number).filter((s) => s < 200 || s > 299);
    if (bad.length > 0 && bad.every((s) => s >= 400 && s < 500 && s !== 429))
      return bad[0];
  }
  return null;
}

/**
 * The runner note that makes a grade provisional (render evidence missing,
 * "render unavailable: …"), or null. A site refusal is final with limits
 * (WO-B24-001): a re-check cannot change it. Read by the app and the exports.
 */
export function provisionalRenderNote(report: {
  items: ReadonlyArray<{ note?: string | null }>;
}): string | null {
  if (siteRefusedStatus(report.items) !== null) return null;
  return (
    report.items.find((i) => i.note?.startsWith("render unavailable"))?.note ??
    null
  );
}

/** Runner note on an item BLOCKED because a collector it needs was unavailable. */
const COLLECTOR_UNAVAILABLE = /^\w+ unavailable: /;

/**
 * Empty-state wording for a report with no findings (WO-B21-001 step 6).
 * "Passed" only when pages were read and no check was blocked by an
 * unavailable collector.
 */
export function noFindingsText(report: {
  score: Score;
  run: { coverage?: { read: number } };
  items: ReadonlyArray<{ status: string; note?: string | null }>;
}): string {
  if (gradeView(report.score).kind === "not-graded")
    return "No page was read, so nothing was checked.";
  const blocked = report.items.some(
    (i) => i.status === "BLOCKED" && COLLECTOR_UNAVAILABLE.test(i.note ?? ""),
  );
  return blocked
    ? "No problems found in what could be checked; some checks could not run (see the Checklist)."
    : "Every automated check passed or did not apply.";
}

/** Short grade text for lists and summaries: "B · 72", "Not graded", "?". */
export function gradeLabel(score: Score | undefined): string {
  const view = gradeView(score);
  if (view.kind === "graded") return `${view.grade} · ${view.final}`;
  return view.kind === "not-graded" ? NOT_GRADED_LABEL : "?";
}
