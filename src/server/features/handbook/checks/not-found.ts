import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { VariantsData } from "@/server/features/handbook/contracts/collectors";
import { createResult, pathOf } from "./support";

/**
 * CRAWL (handbook §10 Soft 404s): an unknown URL returns a real 404/410, not
 * a 200 or a redirect to the homepage (P3-10), and the 404 body is its own
 * template rather than a live page served with a 404 status (P3-11).
 */
const ITEMS = ["P3-10", "P3-11"];

type Probe = VariantsData["probes"][number];

type LiveHit = {
  p: Probe;
  why: string;
  /** Live page (canonical) the 404 body duplicates, when known. */
  twin: string | null;
};

const describe = (p: Probe) =>
  [
    ...p.redirectChain.map((hop) => `${hop.status} ${hop.url}`),
    `${p.status} ${p.finalUrl} · title ${JSON.stringify(p.title)} · ${p.words} words`,
  ].join("\n→ ");

export const notFoundCheck: HandbookCheck = {
  id: "crawl.not-found",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["variants", "pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { variants, pages } = ctx.collected;
    if (variants.status !== "ok" || pages.status !== "ok") return out.build();
    const probes = variants.probes.filter((p) => p.kind === "unknown-path");
    if (probes.length === 0) {
      for (const id of ITEMS) out.na(id, "unknown-path probe not fetched");
      return out.build();
    }
    const ref = (p: Probe) => out.evidence("status", p.url, describe(p));

    const soft = probes.filter((p) => p.status !== 404 && p.status !== 410);
    if (soft.length > 0) {
      out.finding({
        itemIds: ["P3-10"],
        severity: "S1",
        title: "Unknown URLs do not return 404 (soft 404)",
        detail: soft
          .map((p) =>
            p.redirectChain.length > 0
              ? `${p.url} — redirects to ${p.finalUrl} (${p.status})`
              : `${p.url} — answers ${p.status}`,
          )
          .join("\n"),
        fix: "Return HTTP 404 (or 410) for unknown paths, including the SPA catch-all route; do not redirect them to the homepage.",
        fixability: "FIXABLE",
        effort: "S",
        urls: soft.map((p) => p.url),
        evidenceRefs: soft.map(ref),
      });
    } else {
      out.pass(
        "P3-10",
        `${probes.length} unknown path(s) → ${probes.map((p) => p.status).join(", ")}`,
        probes.map(ref),
      );
    }

    const real = probes.filter((p) => p.status === 404 || p.status === 410);
    if (real.length === 0) {
      out.na("P3-11", "no unknown path returned 404");
      return out.build();
    }
    const home = pages.snapshots.find(
      (s) => pathOf(s.url) === "/" && s.status === 200,
    );
    const liveByTitle = new Map(
      pages.snapshots
        .filter((s) => s.status === 200 && s.head.title)
        .map((s) => [s.head.title?.trim(), s]),
    );
    const livePage = real.flatMap((p): LiveHit[] => {
      // The probe has no canonical field (contracts 1.2.0): cite the live
      // page with the same title and its canonical instead (ryan F16).
      const twin = p.title ? liveByTitle.get(p.title.trim()) : undefined;
      if (twin) {
        const canonical = twin.head.canonical ?? twin.url;
        return [
          {
            p,
            why: `title "${p.title}" matches the live page ${twin.url} (canonical ${canonical})`,
            twin: canonical,
          },
        ];
      }
      if (
        home &&
        home.wordsRaw > 0 &&
        Math.abs(p.words - home.wordsRaw) <= home.wordsRaw * 0.1
      )
        return [
          {
            p,
            why: `${p.words} words vs home ${home.wordsRaw} (±10%: live page body)`,
            twin: null,
          },
        ];
      return [];
    });
    if (livePage.length > 0) {
      out.finding({
        itemIds: ["P3-11"],
        severity: "S3",
        title: "404 response serves a live page body",
        detail: livePage.map(({ p, why }) => `${p.url} — ${why}`).join("\n"),
        fix: "Serve a dedicated 404 template (own title, short body with links to key hubs) with the 404 status.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [
          ...new Set(
            livePage.flatMap((x) => (x.twin ? [x.p.url, x.twin] : [x.p.url])),
          ),
        ],
        evidenceRefs: livePage.map(({ p }) => ref(p)),
      });
    } else {
      out.pass(
        "P3-11",
        `404 body has its own title (${real.map((p) => JSON.stringify(p.title)).join(", ")})`,
        real.map(ref),
      );
    }
    return out.build();
  },
};
