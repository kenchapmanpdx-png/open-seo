import type { CheckContext } from "@/server/features/handbook/contracts/check";
import type {
  MarkupEmbed,
  MarkupVideo,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";
import { normalizeUrl } from "./support";

/** Pages with a `<video>` or player embed, shared by the video checks (FULL-READ §3.12). */
type RenderPage = RenderData["pages"][number];
export type PageVideos = {
  snap: PageSnapshot;
  render: RenderPage | undefined;
  videos: ReadonlyArray<{ v: MarkupVideo; hero: boolean; url: string | null }>;
  embeds: ReadonlyArray<{ e: MarkupEmbed; firstScreen: boolean | null }>;
};

export const isDecorative = (v: MarkupVideo) =>
  v.autoplay && v.muted && v.loop === true && !v.controls;
export function videoTag(v: MarkupVideo): string {
  const flags = ["autoplay", "muted", "loop", "controls"] as const;
  return `<video src="${v.src ?? v.sources?.[0]?.src ?? ""}" poster="${v.poster ?? ""}" preload="${v.preload ?? ""}"${flags
    .filter((f) => v[f])
    .map((f) => ` ${f}`)
    .join(
      "",
    )}${v.width ? ` width="${v.width}"` : ""}${v.height ? ` height="${v.height}"` : ""}>`;
}

export const embedTag = (e: MarkupEmbed) =>
  `<iframe src="${e.src}" loading="${e.loading ?? ""}"${e.width ? ` width="${e.width}"` : ""}${e.height ? ` height="${e.height}"` : ""}> (${e.provider}${e.facade ? ", facade" : ""})`;

const live = (s: PageSnapshot) =>
  s.status === 200 && /html/i.test(s.contentType ?? "html");

function resolveOn(page: string, src: string | null): string | null {
  if (!src) return null;
  try {
    return normalizeUrl(new URL(src, page).href);
  } catch {
    return null;
  }
}

/** Markup videos and embeds per live page, with first-screen flags from render. */
export function pagesWithVideo(ctx: CheckContext): PageVideos[] {
  const { pages, render } = ctx.collected;
  if (pages.status !== "ok") return [];
  const rendered = new Map(
    (render.status === "ok" ? render.pages : []).map((p) => [
      normalizeUrl(p.url),
      p,
    ]),
  );
  return pages.snapshots.filter(live).flatMap((snap) => {
    const embeds = snap.markup.embeds ?? [];
    if (snap.markup.videos.length === 0 && embeds.length === 0) return [];
    const r = rendered.get(normalizeUrl(snap.url));
    const elements = r?.js.mediaElements ?? [];
    const firstScreen = (srcs: Array<string | null | undefined>) => {
      const keys = srcs.map((s) => resolveOn(snap.url, s ?? null));
      const el = elements.find((m) =>
        keys.includes(resolveOn(r?.js.finalUrl ?? snap.url, m.src)),
      );
      return el ? el.firstScreen : null;
    };
    const videos = snap.markup.videos.map((v, i) => {
      const url = v.src ?? v.sources?.[0]?.src ?? null;
      const fs = firstScreen([v.src, ...(v.sources ?? []).map((s) => s.src)]);
      return { v, url, hero: fs ?? i === 0 };
    });
    return [
      {
        snap,
        render: r,
        videos,
        embeds: embeds.map((e) => ({ e, firstScreen: firstScreen([e.src]) })),
      },
    ];
  });
}
