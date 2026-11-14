import type { CollectedData } from "@/server/features/handbook/contracts/collectors";

/** Compact per-collector summary for collected.json (bodies stay in evidence/). */
export function summarizeCollected(c: CollectedData) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(c)) {
    if (value.status !== "ok") {
      out[key] = value;
      continue;
    }
    switch (key) {
      case "pages":
        out[key] =
          c.pages.status === "ok"
            ? c.pages.snapshots.map((s) => ({
                url: s.url,
                finalUrl: s.finalUrl,
                status: s.status,
                words: s.wordsRaw,
                title: s.head.title,
                canonical: s.head.canonical,
                robots: s.head.robotsMeta,
                h1: s.h1,
              }))
            : null;
        break;
      case "jsonld":
        out[key] =
          c.jsonld.status === "ok"
            ? c.jsonld.pages.map((p) => ({
                url: p.url,
                blocks: p.blocks.length,
                parseErrors: p.blocks.filter((b) => b.parseError).length,
                types: p.nodes.flatMap((n) => n.types),
              }))
            : null;
        break;
      case "templates":
        out[key] =
          c.templates.status === "ok"
            ? c.templates.templates.map((t) => ({
                key: t.key,
                pages: t.urls.length,
                samples: t.samples,
              }))
            : null;
        break;
      case "robots":
        out[key] =
          c.robots.status === "ok"
            ? {
                hosts: c.robots.hosts,
                decisions: c.robots.decisions.filter((d) => d.path === "/"),
              }
            : null;
        break;
      default:
        out[key] = value;
    }
  }
  return out;
}
