// Convergence rule (B22 WO-B22-005, MAINTENANCE M6 "Convergence"): when the
// field tests say the app is done. Read from the ledger's Rounds table and
// each comparison's verdict table; never kept by hand.
import { readVerdicts, type VerdictRow } from "./field-ledger";

export type RoundSite = {
  round: string;
  tag: string;
  site: string;
  date: string;
  /** "matched", or "unmatched: <reason>". */
  scope: string;
  /** Sitemap `<loc>` count from the pre-flight; null = not recorded. */
  sitemapUrls: number | null;
  /**
   * Misses recorded on the first pass ("P3-19 WO-B21-003; …"): a verdict
   * table rerun after the fix reads `agree`, so the ledger keeps them.
   */
  recorded: string[];
};

export type SiteResult = RoundSite & {
  misses: string[];
  /** Check / collector errors of the run; null = run not on this computer. */
  errors: number | null;
  unexplained: string[];
};

export type RoundResult = {
  round: string;
  tag: string;
  sites: SiteResult[];
  /** ≥ 3 matched-scope sites. */
  valid: boolean;
  clean: boolean;
  streak: number;
};

export type ConvergenceInput = {
  rounds: RoundSite[];
  /** Verdict report text of site + date, null when missing. */
  readReport: (site: string, date: string) => string | null;
  /** Error count of the run named in the report, null when unknown. */
  runErrors: (reportText: string) => number | null;
  /** Registry ids an external check name maps to ([] = none). */
  itemsOf: (check: string) => string[];
  /** Effect of a registry id (`registry-effect.json`). */
  effectOf: (id: string) => string | undefined;
};

const MIN_SITES = 3;
const BIG_SITE = 100;
const LIVE = /live|manual|fetch|curl|browser|reproduc/i;

/** Rounds table rows ("| Round | Tag | Site | Date | Scope | Sitemap URLs | Recorded misses |"). */
export function readRounds(ledger: string): RoundSite[] {
  const lines = ledger.split("\n");
  const at = lines.findIndex((l) => /^\|\s*Round\s*\|\s*Tag\s*\|/.test(l));
  if (at < 0) return [];
  const out: RoundSite[] = [];
  for (const line of lines.slice(at + 2)) {
    if (!line.startsWith("|")) break;
    const [round, tag, site, date, scope, urls, recorded = ""] = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    out.push({
      round,
      tag,
      site,
      date,
      scope,
      sitemapUrls: /^\d+$/.test(urls ?? "") ? Number(urls) : null,
      recorded: recorded
        .split(";")
        .map((m) => m.trim())
        .filter((m) => m && m !== "—"),
    });
  }
  return out;
}

/**
 * Ranking-relevant miss: a tool-only row with verdict `fixed` or naming a
 * WO, mapped to an item whose effect is not hygiene. Unexplained: an
 * app-only row without a verdict or without a live check in its note.
 */
function judge(rows: VerdictRow[], input: ConvergenceInput) {
  const misses = rows
    .filter(
      (r) =>
        r.set === "tool-only" &&
        (r.verdict.startsWith("fixed") || /WO-B\d+-\d+/.test(r.note)) &&
        input
          .itemsOf(r.check.replace(/ \(by URL\)$/, ""))
          .some((id) => (input.effectOf(id) ?? "hygiene") !== "hygiene"),
    )
    .map((r) => r.check);
  const unexplained = rows
    .filter((r) => r.set === "app-only" && !(r.verdict && LIVE.test(r.note)))
    .map((r) => r.check);
  return { misses, unexplained };
}

export function convergence(input: ConvergenceInput) {
  const order = [...new Set(input.rounds.map((r) => r.round))];
  let streak = 0;
  const rounds: RoundResult[] = order.map((name) => {
    const members = input.rounds.filter((r) => r.round === name);
    const sites = members.map((m): SiteResult => {
      const text = input.readReport(m.site, m.date);
      if (!text)
        return { ...m, misses: [], errors: null, unexplained: ["no report"] };
      const rows = [...readVerdicts(text).values()];
      const { misses, unexplained } = judge(rows, input);
      // A recorded miss counts unless its item is hygiene-only.
      const recorded = m.recorded.filter(
        (r) => (input.effectOf(r.split(" ")[0]) ?? "search") !== "hygiene",
      );
      return {
        ...m,
        misses: [...misses, ...recorded],
        unexplained,
        errors: input.runErrors(text),
      };
    });
    const matched = sites.filter((s) => s.scope === "matched");
    const valid = matched.length >= MIN_SITES;
    const clean =
      valid &&
      matched.every(
        (s) => s.misses.length === 0 && s.errors === 0 && !s.unexplained.length,
      );
    // An unmatched round neither counts nor resets; a dirty valid one resets.
    if (valid) streak = clean ? streak + 1 : 0;
    return { round: name, tag: members[0].tag, sites, valid, clean, streak };
  });
  const tail = rounds.filter((r) => r.valid).slice(-streak || rounds.length);
  const big =
    streak > 0 &&
    tail.some((r) =>
      r.sites.some(
        (s) => s.scope === "matched" && (s.sitemapUrls ?? 0) >= BIG_SITE,
      ),
    );
  return { rounds, streak, done: streak >= 2 && big, bigSite: big };
}

export function renderConvergence(
  result: ReturnType<typeof convergence>,
): string {
  const lines = [
    "# Convergence",
    "",
    "Written by `pnpm exec tsx fork/scripts/field-test.ts --convergence` from the Rounds table in `fork/FIELD-TESTS.md` and each comparison's verdict table (never by hand). Rule: `fork/MAINTENANCE.md` M6 Convergence.",
    "",
    `Done: **${result.done ? "yes" : "no"}** · clean rounds in a row: ${result.streak} of 2 · matched site with ≥ ${BIG_SITE} sitemap URLs in the streak: ${result.bigSite ? "yes" : "no"}.`,
    "",
    "| Round | Tag | Matched sites | Valid | Ranking-relevant misses | Errors | Unexplained app-only findings | Clean | Streak |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of result.rounds) {
    const m = r.sites.filter((s) => s.scope === "matched");
    const errs = m.map((s) => s.errors);
    lines.push(
      `| ${r.round} | ${r.tag} | ${m.length} of ${r.sites.length} | ${r.valid ? "yes" : `no (< ${MIN_SITES} matched)`} | ${m.reduce((n, s) => n + s.misses.length, 0)} | ${errs.includes(null) ? `${errs.filter((e) => e === null).length} unknown` : errs.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)} | ${m.reduce((n, s) => n + s.unexplained.length, 0)} | ${r.clean ? "yes" : "no"} | ${r.streak} |`,
    );
  }
  lines.push(
    "",
    "## Per site",
    "",
    "| Round | Site | Date | Scope | Sitemap URLs | Misses | Errors | Unexplained |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const r of result.rounds)
    for (const s of r.sites)
      lines.push(
        `| ${r.round} | ${s.site} | ${s.date} | ${s.scope} | ${s.sitemapUrls ?? "?"} | ${s.misses.join("; ") || "0"} | ${s.errors ?? "unknown (run not on this computer)"} | ${s.unexplained.length ? `${s.unexplained.length}: ${s.unexplained.slice(0, 5).join("; ")}${s.unexplained.length > 5 ? " …" : ""}` : "0"} |`,
      );
  return `${lines.join("\n")}\n`;
}
