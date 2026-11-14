import type {
  CheckContext,
  CheckResult,
} from "@/server/features/handbook/contracts/check";
import type {
  CollectedData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";

export const ORIGIN = "https://example.com";

const off = { status: "unavailable", reason: "test" } as const;

export function context(collected: Partial<CollectedData>): CheckContext {
  return {
    runId: "r1",
    origin: ORIGIN,
    mode: "AUDIT",
    tier: "T2",
    siteProfile: [],
    applicableItems: new Map(),
    collected: {
      pages: off,
      robots: off,
      sitemap: off,
      llms: off,
      headers: off,
      variants: off,
      botFetch: off,
      jsonld: off,
      templates: off,
      render: off,
      axe: off,
      lighthouse: off,
      ...collected,
    },
  };
}

export function snapshot(
  path: string,
  overrides: {
    canonical?: string | null;
    links?: string[];
    status?: number;
    robotsMeta?: string;
  } = {},
): PageSnapshot {
  const url = new URL(path, ORIGIN).href;
  return {
    url,
    finalUrl: url,
    status: overrides.status ?? 200,
    contentType: "text/html",
    rawKey: null,
    wordsRaw: 100,
    head: {
      title: null,
      metaDescription: null,
      canonical:
        overrides.canonical === undefined
          ? url
          : overrides.canonical && new URL(overrides.canonical, ORIGIN).href,
      robotsMeta: overrides.robotsMeta ?? null,
      lang: null,
      viewport: null,
      og: {},
      twitter: {},
      hreflang: [],
    },
    h1: [],
    links: (overrides.links ?? []).map((href) => ({
      href: new URL(href, ORIGIN).href,
      text: "",
      rel: null,
    })),
    images: [],
    xRobotsTag: null,
  };
}

export const statusOf = (result: CheckResult, itemId: string) =>
  result.statuses.find((s) => s.itemId === itemId)?.status;
