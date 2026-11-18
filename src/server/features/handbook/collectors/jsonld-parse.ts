import type { JsonLdNode } from "@/server/features/handbook/contracts/collectors";

/** JSON-LD block parsing for the crawl (raw text → parse error or nodes). */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function parseBlock(raw: string, index: number) {
  try {
    const value: unknown = JSON.parse(raw);
    return {
      block: { index, raw, parseError: null },
      nodes: flattenNodes(value),
    };
  } catch (error) {
    return {
      block: {
        index,
        raw,
        parseError: error instanceof Error ? error.message : "parse error",
      },
      nodes: [],
    };
  }
}

/** Top-level nodes and `@graph` members; nested objects stay as properties. */
function flattenNodes(value: unknown): JsonLdNode[] {
  if (Array.isArray(value)) return value.flatMap(flattenNodes);
  if (!isRecord(value)) return [];
  const record = value;
  const graph = record["@graph"];
  if (Array.isArray(graph)) return graph.flatMap(flattenNodes);
  const type = record["@type"];
  const types = Array.isArray(type)
    ? type.filter((t): t is string => typeof t === "string")
    : typeof type === "string"
      ? [type]
      : [];
  const id = typeof record["@id"] === "string" ? record["@id"] : null;
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k !== "@type" && k !== "@id" && k !== "@context") properties[k] = v;
  }
  return [{ id, types, properties }];
}
