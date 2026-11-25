// Grade-spread report (B22 WO-B22-002): which items fail on nearly every site.
//
//   pnpm exec tsx fork/scripts/grade-spread.ts [<site run dir>...] [--date YYYY-MM-DD]
//
// Default dirs: every fork/runs/<host> (a name with a dot). Per site, the
// newest report.json (by mtime) without a check error is used. Writes
// fork/reports/grade-spread-<date>.md. Read-only; never touches scoring.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { reportJsonSchema } from "@/server/features/handbook/contracts/exports";
import { REGISTRY } from "@/server/features/handbook/registry";
import {
  gradeSpread,
  renderGradeSpread,
  type SiteReport,
} from "./lib/grade-spread";
import { writeFormatted } from "./lib/write-formatted";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { date: { type: "string" } },
});
const date = values.date ?? new Date().toISOString().slice(0, 10);
const dirs = positionals.length
  ? positionals
  : readdirSync("fork/runs")
      .filter(
        (d) =>
          /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) &&
          statSync(join("fork/runs", d)).isDirectory(),
      )
      .map((d) => join("fork/runs", d));

const isCheckError = (note: string | null) =>
  /^check (error|contract violation)/.test(note ?? "");

const reports: SiteReport[] = [];
for (const dir of dirs) {
  const runs = readdirSync(dir)
    .map((r) => join(dir, r, "report.json"))
    .filter((p) => existsSync(p))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  // Newest run without a check error; when every run has one, pass the
  // newest so gradeSpread lists the site as skipped.
  const parsed = runs.flatMap((p) => {
    const r = reportJsonSchema.safeParse(JSON.parse(readFileSync(p, "utf8")));
    return r.success ? [{ p, report: r.data }] : [];
  });
  const pick =
    parsed.find((x) => !x.report.items.some((i) => isCheckError(i.note))) ??
    parsed[0];
  if (pick)
    reports.push({
      site: basename(dir),
      dir: pick.p.replace(/\/report\.json$/, ""),
      report: pick.report,
    });
}

const severity = new Map(REGISTRY.map((e) => [e.id, e.severityDefault]));
const out = `fork/reports/grade-spread-${date}.md`;
const spread = gradeSpread(reports);
await writeFormatted(
  out,
  renderGradeSpread(spread, date, (id) => severity.get(id) ?? "SUPP"),
);
console.log(
  `${spread.sites.length} sites graded, ${spread.skipped.length} skipped, ${spread.universal?.length ?? "—"} items ≥ 80 % → ${out}`,
);
