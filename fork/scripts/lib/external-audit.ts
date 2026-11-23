// External audit export importer (B17 WO-B17-011, DEPENDABILITY §9 #11).
// Reads a Semrush Site Audit export (xlsx or csv), maps each issue to Handbook
// registry / SUPP ids and lists misses both ways against a Handbook report.json.
// xlsx = zip of XML parts: read with node:zlib, no new dependency.
import { inflateRawSync } from "node:zlib";

type Row = string[];

// ---------- xlsx / csv ----------

function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // End of central directory: signature 0x06054b50, within the last 64 KB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file (no end of central directory)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip entry");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const dataStart =
      local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataStart, dataStart + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function xmlText(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Every sheet of an xlsx workbook as rows of cell strings, in sheet order. */
export function readXlsx(buf: Buffer): { name: string; rows: Row[] }[] {
  const files = unzip(buf);
  const shared = [
    ...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(
      /<si>([\s\S]*?)<\/si>/g,
    ),
  ].map((m) => xmlText(m[1]));
  const sheets = [...files.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]));
  return sheets.map((name) => {
    const xml = files.get(name)?.toString("utf8") ?? "";
    const rows: Row[] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: Row = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const body = c[2] ?? "";
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
        const type = /\bt="(\w+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = "";
        if (type === "s" && v !== undefined) value = shared[Number(v)] ?? "";
        else if (type === "inlineStr") value = xmlText(body);
        else if (v !== undefined) value = xmlText(v);
        row[ref ? colIndex(ref) : row.length] = value;
      }
      rows.push(Array.from(row, (x) => x ?? ""));
    }
    return { name, rows };
  });
}

