// Field-test verdict table and ledger (B18 WO-B18-009, loop M6). Every miss
// both ways gets one row; a comparison closes only when every row has a
// verdict (Ken 2026-11-22: learn from every comparison).
import type { compareExport } from "./external-audit";

export const VERDICTS = [
  "agree",
  "fixed",
  "skip",
  "site-changed",
  "tool-wrong",
  "owner-only",
] as const;

type Set = "agree" | "tool-only" | "app-only";
export type VerdictRow = {
  key: string;
  set: Set;
  check: string;
  count: number;
  verdict: string;
  note: string;
};

const START = "<!-- field-test:verdicts -->";
const END = "<!-- /field-test:verdicts -->";
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** One row per export issue (agree / tool-only) and per app-only finding. */
export function buildRows(
  result: ReturnType<typeof compareExport>,
): VerdictRow[] {
  const rows: VerdictRow[] = [];
  for (const i of result.issues) {
    if (i.failed > 0 && i.caught)
      rows.push(row("agree", i.name, i.failed, "agree", ""));
  }
  for (const i of result.handbookMissed)
    rows.push(
      row("tool-only", i.name, i.failed, "", `maps to ${i.ids.join(", ")}`),
    );
  for (const i of result.noHandbookItem) {
    const unknown = i.reason.startsWith("unknown");
    rows.push(
      row("tool-only", i.name, i.failed, unknown ? "" : "skip", i.reason),
    );
  }
  // Keyed by title without its counts: F-codes renumber between runs.
  for (const f of result.handbookOnly)
    rows.push({
      ...row("app-only", `${f.code} ${f.title}`, 1, "", ""),
      key: `app:${f.title.replace(/\s*\([^)]*\d[^)]*\)/g, "").replace(/\d+/g, "N")}`,
    });
  return rows;
}

function row(
  set: Set,
  check: string,
  count: number,
  verdict: string,
  note: string,
): VerdictRow {
  return {
    key: `${set === "app-only" ? "app" : "tool"}:${check}`,
    set,
    check,
    count,
    verdict,
    note,
  };
}

/** Verdicts and notes already written in `text` (a field report), by key. */
export function readVerdicts(text: string): Map<string, VerdictRow> {
  const out = new Map<string, VerdictRow>();
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start < 0 || end < start) return out;
  for (const line of text.slice(start, end).split("\n")) {
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      // Prettier escapes markdown (`\*`, `\_`, `\|`) in table cells.
      .map((c) => c.trim().replace(/\\([\\`*_[\]()#+\-.!|])/g, "$1"));
    if (cells.length !== 6 || !cells[0].includes(":")) continue;
    const [key, set, check, count, verdict, note] = cells;
    out.set(key, {
      key,
      set: set as Set,
      check,
      count: Number(count),
      verdict,
      note,
    });
  }
  return out;
}

/** Fresh rows keep the verdict and note written on an earlier pass. */
export function mergeVerdicts(
  rows: VerdictRow[],
  prior: Map<string, VerdictRow>,
): VerdictRow[] {
  return rows.map((r) => {
    const old = prior.get(r.key);
    return old && old.verdict
      ? { ...r, verdict: old.verdict, note: old.note || r.note }
      : r;
  });
}

export function openRows(rows: VerdictRow[]): VerdictRow[] {
  return rows.filter((r) => !VERDICTS.some((v) => r.verdict.startsWith(v)));
}

export function renderSection(rows: VerdictRow[]): string {
  return [
    START,
    "",
    `Verdicts: ${VERDICTS.join(" · ")}. Open rows: ${openRows(rows).length}.`,
    "",
    "| Key | Set | Check | Count | Verdict | Note |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${cell(r.key)} | ${r.set} | ${cell(r.check)} | ${r.count} | ${cell(r.verdict)} | ${cell(r.note)} |`,
    ),
    "",
    END,
  ].join("\n");
}

/** Replaces the verdict section of a field report, or appends it. */
export function upsertSection(
  text: string | null,
  section: string,
  title: string,
): string {
  if (!text)
    return `${title}\n\n## Verdicts (by field-test.ts)\n\n${section}\n`;
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start >= 0 && end > start)
    return text.slice(0, start) + section + text.slice(end + END.length);
  return `${text.trimEnd()}\n\n## Verdicts (by field-test.ts)\n\n${section}\n`;
}

export type LedgerRow = {
  site: string;
  date: string;
  tool: string;
  pagesApp: number | string;
  pagesTool: number | string;
  agree: number;
  appOnly: number;
  toolOnly: number;
  unknown: number;
  wos: string;
  open: number;
};

const LEDGER_HEADER = [
  "| Site | Date | Tool | Pages app | Pages tool | Agree | App only | Tool only | Unknown names | WOs | Open rows |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];

export function ledgerRow(
  site: string,
  date: string,
  tool: string,
  rows: VerdictRow[],
  pages: { app: number | string; tool: number | string },
): LedgerRow {
  const notes = rows.map((r) => `${r.verdict} ${r.note}`).join(" ");
  return {
    site,
    date,
    tool,
    pagesApp: pages.app,
    pagesTool: pages.tool,
    agree: rows.filter((r) => r.set === "agree").length,
    appOnly: rows.filter((r) => r.set === "app-only").length,
    toolOnly: rows.filter((r) => r.set === "tool-only").length,
    unknown: rows.filter((r) => r.note.startsWith("unknown")).length,
    wos: [...new Set(notes.match(/WO-B\d+-\d+/g) ?? [])].join(", ") || "—",
    open: openRows(rows).length,
  };
}

/** Ledger text with `row` replacing the same site + date, or appended. */
export function upsertLedger(text: string, row: LedgerRow): string {
  const line = `| ${row.site} | ${row.date} | ${row.tool} | ${row.pagesApp} | ${row.pagesTool} | ${row.agree} | ${row.appOnly} | ${row.toolOnly} | ${row.unknown} | ${row.wos} | ${row.open} |`;
  const lines = text.split("\n");
  // Cells trimmed: prettier pads the columns.
  const cellsOf = (l: string) => l.split("|").map((c) => c.trim());
  const at = lines.findIndex((l) => {
    const c = cellsOf(l);
    return c[1] === row.site && c[2] === row.date;
  });
  if (at >= 0) lines[at] = line;
  else {
    let headerAt = lines.findIndex((l) => {
      const c = cellsOf(l);
      return c[1] === "Site" && c[2] === "Date";
    });
    if (headerAt < 0) {
      lines.push("", ...LEDGER_HEADER);
      headerAt = lines.length - 2;
    }
    let end = headerAt + 2;
    while (end < lines.length && lines[end].startsWith("|")) end++;
    lines.splice(end, 0, line);
  }
  return lines.join("\n");
}
