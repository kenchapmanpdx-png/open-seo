/**
 * Golden scorer (B1 R4): compare a handbook run (report.json, K7) with a
 * golden expectation file (fork/fixtures/expected/*.expected.yaml).
 *
 * Expected finding → caught (a report finding shares ≥1 item id AND ≥1 URL
 * path, `*` = one segment wildcard) · partial (shares an item but no URL, or
 * an item is OPEN/PARTIAL without a finding) · missed. A missed finding is
 * `site-changed` when its `note` says so, or when a direct re-fetch of one of
 * its concrete URLs returns a status different from the run's crawl
 * (collected.json next to report.json). Expected passes → caught when every
 * listed item is PASS, partial when some are.
 *
 * `supp: [SUPP-nn]` (ADR-020) adds supplementary rule ids: they match report
 * findings and `additionalFindings` like `items` do (a SUPP-only entry has
 * `items: []`). An entry with `scope` (outside-scope / truth-verification
 * [Ken], off-site) is listed as `excluded` and left out of the catch rate.
 *
 * `--md <path>` (or `--report` → fork/reports/B2-golden.md) also writes a
 * per-site section into that markdown file, replacing an earlier section
 * for the same site.
 *
 *   pnpm exec tsx fork/scripts/golden-score.ts <report.json> <expected.yaml> [--report | --md <path>]
 */
import { writeFormatted } from "./lib/write-formatted";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { z } from "zod";
import {
  reportJsonSchema,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import { scoreReport } from "@/server/features/handbook/engine/report";

const entrySchema = z.object({
  id: z.string(),
  title: z.string(),
  items: z.array(z.string()),
  supp: z.array(z.string()).default([]),
  scope: z
    .enum(["outside-scope [Ken]", "truth-verification [Ken]", "off-site"])
    .optional(),
  urls: z.array(z.string()).default([]),
  detectableBy: z.string().optional(),
  severity: z.string().nullish(),
  note: z.string().optional(),
});
const expectedSchema = z.object({
  site: z.string(),
  origin: z.string().url(),
  grade: z.object({ final: z.number(), uncapped: z.number() }).optional(),
  findings: z.array(entrySchema),
  passes: z.array(entrySchema).default([]),
});
type Entry = z.infer<typeof entrySchema>;

const collectedSchema = z.object({
  pages: z
    .array(z.object({ url: z.string(), status: z.number() }))
    .nullable()
    .optional()
    .catch(null),
});

type Verdict = "caught" | "partial" | "missed" | "site-changed" | "excluded";
type Scored = { entry: Entry; verdict: Verdict; why: string };

const trimSlash = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, "") : path;

/** Expected path pattern (`*` = one segment, `/*` alone = any page). */
export function pathMatches(pattern: string, path: string): boolean {
  if (pattern === "/*") return true;
  const escaped = trimSlash(pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]+");
  return new RegExp(`^${escaped}$`).test(trimSlash(path));
}

function reportPaths(report: ReportJson, urls: readonly string[]) {
  return urls.map((u) => new URL(u, report.site.origin).pathname);
}

const entryIds = (entry: Entry) => [...entry.items, ...entry.supp];

function scoreFinding(report: ReportJson, entry: Entry): Scored {
  if (entry.scope) return { entry, verdict: "excluded", why: entry.scope };
  const ids = entryIds(entry);
  const sharing = [
    ...report.findings,
    ...(report.additionalFindings ?? []),
  ].filter((f) => f.itemIds.some((id) => ids.includes(id)));
  const urlHit = sharing.find((f) =>
    reportPaths(report, f.urls).some((path) =>
      entry.urls.some((p) => pathMatches(p, path)),
    ),
  );
  if (urlHit)
    return {
      entry,
      verdict: "caught",
      why: `${urlHit.code} (${urlHit.itemIds.join(", ")})`,
    };
  if (sharing.length > 0) {
    return {
      entry,
      verdict: "partial",
      why: `${sharing.map((f) => f.code).join(", ")} share items, no URL match`,
    };
  }
  const open = report.items.filter(
    (i) =>
      entry.items.includes(i.itemId) &&
      (i.status === "OPEN" || i.status === "PARTIAL"),
  );
  if (open.length > 0) {
    return {
      entry,
      verdict: "partial",
      why: `${open.map((i) => `${i.itemId} ${i.status}`).join(", ")}, no finding`,
    };
  }
  const statuses = report.items
    .filter((i) => entry.items.includes(i.itemId))
    .map((i) => `${i.itemId} ${i.status}`);
  return {
    entry,
    verdict: "missed",
    why: statuses.join(", ") || "items not in report",
  };
}

