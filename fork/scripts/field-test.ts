// One command per field test (B18 WO-B18-009, loop M6): pre-flight the
// sitemap, run the engine (or reuse a run), import the external export,
// write the verdict table into fork/reports/field-<host>-<date>.md and one
// row in the ledger fork/FIELD-TESTS.md.
//
//   pnpm exec tsx fork/scripts/field-test.ts <site> --external <export.csv|xlsx>
//     [--run fork/runs/<host>/<dir>] [--tool Semrush] [--date YYYY-MM-DD]
//     [--sidecar http://127.0.0.1:4777] [--exclude /blog/,/tag/] [--preflight] [--close]
//
// --preflight: count sitemap URLs per first path segment and stop (pick a
//   scope before any run on a big site; Semrush masks are `/path/`).
// --run: reuse a report.json instead of running the engine.
// --exclude: sections left out of the run (same scope as the external export).
// --close: fail (exit 1) while any verdict row is open; no run, no import.
//   On success the report header and the ledger row are rewritten from the
//   verdict table (WO-B22-003).
// --verify-ledgers (no site): every ledger row's open count equals its
//   report's table and header; exit 1 listing the drifted rows.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  compareExport,
  issuesFromRows,
  readCsv,
  readXlsx,
  type ExportIssue,
  type HandbookReport,
} from "./lib/external-audit";
import {
  buildRows,
  ledgerDrift,
  ledgerRow,
  mergeVerdicts,
  openRows,
  readVerdicts,
  renderSection,
  setLedgerOpen,
  upsertLedger,
  upsertSection,
} from "./lib/field-ledger";
import { writeFormatted } from "./lib/write-formatted";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    external: { type: "string" },
    run: { type: "string" },
    tool: { type: "string", default: "Semrush" },
    date: { type: "string", default: new Date().toISOString().slice(0, 10) },
    sidecar: { type: "string", default: "http://127.0.0.1:4777" },
    exclude: { type: "string" },
    preflight: { type: "boolean", default: false },
    close: { type: "boolean", default: false },
    "verify-ledgers": { type: "boolean", default: false },
  },
});
const ledgerPath = "fork/FIELD-TESTS.md";
const reportFile = (host: string, date: string) =>
  join("fork/reports", `field-${host}-${date}.md`);

if (values["verify-ledgers"]) {
  const drift = ledgerDrift(readFileSync(ledgerPath, "utf8"), (h, d) =>
    existsSync(reportFile(h, d))
      ? readFileSync(reportFile(h, d), "utf8")
      : null,
  );
  for (const d of drift)
    console.error(
      `${d.site} ${d.date}: ledger ${d.ledger} · header ${d.header ?? "none"} · table ${d.table ?? "no report"}`,
    );
  console.log(`${ledgerPath}: ${drift.length} drifted row(s)`);
  process.exit(drift.length > 0 ? 1 : 0);
}

const [site] = positionals;
if (!site) {
  console.error(
    "usage: field-test.ts <site> --external <export> [--run dir] [--preflight] [--close]",
  );
  process.exit(2);
}
const origin = new URL(site.includes("://") ? site : `https://${site}`).origin;
const host = new URL(origin).hostname.replace(/^www\./, "");
const reportPath = reportFile(host, values.date);

if (values.preflight) {
  await preflight();
  process.exit(0);
}

if (values.close) {
  const rows = [...readVerdicts(readFileSync(reportPath, "utf8")).values()];
  const open = openRows(rows);
  if (open.length > 0) {
    console.error(`${open.length} open rows in ${reportPath}:`);
    for (const r of open) console.error(`  ${r.key}`);
    process.exit(1);
  }
  // Header and ledger row rendered from the table, never kept by hand.
  // Only the count line: the table itself is never re-rendered here.
  await writeFormatted(
    reportPath,
    readFileSync(reportPath, "utf8").replace(
      /Open rows: \d+\./,
      "Open rows: 0.",
    ),
  );
  await writeFormatted(
    ledgerPath,
    setLedgerOpen(readFileSync(ledgerPath, "utf8"), host, values.date, 0),
  );
  console.log(`${reportPath}: ${rows.length} rows, 0 open — closed`);
  process.exit(0);
}

