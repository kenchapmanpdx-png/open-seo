/**
 * One reading of "page N of a list" for the crawl guard, P3-21 and P3-04
 * (WO-B20-013 / run 96: three regexes disagreed; `?p=2` was kept by the crawl
 * but invisible to P3-21).
 *
 * Numbered pages: a numeric `page`, `paged`, `p`, `pg` or `pagenum` query
 * parameter (`?page=2`, WordPress `?paged=2`, `?p=2` paginators) or a
 * `/page/N` path end (`/page/2`, `/page/2/`, `/page/2.html`).
 */
const PAGINATION_PARAMS = ["page", "paged", "p", "pg", "pagenum"];
const PAGE_PATH = /^(.*?)\/page\/(\d+)(?:\/|\.html?)?$/i;

export type ListPage = {
  /** Page number (1 for an explicit `?page=1` / `/page/1/`). */
  page: number;
  /** The list's first page: the URL without the pagination parameter / segment. */
  firstPage: string;
};

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** The pagination parameter's value when it is a number, else null. */
export function paginationParam(u: URL): string | null {
  for (const name of PAGINATION_PARAMS) {
    const value = u.searchParams.get(name);
    if (value !== null && /^\d+$/.test(value)) return value;
  }
  return null;
}

/** The list's base path of a `/page/N` path (`/blog/page/2/` → `/blog`), or null. */
export function pagePathBase(pathname: string): string | null {
  return PAGE_PATH.exec(pathname)?.[1] ?? null;
}

/** Page number and first-page URL of a numbered list page, or null. */
export function listPage(url: string): ListPage | null {
  const u = parse(url);
  if (!u) return null;
  for (const name of PAGINATION_PARAMS) {
    const value = u.searchParams.get(name);
    if (value === null || !/^\d+$/.test(value)) continue;
    const first = new URL(u.href);
    first.searchParams.delete(name);
    first.hash = "";
    return { page: Number(value), firstPage: first.href };
  }
  const path = PAGE_PATH.exec(u.pathname);
  if (!path) return null;
  const first = new URL(u.href);
  first.pathname = `${path[1]}/`;
  first.hash = "";
  return { page: Number(path[2]), firstPage: first.href };
}