function scorePass(report: ReportJson, entry: Entry): Scored {
  if (entry.scope) return { entry, verdict: "excluded", why: entry.scope };
  const items = report.items.filter((i) => entry.items.includes(i.itemId));
  const passed = items.filter((i) => i.status === "PASS");
  const why = items.map((i) => `${i.itemId} ${i.status}`).join(", ");
  if (items.length > 0 && passed.length === entry.items.length)
    return { entry, verdict: "caught", why };
  if (passed.length > 0) return { entry, verdict: "partial", why };
  return { entry, verdict: "missed", why };
}

async function directStatus(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    await res.body?.cancel();
    return res.status;
  } catch {
    return null;
  }
}

/** Missed → site-changed per note or a status drift on re-fetch (same origin only). */
async function markSiteChanged(
  scored: Scored,
  origin: string,
  crawled: Map<string, number>,
) {
  if (scored.verdict !== "missed") return scored;
  if (scored.entry.note?.includes("site-changed")) {
    return {
      ...scored,
      verdict: "site-changed" as const,
      why: `${scored.why}; note: ${scored.entry.note}`,
    };
  }
  for (const path of scored.entry.urls.filter(
    (u) => u.startsWith("/") && !u.includes("*"),
  )) {
    const url = new URL(path, origin);
    if (url.origin !== new URL(origin).origin) continue;
    // Exact path: `/x/` and `/x` are different URLs here (trailing-slash findings).
    const before = crawled.get(url.pathname);
    if (before === undefined) continue;
    const now = await directStatus(url.href);
    if (now !== null && now !== before) {
      return {
        ...scored,
        verdict: "site-changed" as const,
        why: `${scored.why}; ${path} crawl ${before} → now ${now}`,
      };
    }
  }
  return scored;
}

function loadCrawled(reportPath: string): Map<string, number> {
  const path = join(dirname(reportPath), "collected.json");
  const out = new Map<string, number>();
  if (!existsSync(path)) return out;
  const parsed = collectedSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  for (const page of parsed.pages ?? [])
    out.set(new URL(page.url).pathname, page.status);
  return out;
}

function table(title: string, rows: Scored[]) {
  const count = (v: Verdict) => rows.filter((r) => r.verdict === v).length;
  return [
    `## ${title}`,
    "",
    `caught ${count("caught")} · partial ${count("partial")} · missed ${count("missed")} · site-changed ${count("site-changed")} · excluded ${count("excluded")} · total ${rows.length}`,
    "",
    "| id | verdict | detectableBy | items | title | why |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${r.entry.id} | ${r.verdict} | ${r.entry.detectableBy ?? ""} | ${entryIds(r.entry).join(", ")} | ${r.entry.title.replace(/\|/g, "\\|")} | ${r.why.replace(/\|/g, "\\|")} |`,
    ),
    "",
  ];
}

