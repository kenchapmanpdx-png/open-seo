import Papa from "papaparse";
import {
  bingAiPerformanceRowSchema,
  type BingAiPerformanceRow,
} from "./contracts";

// Bing AI Performance CSV export → K10 rows (ADR-014 §3). Header-driven: each
// known column is matched by a normalised alias; unknown columns are counted,
// never stored. Pure (no DB) so the CLI can use it outside the Worker.
// Header names follow Microsoft's report labels (2026-11); the fixture is
// synthetic until the first real export pins them.

const normalise = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");

const COLUMN_ALIASES = {
  date: ["date", "day"],
  query: ["groundingquery", "groundingqueries", "query", "queries"],
  page: ["page", "pages", "url", "citedpage", "citedurl"],
  citations: ["citations", "totalcitations", "citationcount"],
  citedPages: ["citedpages", "avgcitedpages", "averagecitedpages"],
} satisfies Record<string, string[]>;
type Column = keyof typeof COLUMN_ALIASES;
const COLUMNS: Column[] = ["date", "query", "page", "citations", "citedPages"];

export type ParsedAiRow = BingAiPerformanceRow & { citedPages: number | null };

export type ParsedAiCsv = {
  rows: ParsedAiRow[];
  rowsRead: number;
  invalidRows: number;
  unknownColumns: string[];
};

function toIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  // US exports: M/D/YYYY.
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  return null;
}

function toCount(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function parseAiPerformanceCsv(text: string): ParsedAiCsv {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });
  const headers = parsed.meta.fields ?? [];
  const columnOf = new Map<Column, string>();
  const unknownColumns: string[] = [];
  for (const header of headers) {
    const key = normalise(header);
    const column = COLUMNS.find((name) => COLUMN_ALIASES[name].includes(key));
    if (column && !columnOf.has(column)) columnOf.set(column, header);
    else unknownColumns.push(header);
  }

  const cell = (record: Record<string, string>, column: Column) => {
    const header = columnOf.get(column);
    return header === undefined ? undefined : record[header];
  };

  const rows: ParsedAiRow[] = [];
  let invalidRows = 0;
  for (const record of parsed.data) {
    const candidate = {
      date: toIsoDate(cell(record, "date") ?? ""),
      query: cell(record, "query")?.trim() || null,
      page: cell(record, "page")?.trim() || null,
      citations: toCount(cell(record, "citations")),
    };
    const row = bingAiPerformanceRowSchema.safeParse(candidate);
    if (!row.success) {
      invalidRows += 1;
      continue;
    }
    const citedPages = toCount(cell(record, "citedPages"));
    rows.push({
      ...row.data,
      citedPages: citedPages === null ? null : Math.round(citedPages),
    });
  }
  return { rows, rowsRead: parsed.data.length, invalidRows, unknownColumns };
}

export type AiCitationDayRow = {
  day: string;
  citations: number;
  citedPages: number | null;
};
export type AiGroundingQueryRow = {
  periodStart: string;
  periodEnd: string;
  query: string;
  citations: number;
};

/**
 * Dated rows without query/page → citation days; query rows → grounding
 * queries (period = the row's date, else the export period); the rest
 * (page-only rows, undated queries without a period) are not stored.
 */
export function splitAiRows(
  rows: ParsedAiRow[],
  period?: { start: string; end: string },
) {
  const days = new Map<string, AiCitationDayRow>();
  const queries = new Map<string, AiGroundingQueryRow>();
  let unstored = 0;
  for (const row of rows) {
    if (row.query) {
      const start = row.date ?? period?.start;
      const end = row.date ?? period?.end;
      if (!start || !end) {
        unstored += 1;
        continue;
      }
      queries.set(`${start}\u0000${end}\u0000${row.query}`, {
        periodStart: start,
        periodEnd: end,
        query: row.query,
        citations: row.citations,
      });
    } else if (row.date && !row.page) {
      days.set(row.date, {
        day: row.date,
        citations: row.citations,
        citedPages: row.citedPages,
      });
    } else {
      unstored += 1;
    }
  }
  return { days: [...days.values()], queries: [...queries.values()], unstored };
}
