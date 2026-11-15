// Ported from Canonry/canonry@4b91e077 packages/integration-commoncrawl/src/{release-id,reverse-domain,constants}.ts — MIT, © 2026 Arber X and contributors
// Licensed under the MIT License (https://opensource.org/licenses/MIT).
//
// Pure and app-safe: the UI uses it to label a release window; the fork CLI
// (`fork/scripts/commoncrawl-backlinks.ts`) uses it to name and order releases.

const CC_MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";

/**
 * Common Crawl publishes the hyperlink graph as rolling, monthly-stepped,
 * overlapping 3-month windows (`cc-main-YYYY-<mon>-<mon>-<mon>`), named by the
 * window's FIRST month's year. Shape only: an unpublished window 404s at probe
 * time. Group 1 is the year, group 2 the `mon-mon-mon` slug.
 */
export const RELEASE_ID_REGEX = new RegExp(
  `^cc-main-(\\d{4})-(${CC_MONTH}-${CC_MONTH}-${CC_MONTH})$`,
);

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function isValidReleaseId(id: string): boolean {
  return RELEASE_ID_REGEX.test(id);
}

export function formatReleaseId(year: number, window: string): string {
  return `cc-main-${year}-${window}`;
}

/** `mon-mon-mon` slug for a window whose first month is `firstMonthIndex` (0–11). */
export function windowSlug(firstMonthIndex: number): string {
  return [0, 1, 2]
    .map((i) => MONTH_NAMES[(firstMonthIndex + i) % 12])
    .join("-");
}

/**
 * A release's crawl window as absolute month numbers (`year * 12 + month`).
 * Named by the first month's year, so `cc-main-2025-nov-dec-jan` ends in
 * January 2026.
 */
function releaseWindow(id: string): { first: number; last: number } | null {
  const match = RELEASE_ID_REGEX.exec(id);
  if (!match) return null;
  const first = MONTH_NAMES.indexOf(match[2].slice(0, 3));
  const start = Number(match[1]) * 12 + first;
  return { first: start, last: start + 2 };
}

const monthLabel = (absolute: number) =>
  `${MONTH_LABELS[absolute % 12]} ${Math.floor(absolute / 12)}`;

/** Oldest crawl window first; non-release ids sort before every release, by id. */
export function compareReleaseIds(a: string, b: string): number {
  const left = releaseWindow(a);
  const right = releaseWindow(b);
  if (left && right) return left.first - right.first;
  if (left) return 1;
  if (right) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "May-Jul 2026", or "Nov 2025-Jan 2026" across a year. */
export function formatReleaseWindow(id: string): string | null {
  const window = releaseWindow(id);
  if (!window) return null;
  const sameYear =
    Math.floor(window.first / 12) === Math.floor(window.last / 12);
  return sameYear
    ? `${MONTH_LABELS[window.first % 12]}-${monthLabel(window.last)}`
    : `${monthLabel(window.first)}-${monthLabel(window.last)}`;
}

/** `example.com` ↔ `com.example` (the domain graph stores reversed names). */
export function reverseDomain(domain: string): string {
  const labels = domain.split(".");
  return labels.map((_, i) => labels[labels.length - 1 - i]).join(".");
}
