import { sort } from "remeda";
import { Parser } from "htmlparser2";
import type {
  MarkupEmbed,
  MarkupVideo,
  PageMarkup,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { aspectRatio, embedOf } from "./video-embeds";
import { createProseReader } from "./prose-reader";
import { readLink, readMeta } from "./html-head";
import { hiddenTextTracker } from "./hidden-text";
import { readImage } from "./page-images";

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
  /** `<!doctype …>` text, or null when the HTML has none (SUPP-26). 1.10.0 */
  doctype: string | null;
};

const SKIP_TEXT = new Set(["script", "style", "noscript", "template", "svg"]);

const LANDMARKS = ["header", "nav", "footer", "aside"] as const;
const isLandmark = (tag: string): tag is (typeof LANDMARKS)[number] =>
  (LANDMARKS as readonly string[]).includes(tag);
const HEADING = /^h([1-6])$/;
const MAX_TEXT = 20_000;
/**
 * SUPP-14: a line that reads as a list item — "•", "▪", "✓", "–", "1." / "1)"
 * or "Step N" at its start. Lines end at `<br>` and block tags.
 */
const LIST_MARKER = /^(?:[•▪✓–]|\d{1,2}[.)](?=\s)|step\s+\d+\b)/i;
const LINE_BREAKS = new Set(
  "br p div li ul ol dl table tr td th section article main header footer nav aside h1 h2 h3 h4 h5 h6 blockquote".split(
    " ",
  ),
);
const REAL_LIST = new Set(["ul", "ol", "dl", "table"]);
/**
 * Text-level (inline) tags: the browser prints the text either side of them
 * with no gap, so `Zebra<span>Thrive</span>` reads "ZebraThrive" and
 * `1<sup>st</sup>` "1st" (WO-B26-007). Every other tag is an element boundary
 * and adds a space. A utility class that makes one of these a box (Tailwind
 * `block`, Bootstrap `d-block`), or a flex / grid parent (which blockifies
 * its children), makes it a boundary too.
 */
const INLINE = new Set(
  "span abbr b bdi bdo cite code data dfn em i kbd mark q s samp small strong sub sup time u var font del ins wbr".split(
    " ",
  ),
);
const BOX_CLASS =
  /^(?:[\w-]+:)?(?:block|flex|grid|table|list-item|flow-root)$|^d-(?:\w+-)?(?:block|flex|grid|table)$/;
const FLEX_CLASS =
  /^(?:[\w-]+:)?(?:inline-)?(?:flex|grid)$|^d-(?:\w+-)?(?:inline-)?(?:flex|grid)$/;
