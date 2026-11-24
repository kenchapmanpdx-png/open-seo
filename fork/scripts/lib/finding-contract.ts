/**
 * WO-B20-015 (e), ADR-035: a finding says no more than its evidence. Run by
 * badgeo-run.ts and golden-score.ts over report.json + collected.json; any
 * issue fails the run (exit 1). Rules:
 *  1. every URL in `urls` is one the run fetched (a crawled page, a probed
 *     variant / link target / resource, a rendered page or a site file);
 *  2. a finding about links ("… links …") lists the linking pages: its `urls`
 *     are crawled pages, the targets stay in the detail (WO-B20-014 b);
 *  3. a page count in the title ("(3 pages)") equals `urls.length`;
 *  4. a title "Pages missing a, b" names only tags the detail shows missing;
 *  5. a finding on robots.txt / a sitemap / llms.txt that answered non-200
 *     says the status ("HTTP 404" or the bare code) in title or detail.
 */
type Finding = {
  title: string;
  detail: string;
  itemIds: string[];
  urls: string[];
};
type Report = { findings: Finding[]; additionalFindings?: Finding[] | null };
type WithUrl = { url: string; finalUrl?: string | null };
type Collected = {
  pages?: { snapshots?: WithUrl[] } | WithUrl[];
  robots?: { hosts?: { host: string; status: number }[] };
  sitemap?: { sources?: { url: string; status: number }[] };
  llms?: { files?: { url: string; status: number }[] };
  headers?: { responses?: WithUrl[] };
  variants?: { probes?: WithUrl[] };
  linkTargets?: { targets?: WithUrl[] };
  resources?: { resources?: WithUrl[] };
  render?: { pages?: WithUrl[] };
  outbound?: WithUrl[] | { links?: WithUrl[] };
};

/** host without www + path without trailing slash + query: the forms one URL is written in. */
function key(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.host.replace(/^www\./, "")}${path}${u.search}`;
  } catch {
    return url;
  }
}

const urlsOf = (list: WithUrl[] | undefined) =>
  (list ?? []).flatMap((x) => (x.finalUrl ? [x.url, x.finalUrl] : [x.url]));

const LINK_TITLE = /\blinks?\b/i;
const PAGE_COUNT = /\((\d+) pages?\b/;
const MISSING = /^Pages missing (.+)$/;
/** A tag-like token: og:url, twitter:card, <h1>, max-image-preview… (no spaces). */
const TAG = /^\S+$/;

export function findingContractIssues(
  report: Report,
  collected: Collected,
): string[] {
  const pageList = Array.isArray(collected.pages)
    ? collected.pages
    : collected.pages?.snapshots;
  const pages = new Set(urlsOf(pageList).map(key));
  const files = [
    ...(collected.robots?.hosts ?? []).map((h) => ({
      url: `https://${h.host}/robots.txt`,
      status: h.status,
    })),
    ...(collected.sitemap?.sources ?? []),
    ...(collected.llms?.files ?? []),
  ];
  const outbound = Array.isArray(collected.outbound)
    ? collected.outbound
    : collected.outbound?.links;
  const fetched = new Set([
    ...pages,
    ...files.map((f) => key(f.url)),
    ...[
      collected.headers?.responses,
      collected.variants?.probes,
      collected.linkTargets?.targets,
      collected.resources?.resources,
      collected.render?.pages,
      outbound,
    ].flatMap((l) => urlsOf(l).map(key)),
  ]);
  // Exact URL here: www. and the apex answer robots.txt separately.
  const exact = (u: string) => URL.parse(u)?.href ?? u;
  const fileStatus = new Map(files.map((f) => [exact(f.url), f.status]));

  const issues: string[] = [];
  for (const f of [...report.findings, ...(report.additionalFindings ?? [])]) {
    const at = `${f.itemIds[0] ?? "?"} "${f.title}"`;
    const unread = f.urls.filter((u) => !fetched.has(key(u)));
    if (unread.length > 0)
      issues.push(`${at}: urls the run never fetched: ${unread.join(", ")}`);
    if (LINK_TITLE.test(f.title)) {
      const notPages = f.urls.filter(
        (u) => !pages.has(key(u)) && !unread.includes(u),
      );
      if (notPages.length > 0)
        issues.push(
          `${at}: link finding lists targets, not linking pages: ${notPages.join(", ")}`,
        );
    }
    const count = PAGE_COUNT.exec(f.title);
    if (count && Number(count[1]) !== f.urls.length)
      issues.push(
        `${at}: title says ${count[1]} pages, urls has ${f.urls.length}`,
      );
    const missing = MISSING.exec(f.title);
    if (missing) {
      const tags = missing[1]
        .split(/,\s*|\s+and\s+/)
        .filter((t) => TAG.test(t));
      const unshown = tags.filter((t) => !f.detail.includes(t));
      if (unshown.length > 0)
        issues.push(
          `${at}: title names ${unshown.join(", ")}, the detail does not`,
        );
    }
    for (const u of f.urls) {
      const status = fileStatus.get(exact(u));
      if (status === undefined || status === 200) continue;
      if (!`${f.title} ${f.detail}`.includes(String(status)))
        issues.push(
          `${at}: ${u} answered ${status}; the finding does not say so`,
        );
    }
  }
  return issues;
}
