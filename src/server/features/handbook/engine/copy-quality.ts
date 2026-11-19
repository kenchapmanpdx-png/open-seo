import { sort } from "remeda";
import type {
  CollectedData,
  PageSnapshot,
  TemplatesData,
} from "@/server/features/handbook/contracts/collectors";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import {
  COPY_METRIC_IDS,
  type CopyMetric,
  type CopyPage,
  type CopyQuality,
} from "@/server/features/handbook/contracts/scaled-copy";
import { indexablePages } from "../checks/supp-aeo";
import { normalizeUrl } from "../checks/support";
import { measureProse, proseWords } from "./copy-metrics";
import { copyQualityEvidence } from "./evidence";
import type { HandbookRuntime, RunInput } from "./runner";

/**
 * Copy quality section (fork/SCALED-COPY.md §4, ADR-023): deterministic, no
 * LLM, no fetch, not scored. Prose = the page's `<p>` paragraphs minus its
 * template's boilerplate blocks.
 */
export const COPY_QUALITY_ENV = "HANDBOOK_COPY_QUALITY";

/** §4.4, verbatim. */
export const COPY_QUALITY_LABEL =
  "Copy quality — not scored. Ranking effect: SPECULATIVE. Thresholds come from studies of articles and are not validated (guide §14 G-10). These numbers describe wording patterns only; they say nothing about who or what wrote a page.";

const MIN_PROSE_WORDS = 200;
/** K14 names for contact / legal / listing-index pages (ADR-023). */
const SKIPPED_PAGE_TYPES = new Set(["contact", "legal", "category"]);

/** `HANDBOOK_COPY_QUALITY=on` (default off). */
export const copyQualityEnvOn = (env: string | undefined) =>
  env?.trim().toLowerCase() === "on";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = sort(values, (a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1
      ? (sorted[mid] ?? 0)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return Math.round(value * 100) / 100;
}

function medians(pages: readonly { metrics: CopyMetric[] }[]) {
  return COPY_METRIC_IDS.map((id) => ({
    id,
    value: median(
      pages.flatMap((p) =>
        p.metrics
          .filter((m) => m.id === id && m.value !== null)
          .map((m) => m.value ?? 0),
      ),
    ),
  }));
}

function measurePage(
  snapshot: PageSnapshot,
  template: { key: string; boilerplate: ReadonlySet<string> } | undefined,
  profile: PageProfile | undefined,
): CopyPage {
  const base = { url: snapshot.url, template: template?.key ?? null };
  const lang = snapshot.head.lang?.trim().toLowerCase();
  if (lang && !lang.startsWith("en"))
    return { ...base, measured: false, reason: "language" };
  if (profile && SKIPPED_PAGE_TYPES.has(profile.pageType))
    return {
      ...base,
      measured: false,
      reason: `page type ${profile.pageType}`,
    };
  const prose = (snapshot.markup.prose ?? []).filter(
    (p) => !template?.boilerplate.has(p.text),
  );
  const words = proseWords(prose);
  if (words < MIN_PROSE_WORDS)
    return {
      ...base,
      measured: false,
      reason: `prose words < ${MIN_PROSE_WORDS}`,
    };
  const metrics = measureProse(prose);
  return {
    ...base,
    measured: true,
    proseWords: words,
    metrics,
    overCount: metrics.filter((m) => m.over && m.threshold !== null).length,
  };
}

/** The section plus its artifact evidence row (runner, option on). */
export async function runCopyQuality(
  input: RunInput,
  runtime: HandbookRuntime,
  collected: CollectedData,
  profiles: readonly PageProfile[] | undefined,
) {
  const section = buildCopyQuality({
    snapshots: collected.pages.status === "ok" ? collected.pages.snapshots : [],
    templates:
      collected.templates.status === "ok" ? collected.templates.templates : [],
    profiles,
  });
  return {
    section,
    evidence: await copyQualityEvidence(input, runtime, section),
  };
}

/** The §4.4 section over indexable HTML pages. Same input → same output. */
export function buildCopyQuality(input: {
  snapshots: readonly PageSnapshot[];
  templates: TemplatesData["templates"];
  profiles?: readonly PageProfile[];
}): CopyQuality {
  const templateOf = new Map<
    string,
    { key: string; boilerplate: ReadonlySet<string> }
  >();
  for (const t of input.templates) {
    const entry = { key: t.key, boilerplate: new Set(t.boilerplate?.blocks) };
    for (const url of t.urls) templateOf.set(url, entry);
  }
  const profileOf = new Map(
    (input.profiles ?? [])
      .filter((p) => p.scope === "page")
      .map((p) => [normalizeUrl(p.url), p]),
  );
  const pages = indexablePages(input.snapshots).map((s) =>
    measurePage(s, templateOf.get(s.url), profileOf.get(normalizeUrl(s.url))),
  );
  const measured = pages.flatMap((p) => (p.measured ? [p] : []));
  const byTemplate = new Map<string, typeof measured>();
  for (const p of measured) {
    if (p.template === null) continue;
    byTemplate.set(p.template, [...(byTemplate.get(p.template) ?? []), p]);
  }
  return {
    label: COPY_QUALITY_LABEL,
    medians: medians(measured),
    byTemplate: sort([...byTemplate], ([a], [b]) => a.localeCompare(b)).map(
      ([template, list]) => ({ template, medians: medians(list) }),
    ),
    pages: sort(pages, (a, b) => {
      if (a.measured !== b.measured) return a.measured ? -1 : 1;
      const over =
        (b.measured ? b.overCount : 0) - (a.measured ? a.overCount : 0);
      return over !== 0 ? over : a.url.localeCompare(b.url);
    }),
  };
}
