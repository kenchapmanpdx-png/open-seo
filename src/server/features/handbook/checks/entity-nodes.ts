import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { JsonLdNode } from "@/server/features/handbook/contracts/collectors";
import { createResult } from "./support";

/**
 * Entity rule (B17 §9 #7, T10; handbook §24, P6-03 deterministic part): one
 * page's JSON-LD defines the business more than once — > 1 business node,
 * > 1 `WebSite` node, or business / WebSite nodes with differing `name`
 * values. Distinct organizations referenced from another node (brand,
 * parent, department, member) keep their own node and are not counted.
 * Pages with the same node set are one row. Microdata is not collected.
 */
const ITEM = "P6-03";
const BUSINESS =
  /^(Organization|Corporation|NGO|LocalBusiness|.*(Organization|Business|Store|Salon|Shop|Spa))$/;
const DISTINCT_REFS = [
  "brand",
  "parentOrganization",
  "subOrganization",
  "department",
  "memberOf",
  "member",
  "sponsor",
  "funder",
];

const nameOf = (n: JsonLdNode) =>
  typeof n.properties.name === "string" ? n.properties.name.trim() : null;
const label = (n: JsonLdNode) =>
  `${n.types.join("/")} "${nameOf(n) ?? "?"}"${n.id ? ` (${n.id})` : " (no @id)"}`;

function referencedIds(nodes: readonly JsonLdNode[]): Set<string> {
  const ids = new Set<string>();
  const collect = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object" && "@id" in value) {
      const id = (value as { "@id": unknown })["@id"];
      if (typeof id === "string") ids.add(id);
    }
  };
  for (const n of nodes)
    for (const key of DISTINCT_REFS) collect(n.properties[key]);
  return ids;
}

/** Problem text for one page's nodes, or null when the page is clean. */
function conflict(nodes: readonly JsonLdNode[]): string | null {
  const distinct = referencedIds(nodes);
  const business = nodes.filter(
    (n) =>
      n.types.some((t) => BUSINESS.test(t)) && !(n.id && distinct.has(n.id)),
  );
  const sites = nodes.filter((n) => n.types.includes("WebSite"));
  const uniqueBy = (list: JsonLdNode[]) =>
    new Set(list.map((n) => n.id ?? label(n))).size;
  const names = (list: JsonLdNode[]) =>
    new Set(list.flatMap((n) => nameOf(n)?.toLowerCase() ?? []));
  const problems = [
    uniqueBy(business) > 1 ? `${uniqueBy(business)} business nodes` : null,
    uniqueBy(sites) > 1 ? `${uniqueBy(sites)} WebSite nodes` : null,
    names(business).size > 1 ? "business names differ" : null,
    names(sites).size > 1 ? "WebSite names differ" : null,
  ].filter(Boolean);
  if (problems.length === 0) return null;
  return `${problems.join(", ")}: ${[...business, ...sites].map(label).join("; ")}`;
}

export const entityNodesCheck: HandbookCheck = {
  id: "schema.entity-nodes",
  itemIds: [ITEM],
  class: "SCHEMA",
  requires: ["jsonld"],
  run(ctx) {
    const out = createResult([ITEM]);
    const { jsonld } = ctx.collected;
    if (jsonld.status !== "ok") return out.build();
    const rows = new Map<string, string[]>();
    for (const page of jsonld.pages) {
      const text = conflict(page.nodes);
      if (text) rows.set(text, [...(rows.get(text) ?? []), page.url]);
    }
    if (rows.size === 0) return out.build();
    const urls = [...rows.values()].flat();
    out.finding({
      itemIds: [ITEM],
      severity: "S2",
      title: `The business is defined more than once in JSON-LD (${urls.length} page${urls.length === 1 ? "" : "s"})`,
      detail: [...rows]
        .map(
          ([text, pages]) =>
            `${pages.length} page(s), e.g. ${pages.slice(0, 3).join(", ")} — ${text}`,
        )
        .join("\n"),
      fix: "Keep one business node and one WebSite node per page (usually one SEO plugin's graph); remove the theme's or a second plugin's duplicate, and use the same name in both.",
      fixability: "FIXABLE",
      effort: "S",
      urls,
      evidenceRefs: [...rows].map(([text, pages]) =>
        out.evidence("jsonld", pages[0], text),
      ),
    });
    return out.build();
  },
};
