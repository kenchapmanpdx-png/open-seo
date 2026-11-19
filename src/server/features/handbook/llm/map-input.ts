import { Parser } from "htmlparser2";
import type {
  CollectedData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import { normalizeUrl } from "../checks/support";

/**
 * Map-stage input (ADR-019, FULL-READ §5.1): one job per HTML 200 page (head
 * lines + page-unique text blocks, rendered-only blocks marked, image alt /
 * file name and video lines), one per template for its boilerplate, one per
 * llms.txt file (in full).
 */

export type MapJob = {
  url: string;
  scope: PageProfile["scope"];
  templateKey: string | null;
  /** Assembled input text; its sha256 is the cache key part. */
  text: string;
};

const MAX_IMAGE_LINES = 60;
const MAX_VIDEO_LINES = 20;

const SKIP = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "select",
  "textarea",
]);
const BLOCK = new Set([
  "p",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "td",
  "th",
  "dt",
  "dd",
  "blockquote",
  "figcaption",
  "div",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "nav",
  "aside",
  "br",
  "tr",
  "button",
  "label",
]);

/**
 * Unique visible text blocks in document order, split at every block-level
 * tag. Header / nav / footer text is kept: on templated pages it matches the
 * template's boilerplate blocks and is removed there; on one-off pages (home,
 * contact) it may carry the only contact or award text.
 */
function textBlocks(html: string): string[] {
  const blocks = new Set<string>();
  let buf: string[] = [];
  let skip = 0;
  const flush = () => {
    const text = buf.join("").replace(/\s+/g, " ").trim();
    if (text) blocks.add(text);
    buf = [];
  };
  const parser = new Parser(
    {
      onopentag(name) {
        if (BLOCK.has(name)) flush();
        if (SKIP.has(name)) skip += 1;
      },
      ontext(text) {
        if (skip === 0) buf.push(text);
      },
      onclosetag(name) {
        if (SKIP.has(name)) skip = Math.max(0, skip - 1);
        if (BLOCK.has(name)) flush();
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  flush();
  return [...blocks];
}

const fileName = (src: string): string => {
  if (src.startsWith("data:")) return "";
  try {
    return decodeURIComponent(
      new URL(src, "https://x.invalid/").pathname.split("/").pop() ?? "",
    );
  } catch {
    return "";
  }
};

const quoteAttr = (s: string) => s.replace(/\s+/g, " ").trim();

/** Head lines, page-unique blocks, rendered-only blocks, image and video lines. */
function pageText(
  page: PageSnapshot,
  boilerplate: ReadonlySet<string>,
  rawHtml: string | null,
  renderedHtml: string | null,
): string {
  const rawBlocks = rawHtml ? textBlocks(rawHtml) : [page.markup.text];
  const rawSet = new Set(rawBlocks);
  const renderedOnly = renderedHtml
    ? textBlocks(renderedHtml).filter(
        (b) => !rawSet.has(b) && !boilerplate.has(b),
      )
    : [];
  const images = new Set<string>();
  for (const img of page.images) {
    const alt = img.alt ? quoteAttr(img.alt) : "";
    const file = fileName(img.src || img.dataSrc || "");
    if (alt || file) images.add(`[image] alt="${alt}" file=${file}`);
  }
  const videos = new Set([
    ...page.markup.videos.map((v) => `[video] <video> ${v.src ?? ""}`),
    ...(page.markup.embeds ?? []).map(
      (e) => `[video] ${e.provider} ${e.videoId ?? e.src}`,
    ),
  ]);
  return [
    `title: ${page.head.title ?? ""}`,
    `meta description: ${page.head.metaDescription ?? ""}`,
    `h1: ${page.h1.join(" | ")}`,
    `canonical: ${page.head.canonical ?? ""}`,
    `og:title: ${page.head.og["og:title"] ?? page.head.og.title ?? ""}`,
    "",
    ...rawBlocks.filter((b) => !boilerplate.has(b)),
    ...renderedOnly.map((b) => `[rendered-only] ${b}`),
    ...[...images].slice(0, MAX_IMAGE_LINES),
    ...[...videos].slice(0, MAX_VIDEO_LINES),
  ].join("\n");
}

/**
 * Map jobs for everything collected: HTML 200 pages, template boilerplate,
 * llms.txt files. `loadBody` reads a stored body (raw or rendered HTML).
 */
export async function buildMapJobs(
  collected: Partial<CollectedData>,
  loadBody: (key: string) => Promise<Uint8Array | null>,
): Promise<MapJob[]> {
  const jobs: MapJob[] = [];
  const templates =
    collected.templates?.status === "ok" ? collected.templates.templates : [];
  const boilerplateByUrl = new Map<string, ReadonlySet<string>>();
  for (const t of templates) {
    const blocks = t.boilerplate?.blocks ?? [];
    if (blocks.length === 0) continue;
    const set = new Set(blocks);
    for (const url of t.urls) boilerplateByUrl.set(normalizeUrl(url), set);
  }
  const rendered = new Map(
    collected.render?.status === "ok"
      ? collected.render.pages.map((p) => [normalizeUrl(p.url), p.js])
      : [],
  );
  const read = async (key: string | null | undefined) => {
    if (!key) return null;
    const bytes = await loadBody(key);
    return bytes ? new TextDecoder().decode(bytes) : null;
  };

  const seen = new Set<string>();
  const snapshots =
    collected.pages?.status === "ok" ? collected.pages.snapshots : [];
  for (const page of snapshots) {
    const url = normalizeUrl(page.url);
    if (page.status !== 200 || seen.has(url)) continue;
    if (!(page.contentType ?? "text/html").includes("html")) continue;
    seen.add(url);
    const text = pageText(
      page,
      boilerplateByUrl.get(url) ?? new Set<string>(),
      await read(page.rawKey),
      await read(rendered.get(url)?.renderedKey),
    );
    jobs.push({
      url: page.url,
      scope: "page",
      templateKey: null,
      text,
    });
  }

  for (const t of templates) {
    const blocks = t.boilerplate?.blocks ?? [];
    const url = t.urls[0];
    if (blocks.length === 0 || !url) continue;
    jobs.push({
      url,
      scope: "template",
      templateKey: t.key,
      text: ["[template boilerplate]", ...blocks].join("\n"),
    });
  }

  // llms.txt in full, intro blockquote included (B8 R3 why-F19 miss).
  const llms = collected.llms?.status === "ok" ? collected.llms.files : [];
  for (const file of llms) {
    if (file.status !== 200 || !file.text?.trim()) continue;
    jobs.push({
      url: file.url,
      scope: "page",
      templateKey: null,
      text: `[llms.txt]\n${file.text}`,
    });
  }
  return jobs;
}
