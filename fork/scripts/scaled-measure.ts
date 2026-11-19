/**
 * B11 R1 measurement (fork/batches/B11-heavy-scaled-content-copy.md R1.3):
 * reads a stored CLI run directory (collected.json + rawHtml evidence), no
 * new crawl, no network. Per template: pairwise shared-sentence ratios on
 * page text with site chrome removed, and the SUPP-17 candidate sets
 * (connected groups of ≥ 3 pages) at ratios 0.5 / 0.6 / 0.7. Also counts
 * SUPP-19 Pattern A / B hits over raw HTML (SCALED-COPY §3.4).
 * Chrome = a sentence on pages of ≥ 2 templates (ADR-022); CHROME_SHARE=0.5
 * instead drops sentences on ≥ 50 % of all pages (R1 comparison).
 * SHOW_SETS=1 lists the members of each set at 0.5.
 *
 *   pnpm tsx fork/scripts/scaled-measure.ts fork/runs/b10/why-r54 [...]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { pageBlocks } from "@/server/features/handbook/engine/boilerplate";
import { pathPatterns } from "@/server/features/handbook/engine/depth";

type Page = {
  url: string;
  template: string;
  title: string;
  h1: string;
  sentences: Set<string>;
  html: string;
};

const slug = (url: string) =>
  url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .slice(0, 60);

const sentencesOf = (blocks: readonly string[]) =>
  blocks
    .flatMap((b) => b.split(/(?<=[.!?])\s+/))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 20);

function loadPages(dir: string): Page[] {
  const collected = JSON.parse(
    readFileSync(join(dir, "collected.json"), "utf8"),
  ) as { pages: { url: string; finalUrl: string; status: number }[] };
  const [runDir] = readdirSync(join(dir, "evidence/cli"));
  const rawDir = join(dir, "evidence/cli", runDir, "rawHtml");
  const files = readdirSync(rawDir);
  const ok = collected.pages.filter((p) => p.status === 200);
  const patterns = pathPatterns(ok.map((p) => p.url));
  const pages: Page[] = [];
  for (const p of ok) {
    const s = slug(p.finalUrl);
    const file = files.find((f) => f.slice(13).startsWith(`${s}.`));
    if (!file) continue;
    const html = gunzipSync(readFileSync(join(rawDir, file))).toString("utf8");
    const facts = extractHtmlFacts(html, p.finalUrl);
    const hash = createHash("sha256")
      .update(facts.skeleton)
      .digest("hex")
      .slice(0, 8);
    pages.push({
      url: p.url,
      template: `${patterns.get(p.url) ?? "/"}:${hash}`,
      title: facts.head.title ?? "",
      h1: facts.h1[0] ?? "",
      sentences: new Set(sentencesOf(pageBlocks(html))),
      html,
    });
  }
  return pages;
}

/** Chrome = a sentence found on pages of ≥ 2 templates. */
function stripChrome(pages: Page[]) {
  const templatesBySentence = new Map<string, Set<string>>();
  const pagesBySentence = new Map<string, number>();
  for (const p of pages)
    for (const s of p.sentences) {
      pagesBySentence.set(s, (pagesBySentence.get(s) ?? 0) + 1);
      const set = templatesBySentence.get(s) ?? new Set();
      set.add(p.template);
      templatesBySentence.set(s, set);
    }
  return pages.map((p) => ({
    ...p,
    own: new Set(
      [...p.sentences].filter((s) =>
        process.env.CHROME_SHARE
          ? (pagesBySentence.get(s) ?? 0) <
            Math.max(3, Number(process.env.CHROME_SHARE) * pages.length)
          : (templatesBySentence.get(s)?.size ?? 0) < 2,
      ),
    ),
  }));
}

