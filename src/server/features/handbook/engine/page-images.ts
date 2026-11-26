import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";

type Image = PageSnapshot["images"][number];

const isHttp = (u: string | null): u is string => !!u && /^https?:/i.test(u);

/**
 * The URL an `<img>` loads (WO-B25-010): `src` when it is http(s), else the
 * lazy-load URL (`dataSrc`) when that is; a `data:` / `about:blank`
 * placeholder `src` never hides the real image. null = no fetchable URL.
 */
export function imageUrl(img: Pick<Image, "src" | "dataSrc">): string | null {
  if (isHttp(img.src)) return img.src;
  return isHttp(img.dataSrc) ? img.dataSrc : null;
}

/**
 * A tracking-pixel `<img>` (WO-B25-001): width or height 1 (attribute or
 * inline style) or hidden inline. Skipped only inside `<noscript>` (Meta
 * pixel fallback); Showit-style `<noscript>` content images stay.
 */
function isPixel(attrs: Record<string, string>): boolean {
  const style = (attrs.style ?? "").toLowerCase().replace(/\s+/g, "");
  return (
    attrs.width?.trim() === "1" ||
    attrs.height?.trim() === "1" ||
    /(^|;)(width|height):1px/.test(style) ||
    /(^|;)(display:none|visibility:hidden)/.test(style)
  );
}

/**
 * One `<img>` of the page facts, or null for a `<noscript>` tracking pixel.
 * An empty or missing `src` stays "" (resolving it gives the page URL); lazy
 * loaders keep the real URL in `data-src`, `data-lazy-src` or
 * `data-original` (WO-B25-010).
 */
export function readImage(
  attrs: Record<string, string>,
  stack: readonly string[],
  resolve: (href: string) => string,
): Image | null {
  if (stack.includes("noscript") && isPixel(attrs)) return null;
  const lazySrc =
    attrs["data-src"] || attrs["data-lazy-src"] || attrs["data-original"];
  return {
    src: attrs.src?.trim() ? resolve(attrs.src) : "",
    dataSrc: lazySrc ? resolve(lazySrc) : null,
    srcset: attrs.srcset ?? null,
    alt: attrs.alt ?? null,
    width: attrs.width ?? null,
    height: attrs.height ?? null,
    loading: attrs.loading ?? null,
    fetchpriority: attrs.fetchpriority ?? null,
  };
}
