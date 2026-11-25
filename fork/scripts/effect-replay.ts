// Effect-map replay (B22 WO-B22-001): per site, the fix list's default-visible
// rows before / after the Housekeeping fold, and every Semrush-agreed issue
// whose mapped items are all `hygiene` (a classification to review).
//
//   pnpm exec tsx fork/scripts/effect-replay.ts
//
// Sites and runs: the table of the newest fork/reports/grade-spread-*.md.
// Read-only; findings and grades are not changed (presentation only).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { reportJsonSchema } from "@/server/features/handbook/contracts/exports";
import { withCategories } from "@/server/features/handbook/engine/categories";
import effects from "@/server/features/handbook/registry-effect.json";
import {
  buildFixGroups,
  fixFindings,
} from "@/client/features/handbook/fixList";
import { compareExport, issuesFromRows, readCsv } from "./lib/external-audit";

const EFFECT: Record<string, { effect: string }> = effects;
const spread = readdirSync("fork/reports")
  .filter((f) => /^grade-spread-.*\.md$/.test(f))
  .sort()
  .at(-1);
if (!spread) throw new Error("no fork/reports/grade-spread-*.md");
const runs = [
  ...readFileSync(`fork/reports/${spread}`, "utf8").matchAll(
    /^\| (\S+)\s+\| `(fork\/runs\/[^`]+)`/gm,
  ),
].map((m) => ({ site: m[1], dir: m[2] }));

const lines = [
  `Runs from \`fork/reports/${spread}\`.`,
  "",
  "| Site | Findings | Visible before | Visible after | Folded (Housekeeping) |",
  "| --- | --- | --- | --- | --- |",
];
const review: string[] = [];
for (const { site, dir } of runs) {
  const report = withCategories(
    reportJsonSchema.parse(
      JSON.parse(readFileSync(`${dir}/report.json`, "utf8")),
    ),
  );
  const groups = buildFixGroups(fixFindings(report), "all", new Set());
  const after = groups.reduce((n, g) => n + g.rows.length, 0);
  const folded = groups.reduce((n, g) => n + g.housekeeping.length, 0);
  const findings = groups.reduce((n, g) => n + g.findings.length, 0);
  lines.push(
    `| ${site} | ${findings} | ${after + folded} | ${after} | ${folded} |`,
  );
  const csv = readdirSync("fork/fixtures/external").find((f) =>
    f.startsWith(`${site}-semrush-`),
  );
  if (!csv) continue;
  const path = `fork/fixtures/external/${csv}`;
  if (!existsSync(path)) continue;
  const result = compareExport(
    issuesFromRows(readCsv(readFileSync(path, "utf8"))),
    report,
  );
  for (const issue of result.issues) {
    if (!issue.caught || !issue.mapping || !("ids" in issue.mapping)) continue;
    if (issue.mapping.ids.every((id) => EFFECT[id]?.effect === "hygiene"))
      review.push(
        `| ${site} | ${issue.name} | ${issue.mapping.ids.join(", ")} |`,
      );
  }
}
console.log(lines.join("\n"));
console.log("\nSemrush-agreed issues on hygiene-only items (review):\n");
console.log(
  review.length
    ? [
        "| Site | Semrush issue | Items |",
        "| --- | --- | --- |",
        ...review,
      ].join("\n")
    : "none",
);
