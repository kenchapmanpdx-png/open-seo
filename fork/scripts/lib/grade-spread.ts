// Grade-spread analysis (B22 WO-B22-002). Read-only: which registry items
// fail on nearly every site, how grades spread, which findings cap. Never
// changes scoring; proposals are rows for Ken.
import type { ReportJson } from "../../../src/server/features/handbook/contracts/exports";
import { gradeView } from "../../../src/server/features/handbook/contracts/grade-view";
import {
  ITEM_SCORE,
  SCORED_PHASE_WEIGHTS,
  type ScoredPhase,
} from "../../../src/server/features/handbook/contracts/scoring";

export type SiteReport = { site: string; dir: string; report: ReportJson };

/** Below this many sites the "fails nearly everywhere" list means nothing. */
const MIN_SITES = 8;
const UNIVERSAL_SHARE = 0.8;

/** Same rule as golden-score: a check error makes a run invalid. */
function hasCheckError(report: ReportJson) {
  return report.items.some((i) =>
    /^check (error|contract violation)/.test(i.note ?? ""),
  );
}

/** A collector was unavailable (e.g. no browser helper): kept, but marked. */
function isNonFinal(report: ReportJson) {
  return report.items.some(
    (i) => i.status === "BLOCKED" && /^\w+ unavailable: /.test(i.note ?? ""),
  );
}

type ItemRow = {
  itemId: string;
  phase: string;
  open: number;
  partial: number;
  pass: number;
  na: number;
  /** OPEN share over sites where the item was scored (OPEN/PARTIAL/LIMITED/PASS). */
  openRate: number;
  /** Mean points of the 100 lost on sites where the item is OPEN or PARTIAL. */
  meanPointsLost: number;
};

export type GradeSpread = {
  sites: Array<{
    site: string;
    dir: string;
    grade: string;
    uncapped: number | null;
    final: number | null;
    nonFinal: boolean;
    capCodes: string[];
  }>;
  skipped: Array<{ site: string; reason: string }>;
  grades: Record<string, number>;
  phaseMeans: Array<{ phase: string; mean: number | null; sites: number }>;
  items: ItemRow[];
  /** Null when fewer than MIN_SITES graded sites (reason in `universalNote`). */
  universal: ItemRow[] | null;
  universalNote: string;
  caps: Array<{ title: string; itemIds: string[]; sites: string[] }>;
};

