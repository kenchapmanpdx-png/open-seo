import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  JsonLdData,
  JsonLdNode,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * SCHEMA (handbook §24): index pages of detail templates carry an ItemList
 * covering their detail links, detail pages a BreadcrumbList whose items are
 * live crawled pages (P6-06); Article nodes carry datePublished/dateModified,
 * offsets on any time, isPartOf → the WebSite @id and named author/publisher
 * (P6-04, deterministic part; "never an invented time" is owner/LLM work).
 */
const ITEMS = ["P6-06", "P6-04"];

const TIME_OFFSET = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

type Page = JsonLdData["pages"][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];
const idOf = (value: unknown) =>
  isRecord(value) ? str(value["@id"]) : str(value);

const isArticle = (n: JsonLdNode) =>
  n.types.some((t) => t.endsWith("Article") || t === "BlogPosting");

const live = (s: PageSnapshot) =>
  s.status === 200 && normalizeUrl(s.finalUrl) === normalizeUrl(s.url);

const blockText = (page: Page | undefined) =>
  page?.blocks.map((b) => b.raw).join("\n") || "no JSON-LD";

export const schemaListsArticlesCheck: HandbookCheck = {
  id: "schema.lists-articles",
  itemIds: ITEMS,
  class: "SCHEMA",
  requires: ["jsonld", "pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { jsonld, pages, templates } = ctx.collected;
    if (jsonld.status !== "ok") return out.build();
    const jsonOf = new Map(jsonld.pages.map((p) => [normalizeUrl(p.url), p]));
    const nodesAt = (url: string) => jsonOf.get(normalizeUrl(url))?.nodes ?? [];
    const pagesLive = pages.status === "ok" ? pages.snapshots.filter(live) : [];
    const liveUrls = new Set(pagesLive.map((s) => normalizeUrl(s.url)));
    const ref = (url: string) =>
      out.evidence("jsonld", url, blockText(jsonOf.get(normalizeUrl(url))));

    // P6-06
    const detailTemplates =
      templates.status === "ok"
        ? templates.templates.filter(
            (t) =>
              t.urls.length >= 3 &&
              t.urlPattern !== "/*" && // root siblings are not a detail set
              t.urlPattern.endsWith("/*"),
          )
        : [];
    const problems: { url: string; why: string }[] = [];
    let checked = 0;
    for (const t of detailTemplates) {
      const prefix = t.urlPattern.slice(0, -1);
      const detail = new Set(t.urls.map(normalizeUrl));
      const index = pagesLive.find((s) =>
        [prefix, `${prefix}index.html`, prefix.slice(0, -1)].includes(
          new URL(s.url).pathname,
        ),
      );
      if (index) {
        checked += 1;
        const linked = new Set(
          index.links
            .map((l) => normalizeUrl(l.href))
            .filter((h) => detail.has(h)),
        ).size;
        const itemList = nodesAt(index.url).find((n) =>
          n.types.includes("ItemList"),
        );
        const count = itemList
          ? Math.max(
              list(itemList.properties.itemListElement).length,
              Number(itemList.properties.numberOfItems) || 0,
            )
          : 0;
        if (!itemList)
          problems.push({ url: index.url, why: "index page has no ItemList" });
        else if (count < linked - 1)
          problems.push({
            url: index.url,
            why: `ItemList has ${count} item(s) for ${linked} detail link(s)`,
          });
      }
      for (const url of t.urls) {
        checked += 1;
        const crumbs = nodesAt(url).find((n) =>
          n.types.includes("BreadcrumbList"),
        );
        const items = list(crumbs?.properties.itemListElement);
        if (!crumbs || items.length < 2) {
          problems.push({
            url,
            why: crumbs
              ? `BreadcrumbList has ${items.length} item(s)`
              : "detail page has no BreadcrumbList",
          });
          continue;
        }
        const dead = items
          .map((i) => (isRecord(i) ? idOf(i.item) : null))
          .filter((u): u is string => !!u)
          .filter((u) => {
            try {
              return !liveUrls.has(normalizeUrl(new URL(u, url).href));
            } catch {
              return true;
            }
          });
        if (dead.length > 0)
          problems.push({
            url,
            why: `breadcrumb item(s) not live crawled pages: ${dead.join(", ")}`,
          });
      }
    }
    if (checked === 0) {
      out.na("P6-06", "no detail template (≥3 URLs) with index/detail pages");
    } else if (problems.length > 0) {
      out.finding({
        itemIds: ["P6-06"],
        severity: "S2",
        title: "Index/detail templates lack ItemList / BreadcrumbList",
        detail: problems.map((p) => `${p.url} — ${p.why}`).join("\n"),
        fix: "Emit an ItemList of the listed items on each index page and a BreadcrumbList (home → index → page) with live URLs on each detail page.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(problems.map((p) => p.url))],
        evidenceRefs: problems.slice(0, 10).map((p) => ref(p.url)),
      });
    } else {
      out.pass(
        "P6-06",
        `${checked} index/detail page(s) carry ItemList / BreadcrumbList`,
        [ref(detailTemplates[0].urls[0])],
      );
    }

    // P6-04
    const all = jsonld.pages.flatMap((page) =>
      page.nodes.map((node) => ({ page, node })),
    );
    const named = new Set(
      all
        .filter(({ node }) => node.id && str(node.properties.name))
        .map(({ node }) => node.id),
    );
    const siteIds = new Set(
      all
        .filter(({ node }) => node.types.includes("WebSite") && node.id)
        .map(({ node }) => node.id),
    );
    const articles = all.filter(({ node }) => isArticle(node));
    if (articles.length === 0) {
      out.na("P6-04", "no Article JSON-LD on crawled pages");
      return out.build();
    }
    const bad = articles.flatMap(({ page, node }) => {
      const p = node.properties;
      const why: string[] = [];
      for (const k of ["datePublished", "dateModified"]) {
        const v = str(p[k]);
        if (!v) why.push(`${k} missing`);
        else if (v.includes("T") && !TIME_OFFSET.test(v))
          why.push(`${k} "${v}" has a time without offset`);
      }
      const partOf = list(p.isPartOf).map(idOf);
      if (partOf.length === 0) why.push("isPartOf missing");
      else if (siteIds.size > 0 && !partOf.some((id) => id && siteIds.has(id)))
        why.push("isPartOf does not reference the WebSite @id");
      for (const k of ["author", "publisher"])
        for (const v of list(p[k])) {
          const ok = isRecord(v)
            ? !!str(v.name) || named.has(str(v["@id"]))
            : !!str(v);
          if (!ok) why.push(`${k} item has no name`);
        }
      return why.length > 0 ? [{ page, why }] : [];
    });
    if (bad.length > 0) {
      out.finding({
        itemIds: ["P6-04"],
        severity: "S2",
        title: "Article JSON-LD has date/isPartOf/name gaps",
        detail: bad
          .map(({ page, why }) => `${page.url} — ${why.join("; ")}`)
          .join("\n"),
        fix: "Give each Article datePublished/dateModified (with UTC offset when a time is known), isPartOf → the WebSite @id, and named author/publisher items.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(bad.map(({ page }) => page.url))],
        evidenceRefs: bad.slice(0, 10).map(({ page }) => ref(page.url)),
      });
    } else {
      out.pass(
        "P6-04",
        `${articles.length} Article node(s): dates, offsets, isPartOf, named items (invented-time judgment pending)`,
        [ref(articles[0].page.url)],
      );
    }
    return out.build();
  },
};