const MIN_FAKE_LIST_LINES = 3;
/** A `<p>` this long is the page's first answer block (SUPP-13). */
const FIRST_ANSWER_MIN_WORDS = 15;
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
  let doctype = null as string | null;
  const headings: PageMarkup["headings"][number][] = [];
  const navLabels: (string | null)[] = [];
  const scripts: PageMarkup["scripts"][number][] = [];
  const headLinks: PageMarkup["headLinks"][number][] = [];
  const buttons: PageMarkup["buttons"][number][] = [];
  const videos: MarkupVideo[] = [];
  const embeds: MarkupEmbed[] = [];
  let video: {
    sources: { src: string; type: string | null }[];
    tracks: { kind: string | null; src: string | null }[];
  } | null = null;
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
  /** Stack depth of the open `data-nosnippet` element (0 = none). */
  let nosnippetAt = 0;
  const hidden = hiddenTextTracker(MAX_TEXT);
  let nosnippetWords = 0;
  /** The first answer paragraph being read (SUPP-13); done once one qualifies. */
  let para: { at: number; nosnippet: boolean; text: string[] } | null = null;
  // Set inside parser callbacks, which TypeScript's narrowing does not see.
  let firstAnswer = null as { nosnippet: boolean; text: string } | null;
  const prose = createProseReader(MAX_TEXT);
  let line: string[] = [];
  let run: string[] = [];
  const fakeListRuns: { sample: string; lines: number }[] = [];
  const endRun = () => {
    if (run.length >= MIN_FAKE_LIST_LINES)
      fakeListRuns.push({
        sample: run.slice(0, 3).join(" / ").slice(0, 300),
        lines: run.length,
      });
    run = [];
  };
  /** Close the current text line; list-like lines extend the run, others end it. */
  const endLine = () => {
    const text = collapse(line.join(""));
    line = [];
    if (!text) return;
    if (LIST_MARKER.test(text) && !stack.some((t) => REAL_LIST.has(t)))
      run.push(text);
    else endRun();
  };
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
    const embed = embedOf(name, attrs, resolve);
    if (embed) embeds.push(embed);
    if (name === "video") {
      counts.videos += 1;
      video = { sources: [], tracks: [] };
      videos.push({
        src: attrs.src ? resolve(attrs.src) : null,
        poster: attrs.poster ? resolve(attrs.poster) : null,
        autoplay: "autoplay" in attrs,
        muted: "muted" in attrs,
        controls: "controls" in attrs,
        preload: attrs.preload ?? null,
        loop: "loop" in attrs,
        width: attrs.width ?? null,
        height: attrs.height ?? null,
        aspectRatio: aspectRatio(attrs.style),
        sources: video.sources,
        tracks: video.tracks,
      });
    }
    if (name === "source" && video && attrs.src)
      video.sources.push({ src: resolve(attrs.src), type: attrs.type ?? null });
    if (name === "track" && video)
      video.tracks.push({
        kind: attrs.kind ?? null,
        src: attrs.src ? resolve(attrs.src) : null,
      });
  }

  function readMarkupClose(name: string) {
    if (name === "video") video = null;
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
        text: collapse(button.text.join("")),
        ariaLabel: button.ariaLabel,
      });
      button = null;
    }
  }

  /**
   * One text run = the text between two tags. htmlparser2 emits a decoded
   * character reference (`&#x27;`, `&amp;`) and the text either side of a
   * comment (React's `a<!-- -->b`) as separate chunks; they join with no
   * separator so `what&#x27;s` reads `what's`, not `what ' s` (WO-B26-001).
   * Spaces are added only between runs, i.e. at element boundaries.
   */
  let textRun: string[] = [];
  /** A block boundary passed since the last text run: the next run starts with a space. */
  let gap = false;
  /** Per open element (parallel to `stack`): boundary? flex/grid container? */
  const boxes: { boundary: boolean; flex: boolean }[] = [];
  function endText() {
    if (textRun.length === 0) return;
    const text = (gap ? " " : "") + textRun.join("");
    textRun = [];
    gap = false;
    readText(text);
  }
  function readText(text: string) {
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
      hidden.text(text);
    }
    const n = countWords(text);
    words += n;
    if (nosnippetAt > 0) nosnippetWords += n;
    if (para) para.text.push(text);
    prose.text(text);
    line.push(text);
  }

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        endText();
        if (LINE_BREAKS.has(name)) endLine();
        const classes = (attrs.class ?? "").split(/\s+/);
        const boundary =
          !INLINE.has(name) ||
          boxes.at(-1)?.flex === true ||
          classes.some((c) => BOX_CLASS.test(c));
        boxes.push({ boundary, flex: classes.some((c) => FLEX_CLASS.test(c)) });
        gap ||= boundary;
        hidden.open(attrs, stack.push(name)); // push returns the new depth
        if (nosnippetAt === 0 && "data-nosnippet" in attrs)
          nosnippetAt = stack.length;
        if (name === "p" && !para && !firstAnswer && !stack.some(isLandmark))
          para = { at: stack.length, nosnippet: nosnippetAt > 0, text: [] };
        prose.open(name, stack);
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
          const image = readImage(attrs, stack, resolve);
          if (image) images.push(image);
          if (anchor && attrs.alt) anchor.text.push(` ${attrs.alt} `);
        }
      },
      onprocessinginstruction(name, data) {
        endText();
        if (name.toLowerCase() === "!doctype" && doctype === null)
          doctype = data;
      },
      ontext(text) {
        textRun.push(text);
      },
      onclosetag(name) {
        endText();
        if (LINE_BREAKS.has(name)) endLine();
        // htmlparser2 closes implied tags in order; pop to the matching one.
        const at = stack.lastIndexOf(name);
        if (at >= 0) {
          gap ||= boxes.slice(at).some((b) => b.boundary);
          stack.length = at;
          boxes.length = at;
        }
        if (nosnippetAt > stack.length) nosnippetAt = 0;
        hidden.close(stack.length);
        if (para && para.at > stack.length) {
          const text = collapse(para.text.join(""));
          if (countWords(text) >= FIRST_ANSWER_MIN_WORDS)
            firstAnswer = { nosnippet: para.nosnippet, text };
          para = null;
        }
        prose.close(stack);
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
            text: collapse(anchor.text.join("")),
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
  endText();
  endLine();
  endRun();
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
      embeds,
      counts,
      text: collapse(textParts.join("")).slice(0, MAX_TEXT),
      ...hidden.result(),
      ...(nosnippetWords ? { nosnippetWords } : {}),
      ...(firstAnswer?.nosnippet
        ? { firstAnswerNosnippet: firstAnswer.text.slice(0, 200) }
        : {}),
      ...(fakeListRuns.length ? { fakeListRuns } : {}),
      ...(prose.result().length ? { prose: prose.result() } : {}),
    },
    jsonLdBlocks,
    words,
    skeleton: sort([...skeletonParts], (a, b) => a.localeCompare(b)).join("|"),
    doctype,
  };
}

function collapse(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function countWords(text: string) {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ? matches.length : 0;
}
