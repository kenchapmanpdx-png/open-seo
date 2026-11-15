import { describe, expect, it } from "vitest";
import type {
  CollectedData,
  JsonLdNode,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { schemaListsArticlesCheck } from "./schema-lists-articles";

const details = ["/events/a/", "/events/b/", "/events/c/"];
const crumbs = (last: string): JsonLdNode => ({
  id: null,
  types: ["BreadcrumbList"],
  properties: {
    itemListElement: [
      { item: `${ORIGIN}/events/` },
      { item: `${ORIGIN}${last}` },
    ],
  },
});

function run(
  nodes: Record<string, JsonLdNode[]>,
  snapshots: PageSnapshot[] = [
    snapshot("/events/", { links: details }),
    ...details.map((d) => snapshot(d)),
  ],
) {
  const collected: Partial<CollectedData> = {
    pages: { status: "ok", snapshots },
    templates: {
      status: "ok",
      templates: [
        {
          key: "/events/*:x",
          urlPattern: "/events/*",
          skeletonHash: "x",
          urls: details.map((d) => `${ORIGIN}${d}`),
          samples: [],
        },
      ],
    },
    jsonld: {
      status: "ok",
      pages: Object.entries(nodes).map(([path, n]) => ({
        url: `${ORIGIN}${path}`,
        blocks: [],
        nodes: n,
      })),
    },
  };
  return schemaListsArticlesCheck.run(context(collected));
}

const itemList: JsonLdNode = {
  id: null,
  types: ["ItemList"],
  properties: { itemListElement: details },
};
const withCrumbs = Object.fromEntries(details.map((d) => [d, [crumbs(d)]]));

describe("schema.lists-articles", () => {
  it("passes P6-06 with ItemList on the index and breadcrumbs on details", async () => {
    const result = await run({ "/events/": [itemList], ...withCrumbs });
    expect(statusOf(result, "P6-06")).toBe("PASS");
  });

  it("opens P6-06 when the index has no ItemList", async () => {
    expect(statusOf(await run(withCrumbs), "P6-06")).toBe("OPEN");
  });

  it("opens P6-06 when a breadcrumb item is a 404", async () => {
    const snapshots = [
      snapshot("/events/", { links: details, status: 404 }),
      ...details.map((d) => snapshot(d)),
    ];
    const result = await run({ ...withCrumbs }, snapshots);
    expect(statusOf(result, "P6-06")).toBe("OPEN");
  });

  it("opens P6-04 on an Article time without offset", async () => {
    const article = (date: string): JsonLdNode => ({
      id: null,
      types: ["Article"],
      properties: {
        datePublished: date,
        dateModified: "2026-01-02",
        isPartOf: { "@id": `${ORIGIN}/#site` },
        author: { name: "Jane" },
      },
    });
    const ok = await run({ "/post/": [article("2026-01-01T09:00:00-07:00")] });
    expect(statusOf(ok, "P6-04")).toBe("PASS");
    const bad = await run({ "/post/": [article("2026-01-01T09:00:00")] });
    expect(statusOf(bad, "P6-04")).toBe("OPEN");
  });
});
