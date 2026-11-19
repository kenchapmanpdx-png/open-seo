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
import { collectEscalations } from "./escalations";
import { scoreItems } from "./scoring";
import { isSuppOnly } from "../registry-supp";
import { indexablePages, snippetBlockers } from "../checks/supp-aeo";
import { INFORMATIONAL_PAGE_TYPES } from "@/server/features/handbook/contracts/page-profile";

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
  const all = result.findings.map((f) => ({
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
  }));
  // ADR-020: SUPP-only findings are reported apart and never scored or blocking.
  const findings = all.filter((f) => !isSuppOnly(f.itemIds));
  const additionalFindings = all.filter((f) => isSuppOnly(f.itemIds));
  const s1Open = findings.filter((f) => f.severity === "S1");
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
    findings,
    ...(additionalFindings.length ? { additionalFindings } : {}),
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
  const readiness = answerEngineReadiness(result);
  if (readiness.length > 0) report.answerEngineReadiness = readiness;
  const escalations = collectEscalations(result.collected, input.depth);
  if (escalations.length > 0) report.escalations = escalations;
  if (result.copyQuality) report.copyQuality = result.copyQuality;
  const scored = { ...report, score: scoreReport(report) };
  const confirmed = confirmExports(scored, input.registry);
  return { ...confirmed, score: scoreReport(confirmed) };
}

const share = (n: number, of: number) =>
  of === 0 ? "—" : `${n}/${of} (${Math.round((n / of) * 100)} %)`;

/**
 * "Answer-engine readiness" (FULL-READ §6, ADR-020): measured shares and
 * states from data the run already collected; not scored, no new fetches.
 */
function answerEngineReadiness(
  result: RunResult,
): NonNullable<ReportJson["answerEngineReadiness"]> {
  const { pages, botFetch, llms } = result.collected;
  if (pages.status !== "ok") return [];
  const statusOf = (id: string) => {
    const row = result.statuses.find((s) => s.itemId === id);
    return row ? `${row.status}${row.note ? ` — ${row.note}` : ""}` : "not run";
  };
  const indexable = indexablePages(pages.snapshots);
  const blocked = indexable.filter((s) => snippetBlockers(s));
  const policy = botFetch.status === "ok" ? (botFetch.policyMap ?? []) : [];
  const crawlersOpen = policy.filter(
    (r) => r.robotsAllowed && r.status >= 200 && r.status < 300,
  );
  const crawlersShut = policy.filter((r) => !crawlersOpen.includes(r));
  const listed = indexable.filter(
    (s) => s.markup.counts.lists > 0 || s.markup.counts.tables > 0,
  );
  const fake = indexable.filter((s) => (s.markup.fakeListRuns ?? []).length);
  const profiles = (result.pageProfiles ?? []).filter(
    (p) => p.scope === "page",
  );
  const informational = profiles.filter((p) =>
    (INFORMATIONAL_PAGE_TYPES as readonly string[]).includes(p.pageType),
  );
  const questionSections = informational.flatMap((p) =>
    p.sections.filter((x) => x.isQuestion),
  );
  const faqs = profiles.flatMap((p) => p.faqPairs);
  const videos = profiles.filter((p) => p.videoText !== null);
  const llmsFile =
    llms.status === "ok" ? llms.files.find((f) => f.status === 200) : undefined;
  const noProfiles = "needs the LLM map stage (--llm)";
  return [
    {
      label: "Snippet-eligible pages",
      value: `${share(indexable.length - blocked.length, indexable.length)} of indexable pages${
        blocked.length
          ? `; blocked: ${blocked
              .map((s) => s.url)
              .slice(0, 5)
              .join(", ")}`
          : ""
      }`,
      itemIds: ["SUPP-13"],
    },
    {
      label: "AI crawlers allowed vs blocked",
      value:
        policy.length === 0
          ? "not collected"
          : `allowed ${crawlersOpen.map((r) => r.token).join(", ") || "none"}; blocked ${crawlersShut.map((r) => r.token).join(", ") || "none"}`,
      itemIds: ["P9-01"],
    },
    {
      label: "Key content in server HTML",
      value: statusOf("P2-01"),
      itemIds: ["P2-01"],
    },
    { label: "Opening sentence", value: statusOf("P5-01"), itemIds: ["P5-01"] },
    {
      label: "Question headings, answer-first (informational pages)",
      value: !result.pageProfiles
        ? noProfiles
        : informational.length === 0
          ? "no informational pages"
          : `${share(informational.filter((p) => p.sections.some((x) => x.isQuestion)).length, informational.length)} pages with question headings; ${share(questionSections.filter((x) => x.answerFirst).length, questionSections.length)} question sections answer first`,
      itemIds: ["SUPP-15"],
    },
    {
      label: "List / table markup",
      value: `${share(listed.length, indexable.length)} pages use list or table markup; ${fake.length} with list-like text outside it`,
      itemIds: ["SUPP-14"],
    },
    {
      label: "Stand-alone FAQ answers",
      value: !result.pageProfiles
        ? noProfiles
        : faqs.length === 0
          ? "no FAQ pairs found"
          : share(faqs.filter((f) => f.standsAlone).length, faqs.length),
      itemIds: ["P5-05", "SUPP-16"],
    },
    {
      label: "llms.txt",
      value: `${llmsFile ? `served (${llmsFile.url})` : "not served"}; ${statusOf("P9-02")}`,
      itemIds: ["P9-02"],
    },
    {
      label: "Video transcripts",
      value: !result.pageProfiles
        ? noProfiles
        : videos.length === 0
          ? "no content video pages profiled"
          : `${share(videos.filter((p) => p.videoText !== "none").length, videos.length)} video pages carry a transcript or summary as text`,
      itemIds: ["SUPP-11"],
    },
  ];
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
