import type {
  CheckContext,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import {
  INFORMATIONAL_PAGE_TYPES,
  type PageProfile,
} from "@/server/features/handbook/contracts/page-profile";
import type { Severity } from "@/server/features/handbook/contracts/registry-types";
import { foldText } from "../engine/text-fold";
import { createResult, normalizeUrl, siteUrl } from "./support";

/**
 * Answer-engine set (FULL-READ §6, ADR-020, handbook §3/§16). Not scored.
 * SUPP-13: snippet blockers on an indexable page — `nosnippet` or
 *   `max-snippet` 0–159 (robots meta, a UA-specific meta such as
 *   `googlebot`, or `X-Robots-Tag` with or without a UA prefix), or
 *   `data-nosnippet` over 20 % of the page's words or around the first
 *   answer paragraph (`markup.firstAnswerNosnippet`). Asked as "intended?";
 *   S2 on home / service / product pages, S3 elsewhere.
 * SUPP-14: ≥ 3 consecutive lines that read as a list ("•", "1.", "Step 2")
 *   outside `<ul>` / `<ol>` (raw-HTML parse, `markup.fakeListRuns`).
 * SUPP-15: informational page (PageProfile.pageType guide / article / faq /
 *   explainer) whose ≥ 2 H2/H3s include no question, or question sections whose
 *   first sentences do not answer them.
 * SUPP-16: FAQ answers that lean on "above" / "this" / a bare "Yes.", run
 *   < 15 or > 120 words, or are missing from the raw HTML.
 * SUPP-15 / SUPP-16 read the map stage's PageProfiles (no judge call).
 */
const ITEMS = ["SUPP-13", "SUPP-14", "SUPP-15", "SUPP-16"];
const MAX_EVIDENCE = 10;
/** `max-snippet` below this cuts a typical answer sentence (Google: −1 = no limit). */
const MIN_SNIPPET_CHARS = 160;
const MAX_NOSNIPPET_SHARE = 0.2;
const FAQ_MIN_WORDS = 15;
const FAQ_MAX_WORDS = 120;
/** SUPP-15 judges heading style only on pages with this many H2/H3s. */
const MIN_SUBHEADS = 2;
const KEY_PAGE_TYPES = new Set(["home", "service", "product"]);
const QUESTION_HEADING =
  /\?\s*$|^(how|what|why|when|where|who|which|can|could|do|does|did|is|are|should|will|would)\b/i;

type Out = ReturnType<typeof createResult>;

const isNoindex = (s: PageSnapshot) =>
  /noindex|\bnone\b/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`);

/** Robots directive sources: generic meta, bot-specific metas, X-Robots-Tag. */
function robotsLines(s: PageSnapshot): string[] {
  const out: string[] = [];
  if (s.head.robotsMeta)
    out.push(`<meta name="robots" content="${s.head.robotsMeta}">`);
  for (const [name, content] of Object.entries(s.head.meta))
    if (/bot/.test(name))
      out.push(`<meta name="${name}" content="${content}">`);
  if (s.xRobotsTag) out.push(`X-Robots-Tag: ${s.xRobotsTag}`);
  return out;
}

const blocksSnippet = (line: string) =>
  /(^|[\s,:"])nosnippet\b/i.test(line) ||
  [...line.matchAll(/max-snippet\s*:\s*(-?\d+)/gi)].some((m) => {
    const n = Number(m[1]);
    return n >= 0 && n < MIN_SNIPPET_CHARS;
  });

/**
 * Why a page's text cannot be quoted in snippets / AI answers, or null.
 * Shared with the "Answer-engine readiness" section.
 */
export function snippetBlockers(s: PageSnapshot): string[] | null {
  const reasons = robotsLines(s).filter(blocksSnippet);
  const hidden = s.markup.nosnippetWords ?? 0;
  if (s.wordsRaw > 0 && hidden / s.wordsRaw > MAX_NOSNIPPET_SHARE)
    reasons.push(
      `data-nosnippet covers ${hidden} of ${s.wordsRaw} words (${Math.round((hidden / s.wordsRaw) * 100)} %)`,
    );
  else if (s.markup.firstAnswerNosnippet)
    reasons.push(
      `data-nosnippet covers the first answer paragraph: "${s.markup.firstAnswerNosnippet}"`,
    );
  return reasons.length > 0 ? reasons : null;
}

/** Indexable HTML 200 pages: the pages snippet rules apply to. */
export const indexablePages = (snapshots: readonly PageSnapshot[]) =>
  snapshots.filter(
    (s) =>
      s.status === 200 &&
      /html/i.test(s.contentType ?? "text/html") &&
      !isNoindex(s),
  );

function profilesByUrl(ctx: CheckContext) {
  return new Map(
    (ctx.pageProfiles ?? [])
      .filter((p) => p.scope === "page")
      .map((p) => [normalizeUrl(p.url), p]),
  );
}

function snippets(
  pages: readonly PageSnapshot[],
  profiles: Map<string, PageProfile>,
  origin: string,
  out: Out,
) {
  const hits = pages.flatMap((s) => {
    const reasons = snippetBlockers(s);
    return reasons ? [{ s, reasons }] : [];
  });
  if (hits.length === 0) return;
  const home = normalizeUrl(siteUrl(origin));
  const keyPage = (s: PageSnapshot) =>
    normalizeUrl(s.url) === home ||
    KEY_PAGE_TYPES.has(profiles.get(normalizeUrl(s.url))?.pageType ?? "");
  for (const severity of ["S2", "S3"] as Severity[]) {
    const group = hits.filter((h) => keyPage(h.s) === (severity === "S2"));
    if (group.length === 0) continue;
    out.finding({
      itemIds: ["SUPP-13"],
      severity,
      ...(severity === "S2"
        ? { severityReason: "home / service / product page" }
        : {}),
      title:
        "Snippet blockers: these pages block AI answers + search snippets — intended?",
      detail: group
        .map(({ s, reasons }) => `${s.url} — ${reasons.join("; ")}`)
        .join("\n"),
      fix: "If the block is not deliberate, remove `nosnippet`, raise `max-snippet` to -1 (no limit) and keep `data-nosnippet` to the parts that must not be quoted. Google AI Overviews / AI Mode, featured snippets and Bing Copilot answers all honour these controls.",
      fixability: "FIXABLE",
      effort: "S",
      urls: group.map(({ s }) => s.url),
      evidenceRefs: group
        .slice(0, MAX_EVIDENCE)
        .map(({ s, reasons }) =>
          out.evidence(
            reasons.some((r) => r.startsWith("X-Robots-Tag"))
              ? "header"
              : "rawHtml",
            s.url,
            reasons.join("\n"),
            s.rawKey,
          ),
        ),
    });
  }
}

const runs = (s: PageSnapshot) => s.markup.fakeListRuns ?? [];

function fakeLists(pages: readonly PageSnapshot[], out: Out) {
  const hits = pages.filter((s) => runs(s).length > 0);
  if (hits.length === 0) return;
  out.finding({
    itemIds: ["SUPP-14"],
    severity: "S4",
    title: "List or step content not in list markup",
    detail: hits
      .map(
        (s) =>
          `${s.url} — ${runs(s)
            .map((r) => `${r.lines} lines: "${r.sample}"`)
            .join("; ")}`,
      )
      .join("\n"),
    fix: "Mark steps up as `<ol>` and other lists as `<ul>` with one `<li>` per item instead of bullet characters or numbers separated by `<br>` / paragraphs; answer engines lift real lists as lists.",
    fixability: "FIXABLE",
    effort: "S",
    urls: hits.map((s) => s.url),
    evidenceRefs: hits.slice(0, MAX_EVIDENCE).map((s) =>
      out.evidence(
        "rawHtml",
        s.url,
        runs(s)
          .map((r) => r.sample)
          .join("\n"),
        s.rawKey,
      ),
    ),
  });
}

const isInformational = (p: PageProfile) =>
  (INFORMATIONAL_PAGE_TYPES as readonly string[]).includes(p.pageType);

function questionHeadings(
  pages: readonly PageSnapshot[],
  profiles: Map<string, PageProfile>,
  out: Out,
) {
  const hits = pages.flatMap((s) => {
    const p = profiles.get(normalizeUrl(s.url));
    if (!p || !isInformational(p)) return [];
    const subheads = s.markup.headings.filter(
      (h) => (h.level === 2 || h.level === 3) && h.landmark === null,
    );
    const asked =
      subheads.some((h) => QUESTION_HEADING.test(h.text)) ||
      p.sections.some((x) => x.isQuestion);
    const buried = p.sections.filter((x) => x.isQuestion && !x.answerFirst);
    const reasons = [
      // A page without subheadings is not a sectioned guide; nothing to phrase.
      ...(asked || subheads.length < MIN_SUBHEADS
        ? []
        : ["no question-style H2/H3"]),
      ...(buried.length
        ? [
            `answer not in the first sentences under ${buried.map((x) => `"${x.heading}"`).join(", ")}`,
          ]
        : []),
    ];
    if (reasons.length === 0) return [];
    return [{ s, p, reasons }];
  });
  if (hits.length === 0) return;
  out.finding({
    itemIds: ["SUPP-15"],
    severity: "S4",
    title:
      "Informational page without question headings or answer-first sections",
    detail: hits
      .map(
        ({ s, p, reasons }) =>
          `${s.url} (${p.pageType}) — ${reasons.join("; ")}`,
      )
      .join("\n"),
    fix: "Phrase the main H2/H3s as the questions readers ask and answer each in the first one or two sentences below it, then add detail.",
    fixability: "FIXABLE",
    effort: "M",
    urls: hits.map(({ s }) => s.url),
    evidenceRefs: hits
      .slice(0, MAX_EVIDENCE)
      .map(({ s, p }) =>
        out.evidence(
          "textQuote",
          s.url,
          [
            ...s.markup.headings
              .filter((h) => h.level <= 3 && h.landmark === null)
              .map((h) => `H${h.level}: ${h.text}`),
            ...p.sections
              .filter((x) => !x.answerFirst)
              .map((x) => `"${x.heading}" opens: ${x.quote}`),
          ].join("\n"),
          s.rawKey,
        ),
      ),
  });
}

const squash = foldText;
/** markup.text is capped at 20 000 chars: past it "missing" cannot be told. */
const RAW_TEXT_CAP = 20_000;

function faqAnswers(
  pages: readonly PageSnapshot[],
  profiles: Map<string, PageProfile>,
  out: Out,
) {
  const hits = pages.flatMap((s) => {
    const p = profiles.get(normalizeUrl(s.url));
    if (!p) return [];
    const raw = squash(s.markup.text);
    const complete = s.markup.text.length < RAW_TEXT_CAP;
    const bad = p.faqPairs.flatMap((f) => {
      const why = [
        ...(f.standsAlone ? [] : ["does not stand alone"]),
        ...(f.answerWords < FAQ_MIN_WORDS || f.answerWords > FAQ_MAX_WORDS
          ? [`${f.answerWords} words`]
          : []),
        ...(complete && !raw.includes(squash(f.quote))
          ? ["not in raw HTML"]
          : []),
      ];
      return why.length ? [{ f, why }] : [];
    });
    return bad.length ? [{ s, bad }] : [];
  });
  if (hits.length === 0) return;
  out.finding({
    itemIds: ["SUPP-16"],
    severity: "S4",
    title: "FAQ answers that don't stand alone or are missing from raw HTML",
    detail: hits
      .map(
        ({ s, bad }) =>
          `${s.url} — ${bad.map(({ f, why }) => `"${f.question}": ${why.join(", ")}`).join("; ")}`,
      )
      .join("\n"),
    fix: `Write each answer so it reads correctly when quoted alone (repeat the subject instead of "this" / "above", no bare "Yes."), keep it ${FAQ_MIN_WORDS}–${FAQ_MAX_WORDS} words, and ship it in the server HTML rather than loading it on click.`,
    fixability: "FIXABLE",
    effort: "S",
    urls: hits.map(({ s }) => s.url),
    evidenceRefs: hits
      .slice(0, MAX_EVIDENCE)
      .map(({ s, bad }) =>
        out.evidence(
          "textQuote",
          s.url,
          bad.map(({ f }) => `Q: ${f.question}\nA: ${f.quote}`).join("\n"),
          s.rawKey,
        ),
      ),
  });
}

export const suppAeoCheck: HandbookCheck = {
  id: "crawl.supp-aeo",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const indexable = indexablePages(pages.snapshots);
    const profiles = profilesByUrl(ctx);
    snippets(indexable, profiles, ctx.origin, out);
    fakeLists(indexable, out);
    if (!ctx.pageProfiles) {
      for (const id of ["SUPP-15", "SUPP-16"])
        out.blocked(id, "needs PageProfiles from the LLM map stage (not run)");
      return out.build();
    }
    questionHeadings(indexable, profiles, out);
    faqAnswers(indexable, profiles, out);
    return out.build();
  },
};
