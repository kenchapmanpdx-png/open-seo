import { sort } from "remeda";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type {
  Escalation,
  HandbookDepth,
} from "@/server/features/handbook/contracts/exports";
import type { LighthouseData } from "@/server/features/handbook/contracts/render-data";
import { normalizeUrl } from "@/server/features/handbook/checks/support";
import { isWordDrift } from "@/server/features/handbook/checks/render-parity";

/**
 * Escalation table (ADR-021, FULL-READ §4) as data: each rule reads what was
 * collected and returns the groups it fires for. Every fired group becomes
 * one `Escalation` in the report ("Escalated: … because …"). Shared by the
 * render (WO-B9-005), Lighthouse (007), bot-parity (009) and .md-mirror (014)
 * escalations.
 */
type Fired = { because: string; urls: string[]; capped: boolean };

type EscalationRule = {
  trigger: string;
  action: string;
  /** Most URLs one fired group may act on; null = no cap. */
  cap: number | null;
  fire: (collected: CollectedData, depth: HandbookDepth) => Fired[];
};

type Template = { key: string; urls: string[]; rank1: string | null };

function templatesOf(collected: Partial<CollectedData>): Template[] {
  const t = collected.templates;
  if (t?.status !== "ok") return [];
  return t.templates.map((tpl) => ({
    key: tpl.key,
    urls: [...tpl.urls],
    rank1: tpl.samples.find((s) => s.rank === 1)?.url ?? null,
  }));
}

/** Rendered pages by normalized URL (empty without a render). */
function renderedOf(collected: Partial<CollectedData>) {
  const r = collected.render;
  return new Map(
    r?.status === "ok" ? r.pages.map((p) => [normalizeUrl(p.url), p]) : [],
  );
}

/** Lighthouse at `full` (FULL-READ §2, §4 rows 5–6; ADR-018). */
const LH_RANK1_CAP = 15;
const LH_HEAVIEST = 3;
const LH_SLOW_LCP_MS = 4000;
const LH_MORE_PER_TEMPLATE = 2;
const LH_SLOW_CAP = 10;
const LH_HEAVY_BYTES = 5_000_000;
const LH_HEAVY_CAP = 5;

const weightOf = (p: { js: { pageWeightBytes?: number | null } }) =>
  p.js.pageWeightBytes ?? 0;

/**
 * Mobile Lighthouse base set at `full`: rank-1 of every template (cap 15)
 * then the 3 heaviest rendered pages, deduped. The collector runs it; the
 * escalation rules recompute it to tell base runs from escalated ones.
 */
