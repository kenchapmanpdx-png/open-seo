import { Parser } from "htmlparser2";

/**
 * Template boilerplate split (FULL-READ §3.11, ADR-021). Block = text of a
 * block-level element (p, li, h1–h6, td) with whitespace collapsed; a block
 * on ≥ 80 % of a template's pages is that template's boilerplate, stored
 * once per template. Page-unique text = the page's blocks minus these (the
 * map stage, WO-B9-015). Templates with < 3 pages have no boilerplate.
 */
const BLOCK = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td"]);
const SKIP = new Set(["script", "style", "noscript", "template", "svg"]);
const SHARE = 0.8;
const MIN_PAGES = 3;

/** Unique block texts of a page, in document order. */
export function pageBlocks(html: string): string[] {
  const blocks = new Set<string>();
  const stack: string[][] = [];
  let skip = 0;
  const parser = new Parser(
    {
      onopentag(name) {
        if (SKIP.has(name)) skip += 1;
        if (BLOCK.has(name)) stack.push([]);
      },
      ontext(text) {
        if (skip === 0) stack.at(-1)?.push(text);
      },
      onclosetag(name) {
        if (SKIP.has(name)) skip = Math.max(0, skip - 1);
        if (!BLOCK.has(name)) return;
        const text = (stack.pop() ?? []).join("").replace(/\s+/g, " ").trim();
        if (text) blocks.add(text);
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  return [...blocks];
}

/** Blocks shared by ≥ 80 % of the pages (each page's blocks given once). */
export function templateBoilerplate(
  pages: ReadonlyArray<readonly string[]>,
): { blocks: string[]; words: number } | undefined {
  if (pages.length < MIN_PAGES) return undefined;
  const counts = new Map<string, number>();
  for (const blocks of pages)
    for (const block of new Set(blocks))
      counts.set(block, (counts.get(block) ?? 0) + 1);
  const blocks = [...counts]
    .filter(([, n]) => n >= SHARE * pages.length)
    .map(([block]) => block);
  const words = blocks.reduce(
    (sum, b) => sum + (b.match(/[\p{L}\p{N}]+/gu)?.length ?? 0),
    0,
  );
  return { blocks, words };
}
