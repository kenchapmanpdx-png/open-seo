import { pageBlocks } from "../engine/boilerplate";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { mainTextFacts } from "@/server/features/handbook/engine/minhash";
import { scanAiAddressed } from "@/server/features/handbook/engine/ai-addressed";
import { crawlFetch } from "@/server/features/handbook/engine/interstitial";
import { emptyHead, emptyMarkup } from "./empty-page";
import { keptHeaders } from "./kept-headers";
import type {
  CollectorContext,
  DiscoveredBy,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";

/** One crawled page: the snapshot plus what the crawl keeps beside it. */
export type PageExtra = {
  jsonLdBlocks: string[];
  skeleton: string;
  bytes: number;
  /** Block texts for the template boilerplate split (FULL-READ §3.11). */
  blocks: string[];
  /** Answered only to the short app name (WO-B27-001). */
  shortName: boolean;
};

const HTML_TYPE = /text\/html|application\/xhtml/i;

export async function fetchPage(
  ctx: CollectorContext,
  url: string,
  discoveredBy: DiscoveredBy,
  onThrottled?: () => void,
): Promise<{ snapshot: PageSnapshot; extra: PageExtra } | null> {
  const res = await crawlFetch(ctx, url, onThrottled);
  if (!res) return null;
  const header = (name: string) =>
    res.headers.find(([k]) => k === name)?.[1] ?? null;
  const contentType = header("content-type");
  const isHtml = contentType ? HTML_TYPE.test(contentType) : true;
  const facts = isHtml ? extractHtmlFacts(res.body, res.finalUrl) : null;
  // Main words, MinHash and in-page repeated blocks (FULL-READ §3.5).
  const blocks = isHtml ? pageBlocks(res.body) : [];
  const main = isHtml ? mainTextFacts(res.body, blocks) : null;
  const bytes = new TextEncoder().encode(res.body);
  const rawKey = isHtml
    ? await ctx.storeBody("rawHtml", res.finalUrl, bytes, "text/html")
    : null;
  return {
    snapshot: {
      url,
      finalUrl: res.finalUrl,
      status: res.status,
      contentType,
      rawKey,
      wordsRaw: facts?.words ?? 0,
      bytesRaw: bytes.byteLength,
      head: facts?.head ?? emptyHead(),
      h1: facts?.h1 ?? [],
      links: facts?.links ?? [],
      images: facts?.images ?? [],
      xRobotsTag: header("x-robots-tag"),
      markup: facts?.markup ?? emptyMarkup(),
      headers: keptHeaders(res.headers),
      ttfbMs: res.ttfbMs ?? null,
      discoveredBy,
      ...main,
      ...(isHtml ? { aiAddressed: scanAiAddressed(res.body) } : {}),
      ...(res.redirectChain.length > 0
        ? { redirectChain: res.redirectChain }
        : {}),
      ...(facts ? { doctype: facts.doctype } : {}),
    },
    extra: {
      jsonLdBlocks: facts?.jsonLdBlocks ?? [],
      skeleton: facts?.skeleton ?? "",
      bytes: bytes.byteLength,
      blocks,
      shortName: res.shortName === true,
    },
  };
}

export function normalize(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    const asset =
      /\.(?:jpe?g|png|gif|webp|avif|svg|pdf|zip|mp4|mp3|css|js|ico|xml|txt)$/i;
    return asset.test(u.pathname) ? null : u.href;
  } catch {
    return null;
  }
}
