import type {
  UnreadClass,
  UnreadCoverage,
  UnreadUrl,
} from "@/server/features/handbook/contracts/collectors";

/**
 * "Pages not read" (ACCURACY #0, ADR-031): every URL the site crawl saw that
 * the Handbook did not read, with one class. In-app runs pass the upstream
 * audit's pages; CLI runs pass their own crawl's leftovers (status unknown).
 */
type CrawledUrl = {
  url: string;
  status: number | null;
  redirectUrl?: string | null;
};

/** Rows kept in the report; `total` and `byClass` count all of them. */
const UNREAD_ROWS_MAX = 200;

const NON_HTML =
  /\.(?:pdf|jpe?g|png|gif|webp|avif|svg|zip|mp4|mp3|docx?|xlsx?|pptx?|css|js|ico|xml|txt)$/i;
const ATTACHMENT = /[?&]attachment_id=|\/attachment\//i;
const CLASS_ORDER: readonly UnreadClass[] = [
  "unseen",
  "404",
  "redirect",
  "attachment",
  "non-HTML",
];

function classifyUnread(page: CrawledUrl): UnreadUrl {
  const { url, status } = page;
  const base = { url, status };
  if (page.redirectUrl || (status !== null && status >= 300 && status < 400))
    return { ...base, class: "redirect", target: page.redirectUrl ?? null };
  if (status !== null && status >= 400) return { ...base, class: "404" };
  if (NON_HTML.test(pathOf(url))) return { ...base, class: "non-HTML" };
  if (ATTACHMENT.test(url)) return { ...base, class: "attachment" };
  return { ...base, class: "unseen" };
}

/** Crawled URLs whose page (or redirect target) the run did not read. */
export function unreadCoverage(
  crawled: readonly CrawledUrl[],
  read: ReadonlyArray<{ url: string; finalUrl: string | null }>,
): UnreadCoverage {
  const seen = new Set(
    read.flatMap((s) => [key(s.url), s.finalUrl ? key(s.finalUrl) : ""]),
  );
  const unique = new Map<string, CrawledUrl>();
  for (const page of crawled) {
    const k = key(page.url);
    if (!seen.has(k) && !unique.has(k)) unique.set(k, page);
  }
  const rows = [...unique.values()].map(classifyUnread);
  const byClass: Partial<Record<UnreadClass, number>> = {};
  for (const row of rows) byClass[row.class] = (byClass[row.class] ?? 0) + 1;
  rows.sort(
    (a, b) =>
      CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class) ||
      a.url.localeCompare(b.url),
  );
  return {
    total: rows.length,
    byClass,
    rows: rows.slice(0, UNREAD_ROWS_MAX),
  };
}

/** Comparison key: no fragment, no trailing slash, lower-case host. */
function key(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
