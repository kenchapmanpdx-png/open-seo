import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";

/** Snapshot fields for a non-HTML response (no parsed head or markup). */
export function emptyMarkup(): PageSnapshot["markup"] {
  return {
    headings: [],
    mainCount: 0,
    navLabels: [],
    scripts: [],
    headLinks: [],
    buttons: [],
    videos: [],
    counts: { tables: 0, lists: 0, forms: 0, iframes: 0, videos: 0 },
    text: "",
  };
}

export function emptyHead(): PageSnapshot["head"] {
  return {
    title: null,
    metaDescription: null,
    canonical: null,
    robotsMeta: null,
    lang: null,
    viewport: null,
    og: {},
    twitter: {},
    meta: {},
    hreflang: [],
  };
}
