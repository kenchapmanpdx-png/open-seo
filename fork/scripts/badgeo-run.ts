/**
 * BadGEO harness (B1 R4): serve fork/fixtures/badgeo, run the CLI engine on
 * it, and compare per page: every item declared in `<meta name="badgeo-expect">`
 * (or `_expect.json` for pseudo-pages such as /robots.txt) must fire on that
 * page, and nothing else may. "Fired" = a finding citing the item whose urls
 * include the page. Exit 1 on any missing/unexpected unless --report-only.
 *
 * Expected ids whose item is BLOCKED in the report (e.g. RENDER items when
 * no sidecar ran) are listed as `blocked`, not `missing`, and do not fail.
 * A page marked `<meta name="badgeo-requires" content="sidecar">` is only
 * reachable through a rendered link: without a sidecar it expects nothing.
 * `--sidecar http://127.0.0.1:4778` (token from HANDBOOK_SIDECAR_TOKEN) binds
 * the server on 0.0.0.0 so the sidecar container can render it. 4778 is the
 * test-only `sidecar-badgeo` service (private addresses allowed, WO-B12-004);
 * the real sidecar on 4777 refuses the fixture server.
 *
 * `--only P3-01,P3-02` keeps rows whose expected ∪ fired ids intersect the
 * filter and ignores ids outside it (exit code counts filtered rows only).
 *
 * `--llm` passes through to the CLI (judge + map stage). SUPP rules have no
 * status row, so SUPP ids of class `llm` without `--llm` (or, with it, on a
 * page the map budget left without a PageProfile) and of class `render`
 * without `--sidecar` count as `blocked`, not `missing`.
 *
 *   pnpm exec tsx fork/scripts/badgeo-run.ts [--report-only] [--only <ids>] [--sidecar <url>] [--llm]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { sort } from "remeda";
import { z } from "zod";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import { SUPP_REGISTRY } from "@/server/features/handbook/registry-supp";
import { runCliAudit } from "./handbook-audit";
import { BADGEO_ROOT, startBadgeo } from "./badgeo-serve";

type Row = {
  page: string;
  expected: string[];
  fired: string[];
  missing: string[];
  blocked: string[];
  unexpected: string[];
};

const EXPECT_META = /<meta\s+name="badgeo-expect"\s+content="([^"]*)"/i;
const NEEDS_SIDECAR = /<meta\s+name="badgeo-requires"\s+content="sidecar"/i;

function listHtml(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listHtml(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

/** Page path ("/", "/about/", "/x.html") → expected item ids. */
function loadExpectations(sidecar: boolean): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const file of listHtml(BADGEO_ROOT)) {
    const rel = "/" + relative(BADGEO_ROOT, file).replace(/index\.html$/, "");
    const html = readFileSync(file, "utf8");
    const content =
      !sidecar && NEEDS_SIDECAR.test(html)
        ? ""
        : (EXPECT_META.exec(html)?.[1] ?? "");
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
  for (const finding of [
    ...report.findings,
    ...(report.additionalFindings ?? []),
  ]) {
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
  opts: {
    llm?: boolean;
    sidecar?: boolean;
    /** Paths with a page PageProfile; llm-class SUPP ids elsewhere are blocked (map budget). */
    profiledPages?: ReadonlySet<string>;
  } = {},
): Row[] {
  const fired = firedByPage(report);
  const blockedItems = new Set([
    ...report.items.filter((i) => i.status === "BLOCKED").map((i) => i.itemId),
    ...SUPP_REGISTRY.filter(
      (e) =>
        (e.class === "llm" && !opts.llm) ||
        (e.class === "render" && !opts.sidecar),
    ).map((e) => e.id),
  ]);
  const llmSupp = new Set(
    SUPP_REGISTRY.filter((e) => e.class === "llm").map((e) => e.id),
  );
  const isBlocked = (page: string, id: string) =>
    blockedItems.has(id) ||
    (llmSupp.has(id) && opts.profiledPages?.has(page) === false);
  const pages = sort(
    [...new Set([...expectations.keys(), ...fired.keys()])],
    (a, b) => a.localeCompare(b),
  );
  return pages.map((page) => {
    const expected = expectations.get(page) ?? [];
    const got = [...(fired.get(page) ?? [])];
    const notFired = expected.filter((id) => !got.includes(id));
    return {
      page,
      expected,
      fired: got,
      missing: notFired.filter((id) => !isBlocked(page, id)),
      blocked: notFired.filter((id) => isBlocked(page, id)),
      unexpected: got.filter((id) => !expected.includes(id)),
    };
  });
}

/** Restrict rows and their id lists to the `--only` ids. */
function onlyIds(rows: Row[], ids: readonly string[]): Row[] {
  const keep = (list: string[]) => list.filter((id) => ids.includes(id));
  return rows
    .filter((r) => [...r.expected, ...r.fired].some((id) => ids.includes(id)))
    .map((r) => ({
      page: r.page,
      expected: keep(r.expected),
      fired: keep(r.fired),
      missing: keep(r.missing),
      blocked: keep(r.blocked),
      unexpected: keep(r.unexpected),
    }));
}

async function main() {
  const { values } = parseArgs({
    options: {
      "report-only": { type: "boolean", default: false },
      only: { type: "string" },
      sidecar: { type: "string" },
      llm: { type: "boolean", default: false },
    },
  });
  const only = values.only
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const server = await startBadgeo(values.sidecar ? { host: "0.0.0.0" } : {});
  try {
    const date = new Date().toISOString().slice(0, 10);
    const { report, result, timing } = await runCliAudit([
      server.origin,
      "--allow-private",
      "--mode",
      "AUDIT",
      // With a sidecar: full, so every page renders (WO-B9-004 heavy/beacon).
      "--depth",
      values.sidecar ? "full" : "quick",
      "--max-pages",
      // 100 → 150 (B17): 90 fixture pages + 18 calendar pages reached 100.
      "150",
      "--out",
      join("fork/runs/badgeo", date),
      ...(values.sidecar ? ["--sidecar", values.sidecar] : []),
      ...(values.llm ? ["--llm"] : []),
    ]);
    const all = compare(report, loadExpectations(Boolean(values.sidecar)), {
      llm: values.llm,
      sidecar: Boolean(values.sidecar),
      profiledPages: new Set(
        (result.pageProfiles ?? [])
          .filter((p) => p.scope === "page")
          .map((p) => new URL(p.url).pathname),
      ),
    });
    const rows = only ? onlyIds(all, only) : all;
    const list = (ids: string[]) => ids.join(", ") || "—";
    console.log("| page | expected | fired | missing | blocked | unexpected |");
    console.log("| --- | --- | --- | --- | --- | --- |");
    for (const r of rows) {
      console.log(
        `| ${r.page} | ${list(r.expected)} | ${list(r.fired)} | ${list(r.missing)} | ${list(r.blocked)} | ${list(r.unexpected)} |`,
      );
    }
    const missing = rows.reduce((n, r) => n + r.missing.length, 0);
    const unexpected = rows.reduce((n, r) => n + r.unexpected.length, 0);
    const blocked = rows.reduce((n, r) => n + r.blocked.length, 0);
    console.log(
      `\npages ${rows.length} · missing ${missing} · blocked ${blocked} · unexpected ${unexpected} · findings ${report.findings.length} + ${report.additionalFindings?.length ?? 0} additional · ${timing.totalMs}ms`,
    );
    // WO-B19-008: a check that breaks the K1 contract loses all its items.
    const violations = report.items.filter((i) =>
      i.note?.startsWith("check contract violation"),
    );
    console.log(`contract violations: ${violations.length}`);
    for (const v of violations) console.log(`  ${v.itemId}: ${v.note}`);
    if (violations.length > 0) process.exitCode = 1;
    // WO-B9-001: infinite-space guard (warning only, not a failure).
    const calendarRead =
      result.collected.pages.status === "ok"
        ? result.collected.pages.snapshots.filter((p) =>
            /\/calendar\/page\/\d+\/$/.test(p.url),
          ).length
        : 0;
    if (report.run.coverage?.capped || calendarRead > 20) {
      console.log(
        `WARNING: coverage capped ${report.run.coverage?.capped ?? "?"} · /calendar/page/N/ read ${calendarRead} (want capped false, ≤ 20)`,
      );
    }
    // WO-B9-004: the GA4 beacon on /beacon.html must be recorded then aborted.
    const render = result.collected.render;
    if (values.sidecar && render.status === "ok") {
      const beacon = render.pages.find((p) => p.url.endsWith("/beacon.html"));
      const aborted =
        beacon?.js.requests.some((q) => q.aborted === "beacon") ?? false;
      console.log(
        `beacon: ${beacon ? (aborted ? "aborted by the sidecar" : "NOT aborted") : "page not rendered"}`,
      );
      if (beacon && !aborted) process.exitCode = 1;
    }
    // WO-B9-009: the challenged /gate/challenge.html probe must escalate bot parity.
    const botParity = report.escalations?.find(
      (e) => e.trigger === "bot-parity",
    );
    console.log(
      botParity
        ? `bot-parity escalation: ${botParity.urls.length} URLs because ${botParity.because}`
        : "bot-parity escalation: NOT fired",
    );
    if (!botParity) process.exitCode = 1;
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
