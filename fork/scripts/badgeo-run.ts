/**
 * BadGEO harness (B1 R4): serve fork/fixtures/badgeo, run the CLI engine on
 * it, and compare per page: every item declared in `<meta name="badgeo-expect">`
 * (or `_expect.json` for pseudo-pages such as /robots.txt) must fire on that
 * page, and nothing else may. "Fired" = a finding citing the item whose urls
 * include the page. Exit 1 on any missing/unexpected unless --report-only.
 *
 *   pnpm exec tsx fork/scripts/badgeo-run.ts [--report-only]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { sort } from "remeda";
import { z } from "zod";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import { runCliAudit } from "./handbook-audit";
import { BADGEO_ROOT, startBadgeo } from "./badgeo-serve";

type Row = {
  page: string;
  expected: string[];
  fired: string[];
  missing: string[];
  unexpected: string[];
};

const EXPECT_META = /<meta\s+name="badgeo-expect"\s+content="([^"]*)"/i;

function listHtml(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listHtml(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

/** Page path ("/", "/about/", "/x.html") → expected item ids. */
function loadExpectations(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of listHtml(BADGEO_ROOT)) {
    const rel = "/" + relative(BADGEO_ROOT, file).replace(/index\.html$/, "");
    const content = EXPECT_META.exec(readFileSync(file, "utf8"))?.[1] ?? "";
    out.set(
      rel,
      content
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  const extra = z
    .record(z.string(), z.array(z.string()))
    .parse(JSON.parse(readFileSync(join(BADGEO_ROOT, "_expect.json"), "utf8")));
  for (const [page, ids] of Object.entries(extra)) out.set(page, ids);
  return out;
}

function firedByPage(report: ReportJson): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const finding of report.findings) {
    for (const url of finding.urls) {
      const path = new URL(url, report.site.origin).pathname;
      const set = out.get(path) ?? new Set<string>();
      for (const id of finding.itemIds) set.add(id);
      out.set(path, set);
    }
  }
  return out;
}

export function compare(
  report: ReportJson,
  expectations: Map<string, string[]>,
): Row[] {
  const fired = firedByPage(report);
  const pages = sort(
    [...new Set([...expectations.keys(), ...fired.keys()])],
    (a, b) => a.localeCompare(b),
  );
  return pages.map((page) => {
    const expected = expectations.get(page) ?? [];
    const got = [...(fired.get(page) ?? [])];
    return {
      page,
      expected,
      fired: got,
      missing: expected.filter((id) => !got.includes(id)),
      unexpected: got.filter((id) => !expected.includes(id)),
    };
  });
}

async function main() {
  const { values } = parseArgs({
    options: { "report-only": { type: "boolean", default: false } },
  });
  const server = await startBadgeo();
  try {
    const date = new Date().toISOString().slice(0, 10);
    const { report } = await runCliAudit([
      server.origin,
      "--allow-private",
      "--mode",
      "AUDIT",
      "--max-pages",
      "50",
      "--out",
      join("fork/runs/badgeo", date),
    ]);
    const rows = compare(report, loadExpectations());
    const list = (ids: string[]) => ids.join(", ") || "—";
    console.log("| page | expected | fired | missing | unexpected |");
    console.log("| --- | --- | --- | --- | --- |");
    for (const r of rows) {
      console.log(
        `| ${r.page} | ${list(r.expected)} | ${list(r.fired)} | ${list(r.missing)} | ${list(r.unexpected)} |`,
      );
    }
    const missing = rows.reduce((n, r) => n + r.missing.length, 0);
    const unexpected = rows.reduce((n, r) => n + r.unexpected.length, 0);
    console.log(
      `\npages ${rows.length} · missing ${missing} · unexpected ${unexpected} · findings ${report.findings.length}`,
    );
    if ((missing > 0 || unexpected > 0) && !values["report-only"])
      process.exitCode = 1;
  } finally {
    await server.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
