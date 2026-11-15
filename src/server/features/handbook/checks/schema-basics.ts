import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { JsonLdData } from "@/server/features/handbook/contracts/collectors";
import { createResult } from "./support";

/**
 * SCHEMA (handbook §24): the home page graph has a WebSite node with name,
 * url and alternateName (P6-01); every emitted block is inventoried, URL
 * properties are absolute (on-site: the run origin's scheme; off-site:
 * https) and no property is empty (P6-02).
 */
const ITEMS = ["P6-01", "P6-02"];

const URL_KEYS = new Set([
  "url",
  "@id",
  "logo",
  "image",
  "sameAs",
  "item",
  "contentUrl",
  "thumbnailUrl",
]);

type Page = JsonLdData["pages"][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const bare = (h: string) => h.replace(/^www\./, "");

function urlProblem(value: string, origin: URL): string | null {
  if (value.startsWith("//")) return "protocol-relative";
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return "relative";
  }
  if (bare(u.hostname) === bare(origin.hostname))
    return u.protocol === origin.protocol ? null : `${u.protocol} on-site URL`;
  return u.protocol === "https:" ? null : `${u.protocol} off-site URL`;
}

/** Walk a parsed block; push `path — why` for bad URLs and empty values. */
function walk(value: unknown, path: string, origin: URL, hits: string[]) {
  const key =
    path
      .split(".")
      .at(-1)
      ?.replace(/\[\d+\]$/, "") ?? "";
  if (typeof value === "string") {
    if (!value.trim()) hits.push(`${path} is empty`);
    else if (URL_KEYS.has(key)) {
      const why = urlProblem(value, origin);
      if (why) hits.push(`${path} = "${value}" (${why})`);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) hits.push(`${path} is an empty array`);
    value.forEach((v, i) => walk(v, `${path}[${i}]`, origin, hits));
    return;
  }
  if (isRecord(value)) {
    if (Object.keys(value).length === 0)
      hits.push(`${path} is an empty object`);
    for (const [k, v] of Object.entries(value)) {
      if (k === "@context") continue;
      walk(v, `${path}.${k}`, origin, hits);
    }
  }
}

const typesOf = (page: Page) => [
  ...new Set(page.nodes.flatMap((n) => n.types)),
];

export const schemaBasicsCheck: HandbookCheck = {
  id: "schema.basics",
  itemIds: ITEMS,
  class: "SCHEMA",
  requires: ["jsonld"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { jsonld } = ctx.collected;
    if (jsonld.status !== "ok") return out.build();
    const origin = new URL(ctx.origin);
    const blockRef = (page: Page, excerpt: string) =>
      out.evidence("jsonld", page.url, excerpt);

    // P6-01
    const home = jsonld.pages.find((p) => new URL(p.url).pathname === "/");
    const site = home?.nodes.find((n) => n.types.includes("WebSite"));
    const missing = ["name", "url", "alternateName"].filter((k) => {
      const v = site?.properties[k];
      return typeof v !== "string" || !v.trim();
    });
    if (!home) {
      out.na("P6-01", "home page JSON-LD not collected");
    } else if (!site || missing.length > 0) {
      out.finding({
        itemIds: ["P6-01"],
        severity: "S2",
        title: site
          ? "Home WebSite node is incomplete"
          : "No WebSite node on the home page",
        detail: site
          ? `WebSite node missing ${missing.join(", ")}`
          : `home JSON-LD types: ${typesOf(home).join(", ") || "(none)"}`,
        fix: "Emit a WebSite node on the home page with name, url (absolute) and alternateName.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [home.url],
        evidenceRefs: [
          blockRef(
            home,
            home.blocks.map((b) => b.raw).join("\n") || "no JSON-LD",
          ),
        ],
      });
    } else {
      out.pass("P6-01", "home WebSite node has name, url, alternateName", [
        blockRef(home, JSON.stringify(site.properties)),
      ]);
    }

    // P6-02
    const withBlocks = jsonld.pages.filter((p) => p.blocks.length > 0);
    if (withBlocks.length === 0) {
      out.na("P6-02", "no JSON-LD on crawled pages");
      return out.build();
    }
    const bad = withBlocks.flatMap((page) => {
      const hits: string[] = [];
      for (const block of page.blocks) {
        if (block.parseError) continue; // P6-08 (jsonld-integrity)
        walk(parse(block.raw), `block${block.index}`, origin, hits);
      }
      return hits.length > 0 ? [{ page, hits }] : [];
    });
    if (bad.length > 0) {
      out.finding({
        itemIds: ["P6-02"],
        severity: "S2",
        title: "JSON-LD has relative/insecure URLs or empty values",
        detail: bad
          .map(
            ({ page, hits }) => `${page.url} — ${hits.slice(0, 5).join("; ")}`,
          )
          .join("\n"),
        fix: "Emit absolute https:// URLs for url/@id/logo/image/sameAs/item and drop empty properties instead of printing blanks.",
        fixability: "FIXABLE",
        effort: "S",
        urls: bad.map(({ page }) => page.url),
        evidenceRefs: bad
          .slice(0, 20)
          .map(({ page, hits }) => blockRef(page, hits.join("\n"))),
      });
    }
    const inventory = withBlocks
      .map((p) => `${new URL(p.url).pathname}: ${typesOf(p).join(", ")}`)
      .join("\n");
    out.pass(
      "P6-02",
      `inventory: ${[...new Set(withBlocks.flatMap(typesOf))].join(", ")} on ${withBlocks.length} page(s)`,
      [out.evidence("jsonld", ctx.origin, inventory)],
    );
    return out.build();
  },
};