export async function scoreGolden(reportPath: string, expectedPath: string) {
  const report = reportJsonSchema.parse(
    JSON.parse(readFileSync(reportPath, "utf8")),
  );
  const expected = expectedSchema.parse(
    parse(readFileSync(expectedPath, "utf8")),
  );
  const crawled = loadCrawled(reportPath);
  const findings: Scored[] = [];
  for (const entry of expected.findings) {
    findings.push(
      await markSiteChanged(
        scoreFinding(report, entry),
        expected.origin,
        crawled,
      ),
    );
  }
  const passes = expected.passes.map((entry) => scorePass(report, entry));
  // Re-scored from the saved items, so runs from before K6 get a grade too.
  const score = scoreReport(report);
  const gradeLine = expected.grade
    ? `Grade: run ${score.final} ${score.grade} (uncapped ${score.uncapped}) · golden ${expected.grade.final} (uncapped ${expected.grade.uncapped}) · delta ${round1(score.final - expected.grade.final)} (uncapped ${round1(score.uncapped - expected.grade.uncapped)}) · tolerance ±10`
    : `Grade: run ${score.final} ${score.grade} (uncapped ${score.uncapped})`;
  const md = [
    `# Golden score — ${expected.site}`,
    "",
    `Report: ${reportPath} (run ${report.run.id}, ${report.generatedAt}) · Expected: ${expectedPath}`,
    "",
    gradeLine,
    "",
    "| phase | weight | score | driver |",
    "| --- | --- | --- | --- |",
    ...score.phases.map(
      (p) =>
        `| ${p.phase} | ${p.weight} | ${p.score ?? "—"} | ${(p.driver ?? "").replace(/\|/g, "\\|")} |`,
    ),
    "",
    ...table("Findings", findings),
    ...table("Passes", passes),
  ].join("\n");
  const out = join(dirname(reportPath), "golden-score.md");
  await writeFormatted(out, md);
  return { site: expected.site, report, findings, passes, out, gradeLine };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const DEFAULT_MD = "fork/reports/B2-golden.md";
const SECTION = (site: string) => `<!-- golden:${site} -->`;

/** Per-site section (finding id · items · verdict), replacing an earlier one. */
async function appendSiteSection(
  mdPath: string,
  reportPath: string,
  scored: Awaited<ReturnType<typeof scoreGolden>>,
) {
  const { site, report, findings, passes } = scored;
  const count = (rows: Scored[], v: Verdict) =>
    rows.filter((r) => r.verdict === v).length;
  const headline = (rows: Scored[]) =>
    `caught ${count(rows, "caught")} · partial ${count(rows, "partial")} · missed ${count(rows, "missed")} · site-changed ${count(rows, "site-changed")} · excluded ${count(rows, "excluded")} · total ${rows.length}`;
  const section = [
    SECTION(site),
    `## ${site}`,
    "",
    `Run date ${report.generatedAt.slice(0, 10)} · report ${reportPath}`,
    "",
    scored.gradeLine,
    "",
    `Findings: ${headline(findings)}`,
    "",
    `Passes: ${headline(passes)}`,
    "",
    "| finding | items | verdict |",
    "| --- | --- | --- |",
    ...findings.map(
      (r) =>
        `| ${r.entry.id} | ${entryIds(r.entry).join(", ")} | ${r.verdict} |`,
    ),
    "",
    SECTION(site),
  ].join("\n");
  const current = existsSync(mdPath)
    ? readFileSync(mdPath, "utf8")
    : "# B2 golden scores\n";
  const marker = SECTION(site);
  const start = current.indexOf(marker);
  const end = start < 0 ? -1 : current.indexOf(marker, start + marker.length);
  const next =
    start >= 0 && end >= 0
      ? current.slice(0, start) + section + current.slice(end + marker.length)
      : `${current.trimEnd()}\n\n${section}\n`;
  await writeFormatted(mdPath, next);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      report: { type: "boolean", default: false },
      md: { type: "string" },
    },
  });
  const [reportPath, expectedPath] = positionals;
  if (!reportPath || !expectedPath) {
    console.error(
      "usage: golden-score.ts <report.json> <expected.yaml> [--report | --md <path>]",
    );
    process.exit(2);
  }
  const mdPath = values.md ?? (values.report ? DEFAULT_MD : null);
  scoreGolden(reportPath, expectedPath)
    .then(async (scored) => {
      const { findings, passes, out } = scored;
      if (mdPath) {
        await appendSiteSection(mdPath, reportPath, scored);
        console.log(`→ ${mdPath}`);
      }
      for (const [name, rows] of [
        ["findings", findings],
        ["passes", passes],
      ] as const) {
        const counts = new Map<string, number>();
        for (const r of rows)
          counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1);
        console.log(
          `${name}: ${[...counts].map(([v, n]) => `${v} ${n}`).join(" · ")} (of ${rows.length})`,
        );
      }
      console.log(`→ ${out}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
