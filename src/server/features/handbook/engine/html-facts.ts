import { sort } from "remeda";
import { Parser } from "htmlparser2";
import type {
  PageMarkup,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";

/**
 * One streaming pass over raw HTML → the parsed facts every raw-HTML check
 * reads (PageSnapshot.head/h1/links/images), the JSON-LD script bodies, a
 * visible-word count and a structural skeleton for template clustering.
 * Bodies stay out of memory after this (ADR-001).
 */
export type HtmlFacts = Pick<
  PageSnapshot,
  "head" | "h1" | "links" | "images" | "markup"
> & {
  jsonLdBlocks: string[];
  words: number;
  /** Sorted unique structural tag paths (ADR-006); repeat counts ignored. */
  skeleton: string;
};

const SKIP_TEXT = new Set(["script", "style", "noscript", "template", "svg"]);
const LANDMARKS = ["header", "nav", "footer", "aside"] as const;
const isLandmark = (tag: string): tag is (typeof LANDMARKS)[number] =>
  (LANDMARKS as readonly string[]).includes(tag);
const HEADING = /^h([1-6])$/;
const MAX_TEXT = 20_000;
type Landmark = PageMarkup["headings"][number]["landmark"];
const STRUCTURAL = new Set([
  "header",
  "nav",
  "main",
  "article",
  "section",
  "aside",
  "footer",
  "form",
  "h1",
  "h2",
  "ul",
  "ol",
  "table",
  "img",
  "video",
]);

export function extractHtmlFacts(html: string, baseUrl: string): HtmlFacts {
  const head: HtmlFacts["head"] = {
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
  const h1: string[] = [];
  const links: HtmlFacts["links"][number][] = [];
  const headings: PageMarkup["headings"][number][] = [];
  const navLabels: (string | null)[] = [];
  const scripts: PageMarkup["scripts"][number][] = [];
  const headLinks: PageMarkup["headLinks"][number][] = [];
  const buttons: PageMarkup["buttons"][number][] = [];
  const videos: PageMarkup["videos"][number][] = [];
  const counts = { tables: 0, lists: 0, forms: 0, iframes: 0, videos: 0 };
  let mainCount = 0;
  let textLength = 0;
  const textParts: string[] = [];
  let headingBuf: { level: number; landmark: Landmark; text: string[] } | null =
    null;
  let button: { ariaLabel: string | null; text: string[] } | null = null;
  const images: HtmlFacts["images"][number][] = [];
  const jsonLdBlocks: string[] = [];
  const hreflang: { lang: string; href: string }[] = [];
  const skeletonParts = new Set<string>();
  const stack: string[] = [];
  let words = 0;
  let skipDepth = 0;
  let titleBuf: string[] | null = null;
  let h1Buf: string[] | null = null;
  let anchor: {
    href: string;
    rel: string | null;
    target: string | null;
    ariaLabel: string | null;
    text: string[];
  } | null = null;
  let jsonLdBuf: string[] | null = null;

  const resolve = (href: string) => {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  };

  const landmark = (): Landmark => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const tag = stack[i] ?? "";
      if (isLandmark(tag)) return tag;
    }
    return null;
  };

  function readMarkupOpen(name: string, attrs: Record<string, string>) {
    const level = HEADING.exec(name)?.[1];
    if (level)
      headingBuf = { level: Number(level), landmark: landmark(), text: [] };
    if (name === "main") mainCount += 1;
    if (name === "nav")
      navLabels.push(attrs["aria-label"] ?? attrs["aria-labelledby"] ?? null);
    if (name === "script") {
      scripts.push({
        src: attrs.src ? resolve(attrs.src) : null,
        type: attrs.type ?? null,
        async: "async" in attrs,
        defer: "defer" in attrs,
        inHead: stack.includes("head"),
      });
    }
    if (name === "link" && attrs.href) {
      const rel = (attrs.rel ?? "").toLowerCase();
      if (!/canonical/.test(rel) && !attrs.hreflang)
        headLinks.push({
          rel,
          href: resolve(attrs.href),
          as: attrs.as ?? null,
          type: attrs.type ?? null,
        });
    }
    if (name === "button")
      button = { ariaLabel: attrs["aria-label"] ?? null, text: [] };
    if (name === "table") counts.tables += 1;
    if (name === "ul" || name === "ol" || name === "dl") counts.lists += 1;
    if (name === "form") counts.forms += 1;
    if (name === "iframe") counts.iframes += 1;
    if (name === "video") {
      counts.videos += 1;
      videos.push({
        src: attrs.src ? resolve(attrs.src) : null,
        poster: attrs.poster ? resolve(attrs.poster) : null,
        autoplay: "autoplay" in attrs,
        muted: "muted" in attrs,
        controls: "controls" in attrs,
      });
    }
  }

  function readMarkupClose(name: string) {
    if (HEADING.test(name) && headingBuf) {
      headings.push({
        level: headingBuf.level,
        text: collapse(headingBuf.text.join("")),
        landmark: headingBuf.landmark,
      });
      headingBuf = null;
    }
    if (name === "button" && button) {
      buttons.push({
        text: collapse(button.text.join(" ")),
        ariaLabel: button.ariaLabel,
      });
      button = null;
    }
  }

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        stack.push(name);
        if (STRUCTURAL.has(name) && stack.length <= 8) {
          skeletonParts.add(stack.filter((t) => STRUCTURAL.has(t)).join("/"));
        }
        if (name === "html" && attrs.lang) head.lang = attrs.lang;
        readMarkupOpen(name, attrs);
        if (name === "title" && head.title === null) titleBuf = [];
        if (name === "h1") h1Buf = [];
        if (name === "script") {
          const type = (attrs.type ?? "").toLowerCase();
          if (type === "application/ld+json") jsonLdBuf = [];
        }
        if (SKIP_TEXT.has(name)) skipDepth += 1;
        if (name === "meta") readMeta(head, attrs);
        if (name === "link" && attrs.href)
          readLink(head, hreflang, attrs, resolve);
        if (name === "a" && attrs.href !== undefined) {
          anchor = {
            href: resolve(attrs.href),
            rel: attrs.rel ?? null,
            target: attrs.target ?? null,
            ariaLabel: attrs["aria-label"] ?? null,
            text: [],
          };
        }
        if (name === "img") {
          images.push({
            src: resolve(attrs.src ?? ""),
            dataSrc: attrs["data-src"] ? resolve(attrs["data-src"]) : null,
            srcset: attrs.srcset ?? null,
            alt: attrs.alt ?? null,
            width: attrs.width ?? null,
            height: attrs.height ?? null,
            loading: attrs.loading ?? null,
            fetchpriority: attrs.fetchpriority ?? null,
          });
          if (anchor && attrs.alt) anchor.text.push(attrs.alt);
        }
      },
      ontext(text) {
        if (jsonLdBuf) jsonLdBuf.push(text);
        if (titleBuf) titleBuf.push(text);
        if (skipDepth > 0) return;
        if (h1Buf) h1Buf.push(text);
        if (anchor) anchor.text.push(text);
        if (headingBuf) headingBuf.text.push(text);
        if (button) button.text.push(text);
        if (textLength < MAX_TEXT) {
          textParts.push(text);
          textLength += text.length;
        }
        words += countWords(text);
      },
      onclosetag(name) {
        // htmlparser2 closes implied tags in order; pop to the matching one.
        const at = stack.lastIndexOf(name);
        if (at >= 0) stack.length = at;
        if (name === "title" && titleBuf) {
          head.title = collapse(titleBuf.join(""));
          titleBuf = null;
        }
        readMarkupClose(name);
        if (name === "h1" && h1Buf) {
          h1.push(collapse(h1Buf.join("")));
          h1Buf = null;
        }
        if (name === "script" && jsonLdBuf) {
          jsonLdBlocks.push(jsonLdBuf.join(""));
          jsonLdBuf = null;
        }
        if (SKIP_TEXT.has(name) && skipDepth > 0) skipDepth -= 1;
        if (name === "a" && anchor) {
          links.push({
            href: anchor.href,
            text: collapse(anchor.text.join(" ")),
            rel: anchor.rel,
            target: anchor.target,
            ariaLabel: anchor.ariaLabel,
          });
          anchor = null;
        }
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
    },
  );
  parser.write(html);
  parser.end();
  head.hreflang = hreflang;
  return {
    head,
    h1,
    links,
    images,
    markup: {
      headings,
      mainCount,
      navLabels,
      scripts,
      headLinks,
      buttons,
      videos,
      counts,
      text: collapse(textParts.join(" ")).slice(0, MAX_TEXT),
    },
    jsonLdBlocks,
    words,
    skeleton: sort([...skeletonParts], (a, b) => a.localeCompare(b)).join("|"),
  };
}

function readMeta(head: HtmlFacts["head"], attrs: Record<string, string>) {
  const key = (attrs.name ?? attrs.property ?? "").toLowerCase();
  const content = attrs.content ?? "";
  if (key === "description" && head.metaDescription === null)
    head.metaDescription = content;
  else if (key === "robots") head.robotsMeta = content;
  else if (key === "viewport") head.viewport = content;
  else if (key.startsWith("og:")) head.og[key.slice(3)] = content;
  else if (key.startsWith("twitter:")) head.twitter[key.slice(8)] = content;
  else if (key) head.meta[key] = content;
}

function readLink(
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

function collapse(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function countWords(text: string) {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ? matches.length : 0;
}