/** RFC 4180 CSV (comma or semicolon, detected on the header line). */
export function readCsv(text: string): Row[] {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: Row[] = [];
  let row: Row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------- issue extraction ----------

export type ExportIssue = {
  name: string;
  failed: number;
  urls: string[];
  /** Target URL per page URL (link checks, orphan rows), when exported. */
  targets?: Record<string, string[]>;
};

const ISSUE_HEADER = /^(issue|issue name|issue title|check|check name|title)$/i;
const COUNT_HEADER =
  /^(failed|pages|failed checks|count|number of (pages|issues)|issues|affected pages)$/i;
const URL_HEADER = /^(page url|url|page|source url|address)$/i;
const TARGET_HEADER = /^(target url|target|link url|destination url)$/i;

function toCount(v: string): number {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Issues from one table. Long form: a row per issue (Issue + count column),
 * or a row per issue × page (Issue + URL column). Wide form (Semrush "pages"
 * export): a row per page, one column per issue; a non-empty, non-zero cell
 * counts the page as failed.
 */
export function issuesFromRows(rows: Row[]): ExportIssue[] {
  const headerAt = rows.findIndex((r) => r.filter((c) => c.trim()).length >= 2);
  if (headerAt < 0) return [];
  const header = rows[headerAt].map((h) => h.trim());
  const data = rows.slice(headerAt + 1);
  const issueCol = header.findIndex((h) => ISSUE_HEADER.test(h));
  const countCol = header.findIndex((h) => COUNT_HEADER.test(h));
  const urlCol = header.findIndex((h) => URL_HEADER.test(h));
  const targetCol = header.findIndex((h) => TARGET_HEADER.test(h));
  const byName = new Map<string, ExportIssue>();
  const add = (name: string, failed: number, url?: string, target?: string) => {
    const key = name.trim();
    if (!key) return;
    const issue = byName.get(key) ?? { name: key, failed: 0, urls: [] };
    issue.failed += failed;
    if (url && !issue.urls.includes(url)) issue.urls.push(url);
    if (url && target) {
      issue.targets ??= {};
      (issue.targets[url] ??= []).push(target);
    }
    byName.set(key, issue);
  };
  if (issueCol >= 0) {
    for (const r of data) {
      const url = urlCol >= 0 ? r[urlCol]?.trim() : undefined;
      const target = targetCol >= 0 ? r[targetCol]?.trim() : undefined;
      const failed = countCol >= 0 ? toCount(r[countCol] ?? "") : 1;
      add(r[issueCol] ?? "", failed, url, target);
    }
    return [...byName.values()];
  }
  if (urlCol < 0) return [];
  header.forEach((h, col) => {
    if (col === urlCol || !h) return;
    for (const r of data) {
      const v = (r[col] ?? "").trim();
      if (v && v !== "0" && !/^(false|no)$/i.test(v)) add(h, 1, r[urlCol]);
    }
    if (!byName.has(h)) add(h, 0);
  });
  return [...byName.values()];
}

// ---------- mapping ----------

type Mapping = { ids: string[] } | { skip: string } | { siteAudit: string };

const ids = (...x: string[]): Mapping => ({ ids: x });
const skip = (reason: string): Mapping => ({ skip: reason });
const sa = (code: string): Mapping => ({ siteAudit: code });
const NO_TLS = "cap note: no TLS handshake API in the runtime (fetch fails)";

/**
 * Semrush Site Audit check names → Handbook ids. Source: the 101-check catalog
 * in fork/fixtures/audits/salonvata.com-app-vs-semrush-2026-11-19.md (Note
 * column) and the B17 #10 dispositions. `siteAudit` = upstream Site Audit only;
 * `skip` = no ranking / GEO value per the handbook, or a recorded cap.
 */
const SEMRUSH_MAP: Record<string, Mapping> = {
  "5xx errors": ids("P3-13"),
  "4xx errors": ids("P3-08", "P3-13"),
  "Title tag is missing or empty": ids("P4-01"),
  "Blocked from crawling": ids("P3-14", "P3-15"),
  "Duplicate title tag": ids("P4-01"),
  "Duplicate content": ids("P3-12", "SUPP-17"),
  "Broken internal links": ids("P3-08"),
  "Pages not crawled": ids("P3-13"),
  "DNS resolution issue": skip("covered by fetch failure (pages not read)"),
  "We couldn't open the page's URL": ids("P3-13"),
  "Broken external links": ids("P5-13"),
  "Broken internal images": ids("SUPP-20"),
  "Broken external images": ids("SUPP-20"),
  "Duplicate meta descriptions": ids("P4-01"),
  "Invalid robots.txt format": ids("P3-15"),
  "Invalid sitemap.xml format": ids("P3-12"),
  "Incorrect pages found in sitemap.xml": ids("P3-12"),
  "www resolve issues": ids("P3-01"),
  "Viewport not configured": ids("P4-04"),
  "Large HTML page size": ids("P2-05"),
  "Missing canonical tags in AMP pages": skip("AMP"),
  "Issues with hreflang values": ids("P3-24"),
  "Hreflang conflicts within page source code": ids("P3-24"),
  "Issues with incorrect hreflang links": ids("P3-24"),
  "Non-secure pages": ids("P3-01"),
  "Certificate Expiration": skip(NO_TLS),
  "Old security protocol version": skip(NO_TLS),
  "Certificate registered to incorrect name": skip(NO_TLS),
  "Issues with mixed content": ids("SUPP-21"),
  "Links lead to HTTP pages for HTTPS site": ids("SUPP-22"),
  "Neither canonical URL nor 301 redirect from HTTP homepage": ids("P3-01"),
  "Redirect chains and loops": ids("P3-08", "P3-01"),
  "AMP Pages with HTML Issues": skip("AMP"),
  "AMP Pages with Style and Layout Issues": skip("AMP"),
  "AMP Pages with Templating Issues": skip("AMP"),
  "Broken canonical URLs": ids("P3-04"),
  "Multiple canonical URLs": ids("P3-04"),
  "Meta refresh redirects": ids("SUPP-23"),
  "Broken internal JavaScript and CSS files": ids("SUPP-20"),
  "Insecure encryption algorithms": skip(NO_TLS),
  "Sitemap file too large": ids("P3-12"),
  "Malformed links": ids("SUPP-24"),
  "Structured data that contains markup errors": ids("P6-08"),
  "Viewport width not set": ids("P4-04"),
  "Title element is too short": ids("P4-01"),
  "Title element is too long": ids("P4-01"),
  "Missing h1": ids("P4-01", "P4-08"),
  "Multiple h1 tags": sa("multiple-h1"),
  "Duplicate content in h1 and title": skip("no ranking evidence"),
  "Missing meta description": ids("P4-03"),
  "Too many on-page links": skip("no ranking evidence"),
  "Temporary redirects": ids("SUPP-25"),
  "Missing ALT attributes": ids("P8-04"),
  "Slow page load speed": ids("P7-09"),
  "Low text to HTML ratio": skip("handbook rule: ignore"),
  "Too many URL parameters": skip("low value"),
  "Missing hreflang and lang attributes": ids("P3-24"),
  "Encoding not declared": sa("head-tags (charset)"),
  "Doctype not declared": ids("SUPP-26"),
  "Low word count": sa("thin-content"),
  "Incompatible plugins used": skip("Flash / Java era"),
  "Frames used": skip("rare"),
  "Underscores in URL": skip("no ranking effect"),
  "Nofollow attributes in internal links": ids("SUPP-01"),
  "Sitemap.xml not specified in robots.txt": ids("P3-19"),
  "Sitemap.xml not found": ids("P3-12"),
  "HTTPS encryption not used": ids("P3-01"),
  "No SNI support": skip("rare"),
  "HTTP URLs in sitemap.xml for HTTPS site": ids("P3-19"),
  "Uncompressed pages": ids("P7-07"),
  "Disallowed internal resources": ids("P3-20"),
  "Uncompressed JavaScript and CSS files": ids("P7-07"),
  "Uncached JavaScript and CSS files": ids("P7-07"),
  "Too large JavaScript and CSS total size": ids("P2-05", "P7-05"),
  "Too many JavaScript and CSS files": ids("P7-05"),
  "Unminified JavaScript and CSS files": skip("Lighthouse covers it"),
  "Warning - Too long URLs": skip("low value"),
  "Llms.txt not found": skip("handbook: no proven effect"),
  "Too long URLs": skip("low value"),
  "Nofollow attributes in external links": skip("info only"),
  "Robots.txt not found": ids("P3-15"),
  "Hreflang language mismatch issues": ids("P3-24"),
  "No HSTS support": ids("P8-01", "P8-05"),
  "Orphaned pages (Google Analytics)": skip(
    "cap note: needs GA4 landing pages (EP-7: no traffic data in REVIEW)",
  ),
  "Orphaned sitemap pages": ids("P3-12"),
  "Pages have high Document Interactive Time": ids("P7-09"),
  "Blocked by X-Robots-Tag: noindex HTTP header": ids("P3-14"),
  "Disallowed external resources": ids("P3-20"),
  "Broken external JavaScript and CSS files": ids("SUPP-20"),
  "Page crawl depth": sa("deep-page"),
  "Pages with only one internal link": ids("P3-12"),
  "Permanent redirects": ids("P3-08"),
  "Resources formatted as page links": ids("P3-12"),
  "Links with no anchor text": ids("SUPP-01"),
  "Links with non-descriptive anchor text": ids("SUPP-01"),
  "External pages or resources with 403 HTTP status code": ids("P5-13"),
  "Llms.txt has formatting issues": skip("handbook: no proven effect"),
  "Too much content": skip("no ranking evidence"),
  "Outdated content": ids("P3-17"),
  "Low Semantic HTML usage": ids("P4-08"),
  "Content not optimized": skip("LLM-judged content checks; not comparable"),
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const MAP_BY_KEY = new Map(
  Object.entries(SEMRUSH_MAP).map(([k, v]) => [normalize(k), v] as const),
);

// ---------- comparison ----------

type ReportFinding = {
  code: string;
  title: string;
  itemIds?: string[];
  urls?: string[];
  evidence?: { url?: string }[];
};
export type HandbookReport = {
  findings?: ReportFinding[];
  additionalFindings?: ReportFinding[];
};

type ImportResult = {
  issues: (ExportIssue & { mapping: Mapping | null; caught?: boolean })[];
  /** Failing export issues with no Handbook item (unknown name or skip). */
  noHandbookItem: (ExportIssue & { reason: string })[];
  /** Failing export issues mapped to ids the report has no finding for. */
  handbookMissed: (ExportIssue & { ids: string[] })[];
  /** Report findings whose ids no failing export issue maps to. */
  handbookOnly: ReportFinding[];
  /**
   * Caught issues whose export page URLs (or their targets) appear in no
   * finding of the mapped items: the by-URL miss (M6 step 3).
   */
  urlMisses: (ExportIssue & { ids: string[]; missed: string[] })[];
};

/** host without www + path without trailing slash, for by-URL matching. */
function urlKey(u: string): string {
  try {
    const x = new URL(u);
    return `${x.host.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}${x.search}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

export function compareExport(
  issues: ExportIssue[],
  report?: HandbookReport,
): ImportResult {
  const found = report
    ? [...(report.findings ?? []), ...(report.additionalFindings ?? [])]
    : [];
  const foundIds = new Set(found.flatMap((f) => f.itemIds ?? []));
  const exportIds = new Set<string>();
  const result: ImportResult = {
    issues: [],
    noHandbookItem: [],
    handbookMissed: [],
    handbookOnly: [],
    urlMisses: [],
  };
  for (const issue of issues) {
    const mapping = MAP_BY_KEY.get(normalize(issue.name)) ?? null;
    const failing = issue.failed > 0;
    let caught: boolean | undefined;
    if (mapping && "ids" in mapping) {
      if (failing) mapping.ids.forEach((id) => exportIds.add(id));
      if (report && failing) {
        caught = mapping.ids.some((id) => foundIds.has(id));
        if (!caught) result.handbookMissed.push({ ...issue, ids: mapping.ids });
        else {
          const ids = mapping.ids;
          const covered = new Set(
            found
              .filter((f) => (f.itemIds ?? []).some((id) => ids.includes(id)))
              .flatMap((f) => [
                ...(f.urls ?? []),
                ...(f.evidence ?? []).flatMap((e) => (e.url ? [e.url] : [])),
              ])
              .map(urlKey),
          );
          const missed = issue.urls.filter(
            (u) =>
              !covered.has(urlKey(u)) &&
              !(issue.targets?.[u] ?? []).some((t) => covered.has(urlKey(t))),
          );
          if (missed.length > 0)
            result.urlMisses.push({ ...issue, ids, missed });
        }
      }
    } else if (failing) {
      const reason = !mapping
        ? "unknown check name: add it to SEMRUSH_MAP"
        : "skip" in mapping
          ? `skip: ${mapping.skip}`
          : `Site Audit only: ${mapping.siteAudit}`;
      result.noHandbookItem.push({ ...issue, reason });
    }
    result.issues.push({ ...issue, mapping, caught });
  }
  result.handbookOnly = found.filter(
    (f) => !(f.itemIds ?? []).some((id) => exportIds.has(id)),
  );
  return result;
}

export function renderMarkdown(
  source: string,
  result: ImportResult,
  reportPath?: string,
): string {
  const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const failing = result.issues.filter((i) => i.failed > 0);
  const lines = [
    `# External audit import — ${source}`,
    "",
    `Report: ${reportPath ?? "none (mapping only)"} · issues ${result.issues.length} · failing ${failing.length}`,
    "",
    "## Failing export issues",
    "",
    "| Issue | Failed | Handbook | Caught |",
    "| --- | --- | --- | --- |",
    ...failing.map((i) => {
      const m = i.mapping;
      const target = !m
        ? "unmapped"
        : "ids" in m
          ? m.ids.join(", ")
          : "skip" in m
            ? `skip (${m.skip})`
            : `Site Audit (${m.siteAudit})`;
      const caught = i.caught === undefined ? "—" : i.caught ? "yes" : "no";
      return `| ${cell(i.name)} | ${i.failed} | ${cell(target)} | ${caught} |`;
    }),
    "",
    "## Misses: export issue, no Handbook item",
    "",
    ...(result.noHandbookItem.length
      ? result.noHandbookItem.map(
          (i) => `- ${i.name} (${i.failed}) — ${i.reason}`,
        )
      : ["- none"]),
    "",
    "## Misses: Handbook item exists, no finding in the report",
    "",
    ...(reportPath
      ? result.handbookMissed.length
        ? result.handbookMissed.map(
            (i) =>
              `- ${i.name} (${i.failed}) → ${i.ids.join(", ")}${i.urls.length ? ` · e.g. ${i.urls.slice(0, 3).join(", ")}` : ""}`,
          )
        : ["- none"]
      : ["- (no report given)"]),
    "",
    "## Misses by URL: issue caught, page not in a mapped finding",
    "",
    ...(reportPath
      ? result.urlMisses.length
        ? result.urlMisses.map(
            (i) =>
              `- ${i.name} (${i.missed.length} of ${i.urls.length} URLs) → ${i.ids.join(", ")} · ${i.missed.slice(0, 5).join(", ")}`,
          )
        : ["- none"]
      : ["- (no report given)"]),
    "",
    "## Handbook findings with no export issue",
    "",
    ...(reportPath
      ? result.handbookOnly.length
        ? result.handbookOnly.map(
            (f) => `- ${f.code} ${f.title} (${(f.itemIds ?? []).join(", ")})`,
          )
        : ["- none"]
      : ["- (no report given)"]),
    "",
  ];
  return lines.join("\n");
}
