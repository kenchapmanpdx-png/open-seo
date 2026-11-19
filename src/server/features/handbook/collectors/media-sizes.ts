import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";

/**
 * Media sizes without downloading bodies (FULL-READ §3.12): one HEAD per
 * unique media URL seen on rendered pages (video / audio the sidecar
 * aborted first, then images with no transfer size), cap 200, through
 * `ctx.fetchOffsite` (SSRF policy; media often sits on a CDN host). Size =
 * `Content-Length` of a 2xx HEAD, else the total of a `GET` with
 * `Range: bytes=0-0` (206 `Content-Range: bytes 0-0/<total>`; SafeFetch does
 * not read a body the server sends whole); anything else is `unknown` and
 * noted.
 * Each page's `pageWeightBytes` then adds the declared size of media that
 * loads with it (contract: Σ transferBytes + loading media).
 */
const MAX_URLS = 200;
const WORKERS = 4;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type MediaSize = NonNullable<RenderData["mediaSizes"]>[number];
type Request = RenderData["pages"][number]["js"]["requests"][number];

const isMedia = (q: Request) =>
  q.aborted === "media" || q.resourceType === "media";

function targets(render: RenderData): string[] {
  const media = new Set<string>();
  const images = new Set<string>();
  for (const page of render.pages)
    for (const q of page.js.requests) {
      if (!/^https?:/i.test(q.url)) continue;
      if (isMedia(q)) media.add(q.url);
      else if (q.resourceType === "image" && q.transferBytes == null)
        images.add(q.url);
    }
  return [...media, ...[...images].filter((u) => !media.has(u))];
}

const header = (
  headers: ReadonlyArray<readonly [string, string]>,
  name: string,
) => headers.find(([k]) => k === name)?.[1];

async function probe(ctx: CollectorContext, url: string): Promise<MediaSize> {
  try {
    const head = await ctx.fetchOffsite(url, {
      method: "HEAD",
      userAgent: BROWSER_UA,
    });
    const length = Number.parseInt(
      header(head.headers, "content-length") ?? "",
      10,
    );
    if (head.status >= 200 && head.status < 300 && length >= 0)
      return { url, bytes: length, method: "head" };
    const ranged = await ctx.fetchOffsite(url, {
      userAgent: BROWSER_UA,
      headers: { range: "bytes=0-0" },
    });
    const total = /\/(\d+)\s*$/.exec(
      header(ranged.headers, "content-range") ?? "",
    )?.[1];
    if (ranged.status === 206 && total)
      return { url, bytes: Number(total), method: "range" };
    ctx.log("handbook.media_size.unknown", {
      url,
      status: head.status,
      rangeStatus: ranged.status,
    });
  } catch (error) {
    ctx.log("handbook.media_size.unknown", { url, error: String(error) });
  }
  return { url, bytes: null, method: "unknown" };
}

export async function probeMediaSizes(
  ctx: CollectorContext,
  urls: readonly string[],
): Promise<MediaSize[]> {
  const picked = [...new Set(urls)].slice(0, MAX_URLS);
  if (urls.length > picked.length)
    ctx.log("handbook.media_size.capped", {
      found: new Set(urls).size,
      probed: picked.length,
    });
  const out: MediaSize[] = Array.from({ length: picked.length });
  let cursor = 0;
  const worker = async () => {
    while (cursor < picked.length) {
      const i = cursor++;
      out[i] = await probe(ctx, picked[i]);
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  return out;
}

/** Render data with `mediaSizes` and media bytes added to page weight. */
export async function withMediaSizes(
  ctx: CollectorContext,
  render: RenderData,
): Promise<RenderData> {
  const mediaSizes = await probeMediaSizes(ctx, targets(render));
  const bytes = new Map(mediaSizes.map((m) => [m.url, m.bytes]));
  return {
    ...render,
    mediaSizes,
    pages: render.pages.map((page) => {
      const media = new Set(
        page.js.requests
          .filter((q) => isMedia(q) && q.transferBytes == null)
          .map((q) => q.url),
      );
      const extra = [...media].reduce((sum, u) => sum + (bytes.get(u) ?? 0), 0);
      return extra === 0
        ? page
        : {
            ...page,
            js: {
              ...page.js,
              pageWeightBytes: (page.js.pageWeightBytes ?? 0) + extra,
            },
          };
    }),
  };
}