if (!values.external) {
  console.error("--external <export> is required");
  process.exit(2);
}
const runDir = values.run ?? join("fork/runs", host, `field-${values.date}`);
if (!values.run) {
  execFileSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "fork/scripts/handbook-audit.ts",
      origin,
      "--mode",
      "AUDIT",
      "--depth",
      "full",
      "--max-pages",
      "1000",
      "--sidecar",
      values.sidecar,
      "--out",
      runDir,
      ...(values.exclude ? ["--exclude", values.exclude] : []),
    ],
    { stdio: "inherit" },
  );
}
const report = JSON.parse(
  readFileSync(join(runDir, "report.json"), "utf8"),
) as HandbookReport & {
  run?: { coverage?: { read?: number } };
};
const buf = readFileSync(values.external);
const tables = /\.xlsx$/i.test(values.external)
  ? readXlsx(buf).map((s) => s.rows)
  : [readCsv(buf.toString("utf8"))];
const merged = new Map<string, ExportIssue>();
for (const issue of tables.flatMap(issuesFromRows)) {
  const prev = merged.get(issue.name);
  if (!prev || issue.failed > prev.failed) merged.set(issue.name, issue);
}
const issues = [...merged.values()];
const result = compareExport(issues, report);
const prior = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null;
const rows = mergeVerdicts(buildRows(result), readVerdicts(prior ?? ""));
const title = `# Field test — ${host}, app vs ${values.tool} (${values.date})\n\nRun: \`${runDir}\` · export: \`${values.external}\``;
await writeFormatted(
  reportPath,
  upsertSection(prior, renderSection(rows), title),
);

const toolPages = new Set(issues.flatMap((i) => i.urls)).size || "?";
const ledger = existsSync(ledgerPath)
  ? readFileSync(ledgerPath, "utf8")
  : "# Field tests (loop M6)\n";
const row = ledgerRow(host, values.date, values.tool, rows, {
  app: report.run?.coverage?.read ?? "?",
  tool: toolPages,
});
await writeFormatted(ledgerPath, upsertLedger(ledger, row));
console.log(
  `→ ${reportPath} · agree ${row.agree} · app only ${row.appOnly} · tool only ${row.toolOnly} · unknown ${row.unknown} · open ${row.open}`,
);

/** Sitemap URLs per first path segment (M6 pre-flight, WO-B18-021). */
async function preflight() {
  const seen = new Set<string>();
  const urls: string[] = [];
  const queue = [`${origin}/sitemap_index.xml`, `${origin}/sitemap.xml`];
  while (queue.length > 0 && seen.size < 60) {
    const url = queue.shift() ?? "";
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await fetch(url, { redirect: "follow" }).catch(() => null);
    if (!res?.ok) continue;
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
      (m) => m[1],
    );
    if (/<sitemapindex/i.test(xml)) queue.push(...locs);
    else urls.push(...locs);
  }
  const bySection = new Map<string, number>();
  for (const u of new Set(urls)) {
    const first = new URL(u).pathname.split("/").filter(Boolean)[0];
    const key = first ? `/${first}/` : "/";
    bySection.set(key, (bySection.get(key) ?? 0) + 1);
  }
  console.log(`${origin}: ${new Set(urls).size} sitemap URLs`);
  for (const [section, n] of [...bySection].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(5)}  ${section}`);
  const count = new Set(urls).size;
  console.log(
    count === 0
      ? "No sitemap URLs: the run reads the site by its links (expect a 'No XML sitemap' finding)."
      : count > 100
        ? "Over 100 URLs: pick a scope (Check a site 'Leave out sections'; Semrush masks `/path/`, not `/path/*`)."
        : "100 URLs or fewer: run the whole site.",
  );
}
