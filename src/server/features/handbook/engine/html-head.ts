import type { HtmlFacts } from "./html-facts";

/** `<meta>` and `<link>` readers of `extractHtmlFacts` (split out: max-lines). */
export function readMeta(
  head: HtmlFacts["head"],
  attrs: Record<string, string>,
) {
  // `http-equiv` metas keep their own prefix ("http-equiv:refresh", SUPP-23).
  const key = (
    attrs.name ??
    attrs.property ??
    (attrs["http-equiv"] ? `http-equiv:${attrs["http-equiv"]}` : "")
  ).toLowerCase();
  const content = attrs.content ?? "";
  if (key === "description" && head.metaDescription === null)
    head.metaDescription = content;
  else if (key === "robots") head.robotsMeta = content;
  else if (key === "viewport") head.viewport = content;
  else if (key.startsWith("og:")) head.og[key.slice(3)] = content;
  else if (key.startsWith("twitter:")) head.twitter[key.slice(8)] = content;
  else if (key) head.meta[key] = content;
}

export function readLink(
  head: HtmlFacts["head"],
  hreflang: { lang: string; href: string }[],
  attrs: Record<string, string>,
  resolve: (href: string) => string,
) {
  const href = attrs.href ?? "";
  const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/);
  if (rel.includes("canonical") && head.canonical === null)
    head.canonical = resolve(href);
  if (rel.includes("alternate") && attrs.hreflang)
    hreflang.push({ lang: attrs.hreflang, href: resolve(href) });
}
