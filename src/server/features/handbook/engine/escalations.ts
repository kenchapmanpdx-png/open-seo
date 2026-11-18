import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { Escalation } from "@/server/features/handbook/contracts/exports";
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
  fire: (collected: CollectedData) => Fired[];
};

type Template = { key: string; urls: string[]; rank1: string | null };

function templatesOf(collected: CollectedData): Template[] {
  const t = collected.templates;
  if (t.status !== "ok") return [];
  return t.templates.map((tpl) => ({
    key: tpl.key,
    urls: [...tpl.urls],
    rank1: tpl.samples.find((s) => s.rank === 1)?.url ?? null,
  }));
}

/** Rendered pages by normalized URL (empty without a render). */
function renderedOf(collected: CollectedData) {
  const r = collected.render;
  return new Map(
    r.status === "ok" ? r.pages.map((p) => [normalizeUrl(p.url), p]) : [],
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
];

/** Every rule over what was collected; one log line per fired escalation. */
export function collectEscalations(collected: CollectedData): Escalation[] {
  return ESCALATION_RULES.flatMap((rule) =>
    rule.fire(collected).map((f) => {
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