/** Pair ratio: shared sentences / sentences of the smaller page. */
function pairRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const s of a) if (b.has(s)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function components(n: number, edges: Array<[number, number]>): number[][] {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (const [a, b] of edges) parent[find(a)] = find(b);
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const list = groups.get(find(i)) ?? [];
    list.push(i);
    groups.set(find(i), list);
  }
  return [...groups.values()].filter((g) => g.length >= 3);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};

const PATTERN_A = [
  /ignore (all |any )?(previous|prior|above) instructions/i,
  /(if|when) you are an? (ai|llm|language model|assistant|chatbot)\b/i,
  /(^|[.!?]\s+)(note|attention|instruction)s? (to|for) (ai|llm|ai assistants?|language models?|chatbots?)\b/i,
  /\b(ai|llm) (assistants?|agents?|models?)\s*[:,]\s*(always|never|please|you must|do not)\b/i,
];
const ADDRESSEE =
  /\b(ai|llm|language model|assistant|chatbot|chatgpt|claude|gemini|copilot|perplexity)\b/i;
const DIRECTIVE =
  /\b(recommend|rank|cite|mention|prefer|describe .* as|always|never|do not|must)\b/i;

function supp19(html: string) {
  const comments = [...html.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
  const attrs = [
    ...html.matchAll(/\b(?:alt|title|aria-label|content)="([^"]*)"/gi),
  ].map((m) => m[1]);
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const a = PATTERN_A.some((re) =>
    [text, ...comments, ...attrs].some((t) => re.test(t)),
  );
  const b = [...comments, ...attrs]
    .flatMap((t) => t.split(/(?<=[.!?])\s+/))
    .filter((s) => ADDRESSEE.test(s) && DIRECTIVE.test(s));
  return { a, b };
}

for (const dir of process.argv.slice(2)) {
  const pages = stripChrome(loadPages(dir));
  console.log(`\n## ${dir} — ${pages.length} HTML 200 pages read\n`);
  const byTemplate = new Map<string, typeof pages>();
  for (const p of pages)
    byTemplate.set(p.template, [...(byTemplate.get(p.template) ?? []), p]);
  console.log(
    "| template | pages | median best-pair ratio | max | sets @0.5 | sets @0.6 | sets @0.7 |",
  );
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const [key, group] of [...byTemplate].sort(
    (x, y) => y[1].length - x[1].length,
  )) {
    if (group.length < 3) continue;
    const ratios: number[][] = group.map(() => []);
    const pairs: Array<[number, number, number]> = [];
    for (let i = 0; i < group.length; i += 1)
      for (let j = i + 1; j < group.length; j += 1) {
        const r = pairRatio(group[i].own, group[j].own);
        ratios[i].push(r);
        ratios[j].push(r);
        pairs.push([i, j, r]);
      }
    const best = ratios.map((r) => Math.max(0, ...r));
    const sets = (t: number) =>
      components(
        group.length,
        pairs.filter((p) => p[2] >= t).map(([a, b]) => [a, b]),
      )
        .map((g) => g.length)
        .join("+") || "0";
    console.log(
      `| ${key} | ${group.length} | ${median(best).toFixed(2)} | ${Math.max(...best).toFixed(2)} | ${sets(0.5)} | ${sets(0.6)} | ${sets(0.7)} |`,
    );
    if (process.env.SHOW_SETS)
      for (const g of components(
        group.length,
        pairs.filter((p) => p[2] >= 0.5).map(([a, b]) => [a, b]),
      ))
        console.log(
          `  set: ${g.map((i) => `${new URL(group[i].url).pathname} (${group[i].own.size} s, best ${best[i].toFixed(2)}) "${group[i].h1}"`).join(" · ")}`,
        );
  }
  const hits = pages.flatMap((p) => {
    const h = supp19(p.html);
    return h.a || h.b.length
      ? [`${p.url} A=${h.a} B=${h.b.slice(0, 2).join(" / ").slice(0, 160)}`]
      : [];
  });
  console.log(`\nSUPP-19 pages with hits: ${hits.length}`);
  for (const h of hits) console.log(`- ${h}`);
}