export function lighthouseMobileBase(
  collected: Partial<CollectedData>,
): string[] {
  const rank1 = templatesOf(collected)
    .flatMap((t) => (t.rank1 ? [t.rank1] : []))
    .slice(0, LH_RANK1_CAP);
  const heaviest = sort(
    [...renderedOf(collected).values()].filter((p) => weightOf(p) > 0),
    (a, b) => weightOf(b) - weightOf(a),
  )
    .slice(0, LH_HEAVIEST)
    .map((p) => p.url);
  const seen = new Set<string>();
  return [...rank1, ...heaviest].filter((u) => {
    const key = normalizeUrl(u);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/**
 * Lighthouse escalations from the base mobile runs: a template whose base
 * run has LCP > 4 s gets 2 more of its rendered pages (cap +10 overall);
 * every rendered page over 5 MB gets its own run (cap +5; already measured
 * pages count as done).
 */
export function lighthouseEscalations(
  collected: Partial<CollectedData>,
  baseRuns: LighthouseData["pages"],
): { slow: Fired[]; heavy: Fired[] } {
  const base = new Set(lighthouseMobileBase(collected).map(normalizeUrl));
  const rendered = renderedOf(collected);
  let budget = LH_SLOW_CAP;
  const slow = templatesOf(collected).flatMap((tpl): Fired[] => {
    const inTpl = new Set(tpl.urls.map(normalizeUrl));
    const run = sort(
      baseRuns.filter(
        (r) =>
          r.formFactor === "mobile" &&
          inTpl.has(normalizeUrl(r.url)) &&
          (r.lcpMs ?? 0) > LH_SLOW_LCP_MS,
      ),
      (a, b) => (b.lcpMs ?? 0) - (a.lcpMs ?? 0),
    ).at(0);
    if (!run) return [];
    const more = tpl.urls
      .filter((u) => !base.has(normalizeUrl(u)))
      .filter((u) => rendered.size === 0 || rendered.has(normalizeUrl(u)))
      .slice(0, LH_MORE_PER_TEMPLATE);
    if (more.length === 0) return [];
    const urls = more.slice(0, budget);
    budget -= urls.length;
    return [
      {
        because: `template ${tpl.key} page ${run.url} has lab LCP ${Math.round(run.lcpMs ?? 0)} ms (> 4 s)`,
        urls,
        capped: urls.length < more.length,
      },
    ];
  });
  const heavyPages = sort(
    [...rendered.values()].filter((p) => weightOf(p) > LH_HEAVY_BYTES),
    (a, b) => weightOf(b) - weightOf(a),
  );
  const heavy: Fired[] =
    heavyPages.length === 0
      ? []
      : [
          {
            because: heavyPages
              .map((p) => `${p.url} weighs ${mb(weightOf(p))} (> 5 MB)`)
              .join("; "),
            urls: heavyPages.slice(0, LH_HEAVY_CAP).map((p) => p.url),
            capped: heavyPages.length > LH_HEAVY_CAP,
          },
        ];
  return { slow, heavy };
}

/** Base mobile runs of a finished `full` Lighthouse collector. */
function baseRunsOf(collected: CollectedData): LighthouseData["pages"] {
  if (collected.lighthouse.status !== "ok") return [];
  const base = new Set(lighthouseMobileBase(collected).map(normalizeUrl));
  return collected.lighthouse.pages.filter(
    (r) => r.formFactor === "mobile" && base.has(normalizeUrl(r.url)),
  );
}

/** The template's pages that were rendered; capped when some were not. */
function actedOn(
  tpl: Template,
  rendered: ReturnType<typeof renderedOf>,
): { urls: string[]; capped: boolean } {
  const urls = tpl.urls.filter((u) => rendered.has(normalizeUrl(u)));
  return { urls, capped: urls.length < tpl.urls.length };
}

const ESCALATION_RULES: readonly EscalationRule[] = [
  {
    // RenderData has no JS-off opacity count (contracts 1.5.1), so the rank-1
    // page's opacity:0 words after load stand in for "hidden without JS":
    // a reveal that needs JavaScript leaves that text hidden when JS is off.
    trigger: "template-hidden-text",
    action: "JS-off render all pages of that template",
    cap: null,
    fire(collected) {
      const rendered = renderedOf(collected);
      return templatesOf(collected).flatMap((tpl) => {
        const page = tpl.rank1 ? rendered.get(normalizeUrl(tpl.rank1)) : null;
        if (!page || page.js.opacityZeroWords === 0 || tpl.urls.length < 2)
          return [];
        return [
          {
            because: `template ${tpl.key} rank-1 page ${page.url} has ${page.js.opacityZeroWords} words at opacity:0 after load`,
            ...actedOn(tpl, rendered),
          },
        ];
      });
    },
  },
  {
    trigger: "render-word-gap",
    action: "render diff stored for every page of that template",
    cap: null,
    fire(collected) {
      const rendered = renderedOf(collected);
      const pages = collected.pages;
      if (pages.status !== "ok") return [];
      const rawWords = new Map(
        pages.snapshots.map((s) => [normalizeUrl(s.url), s.wordsRaw]),
      );
      return templatesOf(collected).flatMap((tpl) => {
        const gap = tpl.urls.find((u) => {
          const page = rendered.get(normalizeUrl(u));
          const raw = rawWords.get(normalizeUrl(u));
          return page && raw !== undefined && isWordDrift(raw, page.js.words);
        });
        if (!gap || tpl.urls.length < 2) return [];
        const page = rendered.get(normalizeUrl(gap));
        return [
          {
            because: `${gap} raw ${rawWords.get(normalizeUrl(gap))} vs rendered ${page?.js.words} words (> 20 % apart)`,
            ...actedOn(tpl, rendered),
          },
        ];
      });
    },
  },
  {
    // Lighthouse escalations run inside the `full` Lighthouse collector
    // (quick keeps home + 2 samples and escalates nothing).
    trigger: "template-slow-lcp",
    action: "Lighthouse on 2 more pages of that template",
    cap: null,
    fire: (collected, depth) =>
      depth === "full"
        ? lighthouseEscalations(collected, baseRunsOf(collected)).slow
        : [],
  },
  {
    trigger: "page-weight-over-5mb",
    action: "Lighthouse on that page",
    cap: null,
    fire: (collected, depth) =>
      depth === "full"
        ? lighthouseEscalations(collected, baseRunsOf(collected)).heavy
        : [],
  },
];

/** Every rule over what was collected; one log line per fired escalation. */
export function collectEscalations(
  collected: CollectedData,
  depth: HandbookDepth = "quick",
): Escalation[] {
  return ESCALATION_RULES.flatMap((rule) =>
    rule.fire(collected, depth).map((f) => {
      const capped =
        f.capped || (rule.cap !== null && f.urls.length > rule.cap);
      const escalation: Escalation = {
        trigger: rule.trigger,
        because: f.because,
        action: rule.action,
        urls: rule.cap === null ? f.urls : f.urls.slice(0, rule.cap),
        capped,
      };
      log(escalation);
      return escalation;
    }),
  );
}

function log(e: Escalation) {
  console.info(
    `[handbook] Escalated: ${e.action} because ${e.because} (${e.urls.length} URLs${e.capped ? ", capped" : ""})`,
  );
}
