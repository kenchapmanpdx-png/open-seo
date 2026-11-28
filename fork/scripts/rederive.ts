// Re-derive one or more checks from stored raw HTML (no fetches; B25 "Cases").
//
//   pnpm exec tsx fork/scripts/rederive.ts <check-id>[,<check-id>] <dir>...
//
// <dir> = a raw-dl output dir (`index.tsv`: status \t file \t url, files =
// stored raw HTML of one run, plain or gzipped). Pages are rebuilt with the current
// `extractHtmlFacts` (the crawl's own parser), then the named checks run with
// only `pages` collected. Prints each finding: item, severity, title, URLs.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { HANDBOOK_CHECKS } from "@/server/features/handbook/checks";
import { context } from "@/server/features/handbook/checks/check-test-fixtures";
import { pageBlocks } from "@/server/features/handbook/engine/boilerplate";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { mainTextFacts } from "@/server/features/handbook/engine/minhash";
import { parseBlock } from "@/server/features/handbook/collectors/jsonld-parse";
import type { JsonLdData } from "@/server/features/handbook/contracts/collectors";

/** JSON-LD per page, rebuilt from the same stored HTML (B26). */
const jsonldPages: JsonLdData["pages"][number][] = [];

const [ids, ...dirs] = process.argv.slice(2);
if (!ids || dirs.length === 0) {
  console.error("usage: rederive.ts <check-id>[,<id>] <raw-dl dir>...");
  process.exit(2);
}
const checks = ids.split(",").map((id) => {
  const check = HANDBOOK_CHECKS.find((c) => c.id === id);
  if (!check) throw new Error(`unknown check ${id}`);
  return check;
});

function loadPages(dir: string): PageSnapshot[] {
  const rows = readFileSync(join(dir, "index.tsv"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"));
  return rows.flatMap(([status, file, url]) => {
    if (!/\.html(\.gz)?$/.test(file)) return [];
    const bytes = readFileSync(join(dir, file));
    const html = (file.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString(
      "utf8",
    );
    const facts = extractHtmlFacts(html, url);
    const parsed = facts.jsonLdBlocks.map((raw, i) => parseBlock(raw, i));
    jsonldPages.push({
      url,
      blocks: parsed.map((p) => p.block),
      nodes: parsed.flatMap((p) => p.nodes),
    });
    return [
      {
        url,
        finalUrl: url,
        status: Number(status),
        contentType: "text/html",
        rawKey: file,
        wordsRaw: facts.words,
        bytesRaw: html.length,
        head: facts.head,
        h1: facts.h1,
        links: facts.links,
        images: facts.images,
        xRobotsTag: null,
        markup: facts.markup,
        doctype: facts.doctype,
        ...mainTextFacts(html, pageBlocks(html)),
      },
    ];
  });
}

for (const dir of dirs) {
  jsonldPages.length = 0;
  const snapshots = loadPages(dir);
  console.log(`== ${dir} (${snapshots.length} pages)`);
  for (const check of checks) {
    // SP7=Y in the environment = a local business site (SP7 rules run).
    const ctx = {
      ...context({
        pages: { status: "ok", snapshots },
        jsonld: { status: "ok", pages: [...jsonldPages] },
      }),
      siteProfile:
        process.env.SP7 === "Y"
          ? [
              {
                code: "SP7" as const,
                value: "Y" as const,
                evidence: "rederive",
                confidence: "high" as const,
              },
            ]
          : [],
    };
    const result = await check.run({
      ...ctx,
      origin: new URL(snapshots[0].url).origin,
    });
    for (const f of result.findings)
      console.log(
        `${f.itemIds.join("+")} ${f.severity} ${f.title} — ${f.urls.length} url(s): ${f.urls.slice(0, 6).join(" ")}${process.env.DETAIL ? `\n${f.detail}` : ""}`,
      );
  }
}
