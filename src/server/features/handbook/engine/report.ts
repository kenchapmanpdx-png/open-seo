import {
  REPORT_JSON_VERSION,
  type REVIEW_REPORT_SECTIONS,
  type HandbookDepth,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import type { HandbookMode } from "@/server/features/handbook/contracts/status";
import type { RunResult } from "./runner";
import {
  renderOwnerTodoMd,
  renderReviewMd,
  renderStatusMd,
} from "../export/markdown";
import { scoreItems } from "./scoring";

/**
 * RunResult → K7 ReportJson with the EP-7 score (K6). Markdown exports
 * render from the ReportJson (`../export/`).
 */
export function buildReportJson(input: {
  result: RunResult;
  registry: readonly RegistryEntry[];
  handbookVersion: string;
  runId: string;
  origin: string;
  mode: HandbookMode;
  startedAt: string;
  finishedAt: string | null;
  /** ADR-018; absent = `quick`. */
  depth?: HandbookDepth;
}): ReportJson {
  const { result } = input;
  const phaseOf = new Map(input.registry.map((e) => [e.id, e.phase]));
  const codesByItem = new Map<string, string[]>();
  for (const f of result.findings) {
    for (const id of f.itemIds)
      codesByItem.set(id, [...(codesByItem.get(id) ?? []), f.code]);
  }
  const s1Open = result.findings.filter((f) => f.severity === "S1");
  const report: ReportJson = {
    reportVersion: REPORT_JSON_VERSION,
    contractsVersion: CONTRACTS_VERSION,
    handbookVersion: input.handbookVersion,
    generatedAt: input.finishedAt ?? input.startedAt,
    site: { origin: input.origin, platform: platformOf(result) },
    run: {
      id: input.runId,
      mode: input.mode,
      tier: result.intake.tier,
      tierEvidence: result.intake.tierEvidence,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      depth: input.depth ?? "quick",
      ...(result.collected.pages.status === "ok" &&
      result.collected.pages.coverage
        ? { coverage: result.collected.pages.coverage }
        : {}),
    },
    score: null,
    siteProfile: result.intake.siteProfile,
    findings: result.findings.map((f) => ({
      code: f.code,
      severity: f.severity,
      phase: f.phase,
      sectionRef: f.sectionRef,
      title: f.title,
      detail: f.detail,
      fix: f.fix,
      fixability: f.fixability,
      limitedReason: f.limitedReason ?? null,
      effort: f.effort,
      source: f.source,
      itemIds: [...f.itemIds],
      urls: [...f.urls],
      evidence: result.evidence
        .filter((e) => e.findingCode === f.code)
        .map((e) => ({ kind: e.kind, url: e.url, excerpt: e.excerpt })),
    })),
    items: result.statuses.map((s) => ({
      itemId: s.itemId,
      phase: phaseOf.get(s.itemId) ?? "",
      status: s.status,
      note: s.note,
      findingCodes: codesByItem.get(s.itemId) ?? [],
    })),
    release: {
      status:
        input.mode === "REVIEW"
          ? "NOT_APPLICABLE"
          : s1Open.length > 0
            ? "RELEASE_BLOCKED"
            : "CLEAR",
      blockingItemIds: [...new Set(s1Open.flatMap((f) => f.itemIds))],
    },
    checkerErrors: result.checkerErrors,
    outsideScope: [],
  };
  const scored = { ...report, score: scoreReport(report) };
  const confirmed = confirmExports(scored, input.registry);
  return { ...confirmed, score: scoreReport(confirmed) };
}

/** Platform named by the P0-03 check note ("platform: Squarespace (…) via …"). */
function platformOf(result: RunResult): string | null {
  const note = result.statuses.find((s) => s.itemId === "P0-03")?.note;
  return note?.match(/^platform: (.+?) \(/)?.[1] ?? null;
}

/** Heading each REVIEW_REPORT_SECTIONS entry renders as in `renderReviewMd`. */
const SECTION_HEADING: Record<(typeof REVIEW_REPORT_SECTIONS)[number], string> =
  {
    Header: "# On-site SEO/GEO review",
    Grade: "## Grade:",
    "Site Profile": "## Site Profile",
    "Top fixes": "## Top fixes",
    "Findings by severity": "## Findings",
    Passes: "## Passes",
    "Limited (platform)": "## Limited (platform)",
    "Blocked (owner access)": "## Blocked (owner access)",
    "Outside scope — noted": "## Outside scope — noted",
    "Additional findings": "## Additional findings",
    "Answer-engine readiness": "## Answer-engine readiness",
    Escalations: "## Escalations",
    "Checker errors": "## Checker errors",
    "Residual weaknesses": "## Residual weaknesses",
  };
const STATUS_HEADINGS = ["## Site Profile", "## Decisions", "## Checklist"];
const OWNER_HEADINGS = [
  "## Business facts needed",
  "## Confirm before acting",
  "## Policy decisions",
  "## TODO(owner)",
];

const missingHeadings = (md: string, headings: readonly string[]) =>
  headings.filter((h) => !md.split("\n").some((l) => l.startsWith(h)));

const decide = (gaps: string[], what: string) => ({
  status: gaps.length === 0 ? ("PASS" as const) : ("OPEN" as const),
  note:
    gaps.length === 0
      ? `${what} rendered with every section`
      : `${what} missing: ${gaps.join(", ")}`,
});

/**
 * WO-B4-006/007: P0-01 (status file), P0-02 (owner to-do) and RV-02 (EP-7 report sections + score)
 * are PASS once their export renders complete; they stay DEFERRED when the
 * runner left them so and are untouched when out of scope (NA at intake).
 */
function confirmExports(
  report: ReportJson,
  registry: readonly RegistryEntry[],
): ReportJson {
  const verdicts = new Map<string, { status: "PASS" | "OPEN"; note: string }>();
  const deferred = (id: string) =>
    report.items.some((i) => i.itemId === id && i.status === "DEFERRED");
  if (deferred("P0-01"))
    verdicts.set(
      "P0-01",
      decide(
        missingHeadings(renderStatusMd(report, registry), STATUS_HEADINGS),
        "seo-geo-status.md",
      ),
    );
  if (deferred("P0-02"))
    verdicts.set(
      "P0-02",
      decide(
        missingHeadings(renderOwnerTodoMd(report, registry), OWNER_HEADINGS),
        "seo-owner-todo.md",
      ),
    );
  if (deferred("RV-02")) {
    const gaps = missingHeadings(
      renderReviewMd(report, registry),
      Object.values(SECTION_HEADING),
    );
    if (!report.score) gaps.push("EP-7 score");
    verdicts.set("RV-02", decide(gaps, "EP-7 review report"));
  }
  return {
    ...report,
    items: report.items.map((i) => {
      const v = verdicts.get(i.itemId);
      return v ? { ...i, ...v } : i;
    }),
  };
}

/**
 * EP-7 score of a report (K6). Works on a saved report.json too, so earlier
 * runs can be re-scored. LLM findings never cap the grade (ADR-007: never
 * release-blocking).
 */
export function scoreReport(
  report: ReportJson,
): NonNullable<ReportJson["score"]> {
  const findingByCode = new Map(report.findings.map((f) => [f.code, f]));
  const score = scoreItems({
    handbookVersion: report.handbookVersion,
    mode: report.run.mode,
    items: report.items.map((item) => {
      const linked = item.findingCodes.flatMap((code) => {
        const f = findingByCode.get(code);
        return f && f.source !== "llm" ? [f] : [];
      });
      return {
        itemId: item.itemId,
        phase: item.phase,
        status: item.status,
        openSeverities: linked.map((f) => f.severity),
        openFindingCodes: linked.map((f) => f.code),
      };
    }),
  });
  return {
    final: score.final,
    uncapped: score.uncapped,
    grade: score.grade,
    capReason: score.capReason,
    phases: score.phases.map((p) => ({
      phase: p.phase,
      weight: p.weight,
      score: p.score,
      driver: phaseDriver(report, p.phase),
    })),
  };
}

/** The two most severe findings behind the phase's OPEN/PARTIAL items. */
function phaseDriver(report: ReportJson, phase: string): string | null {
  const codes = new Set(
    report.items
      .filter(
        (i) =>
          i.phase === phase && (i.status === "OPEN" || i.status === "PARTIAL"),
      )
      .flatMap((i) => i.findingCodes),
  );
  const open = report.findings.filter((f) => codes.has(f.code));
  open.sort((a, b) => a.severity.localeCompare(b.severity));
  const drivers = open.slice(0, 2).map((f) => `${f.code} ${f.title}`);
  return drivers.length ? drivers.join("; ") : null;
}
