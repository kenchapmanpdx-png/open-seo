import type {
  CheckContext,
  CheckResult,
} from "@/server/features/handbook/contracts/check";
import type {
  CollectedData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import type {
  Judge,
  JudgeInput,
  JudgeResult,
} from "@/server/features/handbook/contracts/llm";
import { REGISTRY } from "@/server/features/handbook/registry";

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
      outbound: off,
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
    bytesRaw: 1000,
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
      meta: {},
      hreflang: [],
    },
    h1: [],
    links: (overrides.links ?? []).map((href) => ({
      href: new URL(href, ORIGIN).href,
      text: "",
      rel: null,
      target: null,
      ariaLabel: null,
    })),
    images: [],
    xRobotsTag: null,
    markup: {
      headings: [],
      mainCount: 1,
      navLabels: [],
      scripts: [],
      headLinks: [],
      buttons: [],
      videos: [],
      counts: { tables: 0, lists: 0, forms: 0, iframes: 0, videos: 0 },
      text: "",
    },
  };
}

export const statusOf = (result: CheckResult, itemId: string) =>
  result.statuses.find((s) => s.itemId === itemId)?.status;

/** A judge stub returning `verdict` (default: confident pass, no quotes). */
export function stubJudge(
  verdict: Partial<JudgeResult> = {},
  seen: JudgeInput[] = [],
): Judge {
  return async (input) => {
    seen.push(input);
    return {
      verdict: "pass",
      quotes: [],
      confidence: 0.9,
      rationale: "stub",
      quotesVerified: true,
      call: {
        model: "m",
        tokensIn: 1,
        tokensOut: 1,
        costUsd: 0,
        promptSha256: "x",
      },
      ...verdict,
    };
  };
}

/** Context with every registry item applicable and a stub judge. */
export function llmContext(
  collected: Partial<CollectedData>,
  judge: Judge = stubJudge(),
): CheckContext {
  return {
    ...context(collected),
    applicableItems: new Map(REGISTRY.map((e) => [e.id, e])),
    judge,
  };
}

/** Snapshot with visible text (and optional title / H1). */
export function textPage(
  path: string,
  text: string,
  head: { title?: string; h1?: string } = {},
): PageSnapshot {
  const s = snapshot(path);
  return {
    ...s,
    head: { ...s.head, title: head.title ?? null },
    h1: head.h1 ? [head.h1] : [],
    markup: { ...s.markup, text: head.h1 ? `${head.h1} ${text}` : text },
  };
}
