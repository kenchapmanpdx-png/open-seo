import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import {
  createResult,
  formatHeaders,
  headerValue,
  normalizeUrl,
} from "./support";

/**
 * CRAWL/HEADERS (handbook §20–22; gated at intake): llms.txt answers 200 as
 * text/plain or text/markdown and its links resolve to live pages (P9-02;
 * "numbers match the site" is LLM fact-table work in B3); each 200 `.md`
 * mirror sends `X-Robots-Tag: noindex` or a canonical `Link` header and its
 * HTML page exposes `<link rel=alternate type=text/markdown>` (P9-03; "key
 * facts mirrored" is LLM work in B3).
 */
const ITEMS = ["P9-02", "P9-03"];

export const llmsMirrorsCheck: HandbookCheck = {
  id: "crawl.llms-mirrors",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["llms", "pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { llms, pages } = ctx.collected;
    if (llms.status !== "ok" || pages.status !== "ok") return out.build();
    const byUrl = new Map(pages.snapshots.map((s) => [normalizeUrl(s.url), s]));

    // P9-02
    const file = llms.files.find((f) =>
      /\/llms\.txt$/i.test(new URL(f.url).pathname),
    );
    if (!file || file.status === 404) {
      out.na("P9-02", "no llms.txt");
    } else {
      const ref = out.evidence(
        "llmsTxt",
        file.url,
        `HTTP ${file.status} · ${file.contentType ?? "(no content-type)"}\n${file.links.slice(0, 40).join("\n")}`,
        file.storageKey,
      );
      const why: string[] = [];
      if (file.status !== 200) why.push(`llms.txt answers ${file.status}`);
      if (!/text\/(plain|markdown)/i.test(file.contentType ?? ""))
        why.push(`content-type ${file.contentType ?? "(none)"}`);
      const dead = file.links.filter((link) => {
        const snap = byUrl.get(normalizeUrl(link));
        return snap !== undefined && snap.status !== 200;
      });
      if (dead.length > 0)
        why.push(
          `links to non-200 pages: ${dead
            .map((l) => `${l} (${byUrl.get(normalizeUrl(l))?.status})`)
            .join(", ")}`,
        );
      if (why.length > 0) {
        out.finding({
          itemIds: ["P9-02"],
          severity: "S3",
          title: "llms.txt is broken or links to dead pages",
          detail: why.join("\n"),
          fix: "Serve llms.txt with 200 as text/plain (or text/markdown) and link only live, canonical pages.",
          fixability: "FIXABLE",
          effort: "S",
          urls: [file.url],
          evidenceRefs: [ref],
        });
      } else {
        const unchecked = file.links.filter((l) => !byUrl.has(normalizeUrl(l)));
        out.pass(
          "P9-02",
          `llms.txt 200 ${file.contentType}; ${file.links.length - unchecked.length} crawled link(s) live, ${unchecked.length} not crawled; numbers vs site pending (LLM B3)`,
          [ref],
        );
      }
    }

    // P9-03
    const mirrors = llms.mdMirrors.filter((m) => m.status === 200);
    if (mirrors.length === 0) {
      out.na("P9-03", "no .md mirror answered 200");
      return out.build();
    }
    const issues = mirrors.flatMap((m) => {
      const why: string[] = [];
      const robots = headerValue(m.headers, "x-robots-tag") ?? "";
      const link = headerValue(m.headers, "link") ?? "";
      if (!/noindex/i.test(robots) && !/rel="?canonical"?/i.test(link))
        why.push("no X-Robots-Tag: noindex or canonical Link header");
      const page = byUrl.get(normalizeUrl(m.pageUrl));
      const alternate = page?.markup.headLinks.some(
        (l) =>
          /\balternate\b/i.test(l.rel) && /text\/markdown/i.test(l.type ?? ""),
      );
      if (page && !alternate)
        why.push(`${m.pageUrl} has no <link rel=alternate type=text/markdown>`);
      return why.length > 0 ? [{ m, why }] : [];
    });
    const ref = (m: (typeof mirrors)[number]) =>
      out.evidence(
        "header",
        m.mdUrl,
        `HTTP ${m.status}\n${formatHeaders(m.headers)}`,
      );
    if (issues.length > 0) {
      out.finding({
        itemIds: ["P9-03"],
        severity: "S3",
        title: ".md mirrors lack noindex/canonical or an alternate link",
        detail: issues
          .map(({ m, why }) => `${m.mdUrl} — ${why.join("; ")}`)
          .join("\n"),
        fix: 'Send `X-Robots-Tag: noindex` (or `Link: <page>; rel="canonical"`) on each .md mirror and add `<link rel="alternate" type="text/markdown" href="…md">` to its HTML page.',
        fixability: "FIXABLE",
        effort: "S",
        urls: issues.map(({ m }) => m.mdUrl),
        evidenceRefs: issues.map(({ m }) => ref(m)),
      });
    } else {
      out.pass(
        "P9-03",
        `${mirrors.length} .md mirror(s) with noindex/canonical header and alternate link; key facts pending (LLM B3)`,
        mirrors.slice(0, 5).map(ref),
      );
    }
    return out.build();
  },
};