/** Points of 100 one item's status costs in its report (scorer formula). */
function pointsLost(report: ReportJson, itemId: string) {
  const item = report.items.find((i) => i.itemId === itemId);
  if (!item || !(item.phase in SCORED_PHASE_WEIGHTS)) return 0;
  const value = ITEM_SCORE[item.status];
  if (value === null) return 0;
  const applicable = (phase: string) =>
    report.items.filter(
      (i) => i.phase === phase && ITEM_SCORE[i.status] !== null,
    ).length;
  const scoredWeight = (Object.keys(SCORED_PHASE_WEIGHTS) as ScoredPhase[])
    .filter((p) => applicable(p) > 0)
    .reduce((sum, p) => sum + SCORED_PHASE_WEIGHTS[p], 0);
  const weight = SCORED_PHASE_WEIGHTS[item.phase as ScoredPhase];
  return (
    ((1 - value) * ((weight * 100) / scoredWeight)) / applicable(item.phase)
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function gradeSpread(input: SiteReport[]): GradeSpread {
  const skipped: GradeSpread["skipped"] = [];
  const used: SiteReport[] = [];
  for (const r of input) {
    const view = gradeView(r.report.score ?? undefined);
    if (hasCheckError(r.report))
      skipped.push({ site: r.site, reason: "check error" });
    else if (view.kind !== "graded")
      skipped.push({
        site: r.site,
        reason: view.kind === "not-graded" ? view.reason : "no score",
      });
    else used.push(r);
  }

  const sites = used.map(({ site, dir, report }) => ({
    site,
    dir,
    grade: report.score!.grade,
    uncapped: report.score!.uncapped,
    final: report.score!.final,
    nonFinal: isNonFinal(report),
    capCodes: report.score!.capReason
      ? report.score!.capReason.replace(/^open S1: /, "").split(", ")
      : [],
  }));

  const grades: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of sites) grades[s.grade] += 1;

  const phaseMeans = Object.keys(SCORED_PHASE_WEIGHTS).map((phase) => {
    const scores = used
      .map((r) => r.report.score!.phases.find((p) => p.phase === phase)?.score)
      .filter((s): s is number => typeof s === "number");
    return {
      phase,
      sites: scores.length,
      mean: scores.length
        ? round1(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
    };
  });

  const byItem = new Map<string, ItemRow & { lost: number[] }>();
  for (const { report } of used) {
    for (const item of report.items) {
      const row = byItem.get(item.itemId) ?? {
        itemId: item.itemId,
        phase: item.phase,
        open: 0,
        partial: 0,
        pass: 0,
        na: 0,
        openRate: 0,
        meanPointsLost: 0,
        lost: [],
      };
      if (item.status === "OPEN") row.open += 1;
      else if (item.status === "PARTIAL" || item.status === "LIMITED")
        row.partial += 1;
      else if (item.status === "PASS") row.pass += 1;
      else row.na += 1;
      if (item.status === "OPEN" || item.status === "PARTIAL")
        row.lost.push(pointsLost(report, item.itemId));
      byItem.set(item.itemId, row);
    }
  }
  const items: ItemRow[] = [...byItem.values()]
    .map(({ lost, ...row }) => {
      const scored = row.open + row.partial + row.pass;
      return {
        ...row,
        openRate: scored ? row.open / scored : 0,
        meanPointsLost: lost.length
          ? round1(lost.reduce((a, b) => a + b, 0) / lost.length)
          : 0,
      };
    })
    .filter((r) => r.open + r.partial + r.pass > 0)
    .sort((a, b) => b.openRate - a.openRate || b.open - a.open);

  const enough = used.length >= MIN_SITES;
  const universal = enough
    ? items.filter(
        (r) =>
          r.open + r.partial + r.pass >= MIN_SITES &&
          r.openRate >= UNIVERSAL_SHARE,
      )
    : null;
  const universalNote = enough
    ? `items OPEN on ≥ ${UNIVERSAL_SHARE * 100} % of the ≥ ${MIN_SITES} sites where they were scored`
    : `omitted: ${used.length} graded site(s), fewer than ${MIN_SITES}`;

  const caps = new Map<
    string,
    { title: string; itemIds: string[]; sites: string[] }
  >();
  for (const { site, report } of used) {
    const codes = sites.find((s) => s.site === site)!.capCodes;
    for (const code of codes) {
      const f = report.findings.find((x) => x.code === code);
      const title = f?.title ?? code;
      const key = (f?.itemIds ?? [code]).join("+") + " " + title;
      const row = caps.get(key) ?? {
        title,
        itemIds: f?.itemIds ?? [],
        sites: [],
      };
      if (!row.sites.includes(site)) row.sites.push(site);
      caps.set(key, row);
    }
  }

  return {
    sites,
    skipped,
    grades,
    phaseMeans,
    items,
    universal,
    universalNote,
    caps: [...caps.values()].sort((a, b) => b.sites.length - a.sites.length),
  };
}

const pct = (n: number) => `${Math.round(n * 100)} %`;

/** Markdown for fork/reports/grade-spread-<date>.md. `severityOf` reads the registry default. */
export function renderGradeSpread(
  g: GradeSpread,
  date: string,
  severityOf: (itemId: string) => string,
  effectOf: (itemId: string) => string = () => "—",
) {
  const lines = [
    `# Grade spread — ${date}`,
    "",
    "By `fork/scripts/grade-spread.ts` (WO-B22-002). Latest stored `report.json` per site without a check error; read-only, no scoring change. Proposals are rows for Ken; default: no change.",
    "",
    "## Sites",
    "",
    "| Site | Run | Grade | Uncapped | Final | Capped by | Non-final |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...g.sites.map(
      (s) =>
        `| ${s.site} | \`${s.dir}\` | ${s.grade} | ${s.uncapped} | ${s.final} | ${s.capCodes.join(", ") || "—"} | ${s.nonFinal ? "yes" : ""} |`,
    ),
    "",
    g.skipped.length
      ? `Skipped: ${g.skipped.map((s) => `${s.site} (${s.reason})`).join(", ")}.`
      : "Skipped: none.",
    "",
    "## (a) Grades",
    "",
    "| A | B | C | D | F |",
    "| --- | --- | --- | --- | --- |",
    `| ${["A", "B", "C", "D", "F"].map((k) => g.grades[k]).join(" | ")} |`,
    "",
    `With an open S1 (capped at 39): ${g.sites.filter((s) => s.capCodes.length).length} of ${g.sites.length}.`,
    "",
    "## (b) Mean score per phase",
    "",
    "| Phase | Mean | Sites |",
    "| --- | --- | --- |",
    ...g.phaseMeans.map(
      (p) => `| ${p.phase} | ${p.mean ?? "—"} | ${p.sites} |`,
    ),
    "",
    "## (c) Items failing nearly everywhere",
    "",
    `${g.universalNote}.`,
    "",
  ];
  if (g.universal?.length) {
    lines.push(
      "| Item | Severity default | Effect | OPEN | Scored on | OPEN rate | Mean points lost | Proposal for Ken |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...g.universal.map((r) => {
        const scored = r.open + r.partial + r.pass;
        return `| ${r.itemId} | ${severityOf(r.itemId)} | ${effectOf(r.itemId)} | ${r.open} | ${scored} | ${pct(r.openRate)} | ${r.meanPointsLost} | fails on ${r.open} of ${scored} sites; keep, or re-read the check |`;
      }),
      "",
    );
  }
  lines.push(
    "### All scored items by OPEN rate",
    "",
    "| Item | Phase | OPEN | PARTIAL / LIMITED | PASS | N/A / blocked | OPEN rate | Mean points lost |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...g.items.map(
      (r) =>
        `| ${r.itemId} | ${r.phase} | ${r.open} | ${r.partial} | ${r.pass} | ${r.na} | ${pct(r.openRate)} | ${r.meanPointsLost} |`,
    ),
    "",
    "## (d) Caps (open S1)",
    "",
  );
  lines.push(
    ...(g.caps.length
      ? [
          "| Finding | Items | Sites |",
          "| --- | --- | --- |",
          ...g.caps.map(
            (c) =>
              `| ${c.title.replaceAll("|", "\\|")} | ${c.itemIds.join(", ")} | ${c.sites.join(", ")} |`,
          ),
        ]
      : ["No site capped."]),
    "",
  );
  return lines.join("\n");
}
