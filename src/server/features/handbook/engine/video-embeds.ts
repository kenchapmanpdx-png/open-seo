import type {
  EmbedProvider,
  MarkupEmbed,
} from "@/server/features/handbook/contracts/collectors";

/**
 * Video `<iframe>` embeds and click-to-load facades in raw HTML (FULL-READ
 * §3.12). An iframe counts when its `src` (or lazy `data-src`) is a known
 * video player; `<lite-youtube>` / `<lite-vimeo>`, `srcdoc` thumbnails and
 * iframes with only a `data-src` are facades (no player at page load).
 */
const PLAYERS: ReadonlyArray<{ provider: EmbedProvider; pattern: RegExp }> = [
  {
    provider: "youtube",
    pattern:
      /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/(?:embed|shorts)\/([\w-]+)/i,
  },
  {
    provider: "vimeo",
    pattern: /^https?:\/\/player\.vimeo\.com\/video\/(\d+)/i,
  },
  {
    provider: "wistia",
    pattern:
      /^https?:\/\/(?:fast\.)?wistia\.(?:net|com)\/(?:embed\/iframe|medias)\/(\w+)/i,
  },
  {
    provider: "loom",
    pattern: /^https?:\/\/(?:www\.)?loom\.com\/embed\/(\w+)/i,
  },
  {
    provider: "other",
    pattern:
      /^https?:\/\/(?:www\.dailymotion\.com\/embed\/video|players\.brightcove\.net|play\.vidyard\.com|cdn\.jwplayer\.com\/players|fast\.wistia\.com\/embed)\/?([\w-]*)/i,
  },
];

export function aspectRatio(style: string | undefined): string | null {
  const m = /aspect-ratio\s*:\s*([^;]+)/i.exec(style ?? "");
  return m?.[1]?.trim() ?? null;
}

function player(
  url: string,
): { provider: EmbedProvider; id: string | null } | null {
  for (const p of PLAYERS) {
    const m = p.pattern.exec(url);
    if (m) return { provider: p.provider, id: m[1] || null };
  }
  return null;
}

export function embedOf(
  name: string,
  attrs: Record<string, string>,
  resolve: (href: string) => string,
): MarkupEmbed | null {
  const size = {
    loading: attrs.loading ?? null,
    width: attrs.width ?? null,
    height: attrs.height ?? null,
    aspectRatio: aspectRatio(attrs.style),
  };
  if (name === "lite-youtube" || name === "lite-vimeo") {
    const id = attrs.videoid ?? attrs["video-id"] ?? null;
    return {
      provider: name === "lite-youtube" ? "youtube" : "vimeo",
      videoId: id,
      src: id ? `${name}:${id}` : name,
      facade: true,
      ...size,
    };
  }
  if (name !== "iframe") return null;
  const raw = attrs.src ?? attrs["data-src"];
  if (!raw) return null;
  const src = resolve(raw);
  const hit = player(src);
  if (!hit) return null;
  return {
    provider: hit.provider,
    videoId: hit.id,
    src,
    facade: !attrs.src || "srcdoc" in attrs,
    ...size,
  };
}
