// Import an external audit export (Semrush Site Audit xlsx / csv) and list
// misses both ways against a Handbook report (B17 WO-B17-011, loop M6).
//
//   pnpm exec tsx fork/scripts/import-external-audit.ts <export.xlsx|csv> \
//     [--report fork/runs/<site>/<run>/report.json] [--out <file.md>]
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  compareExport,
  issuesFromRows,
  readCsv,
  readXlsx,
  renderMarkdown,
  type ExportIssue,
  type HandbookReport,
} from "./lib/external-audit";
import { writeFormatted } from "./lib/write-formatted";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { report: { type: "string" }, out: { type: "string" } },
});
const [exportPath] = positionals;
if (!exportPath) {
  console.error(
    "usage: import-external-audit.ts <export.xlsx|csv> [--report report.json] [--out file.md]",
  );
  process.exit(2);
}

const buf = readFileSync(exportPath);
const tables = /\.xlsx$/i.test(exportPath)
  ? readXlsx(buf).map((s) => s.rows)
  : [readCsv(buf.toString("utf8"))];
// Merge issues across sheets: a workbook may hold an issues sheet and a
// pages sheet; the larger failed count per issue wins.
const merged = new Map<string, ExportIssue>();
for (const issue of tables.flatMap(issuesFromRows)) {
  const prev = merged.get(issue.name);
  if (!prev || issue.failed > prev.failed) merged.set(issue.name, issue);
}
const report = values.report
  ? (JSON.parse(readFileSync(values.report, "utf8")) as HandbookReport)
  : undefined;
const result = compareExport([...merged.values()], report);
const md = renderMarkdown(exportPath, result, values.report);
if (values.out) {
  await writeFormatted(values.out, md);
  console.log(`→ ${values.out}`);
} else console.log(md);
console.log(
  `issues ${result.issues.length} · no Handbook item ${result.noHandbookItem.length} · Handbook missed ${result.handbookMissed.length} · Handbook only ${result.handbookOnly.length}`,
);
