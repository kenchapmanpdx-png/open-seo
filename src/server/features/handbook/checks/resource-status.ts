import { sort } from "remeda";
import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { MAX_RESOURCES } from "@/server/features/handbook/collectors/resources";
import { effectiveStatus } from "@/server/features/handbook/collectors/probe";
import { createResult } from "./support";

/**
 * SUPP-20 (ADR-031): images, stylesheets and scripts on read pages answer.
 * Broken = no answer, 404, 410 or 5xx after the browser retest; a 403 is
 * never broken (bot-only or hotlink blocks). One finding per resource kind
 * (WO-B19-007, grouping rule #5) listing each broken URL with its page
 * count, largest first; evidence per URL.
 */
const ITEM = "SUPP-20";
const KIND = {
  img: ["Image", "images"],
  css: ["Stylesheet", "stylesheets"],
  js: ["Script", "scripts"],
} as const;

const broken = (status: number | null) =>
  status === null || status === 404 || status === 410 || status >= 500;

export const resourceStatusCheck: HandbookCheck = {
  id: "crawl.resource-status",
  itemIds: [ITEM],
  class: "CRAWL",
  requires: ["resources"],
  run(ctx) {
    const out = createResult([ITEM]);
    const { resources } = ctx.collected;
    if (resources.status !== "ok") return out.build();
    if (resources.resources.length === 0) {
      out.na(ITEM, "no images, stylesheets or scripts on read pages");
      return out.build();
    }
    const scope = `${resources.resources.length} resource URL(s) checked (found ${resources.found}, cap ${MAX_RESOURCES})`;
    const bad = resources.resources.filter((r) =>
      broken(effectiveStatus(r.probe)),
    );
    const answerOf = (r: (typeof bad)[number]) => {
      const status = effectiveStatus(r.probe);
      return status === null ? "no answer" : `HTTP ${status}`;
    };
    for (const kind of ["img", "css", "js"] as const) {
      const group = sort(
        bad.filter((r) => r.kind === kind),
        (x, y) => y.sourceUrls.length - x.sourceUrls.length,
      );
      if (group.length === 0) continue;
      const pages = [...new Set(group.flatMap((r) => r.sourceUrls))];
      const plural = pages.length === 1 ? "" : "s";
      out.finding({
        itemIds: [ITEM],
        severity: "S2",
        title:
          group.length === 1
            ? `${KIND[kind][0]} returns an error on ${pages.length} page${plural}`
            : `${group.length} ${KIND[kind][1]} return an error on ${pages.length} page${plural}`,
        detail: [
          ...group.map(
            (r) =>
              `${r.url} — ${answerOf(r)}; used on ${r.sourceUrls.length} page(s), e.g. ${r.sourceUrls.slice(0, 5).join(", ")}`,
          ),
          scope,
        ].join("\n"),
        fix: "Restore each file at its URL or update every page that uses it (usually one template, header or theme setting).",
        fixability: "FIXABLE",
        effort: "S",
        urls: pages,
        evidenceRefs: group.map((r) =>
          out.evidence(
            "status",
            r.url,
            r.probe
              ? `${r.probe.method} ${r.probe.status} → ${r.probe.finalUrl}${r.probe.browserRetest ? `; browser retest ${r.probe.browserRetest.status}` : ""}`
              : "no answer (DNS, connect or timeout failure)",
          ),
        ),
      });
    }
    if (bad.length === 0)
      out.pass(ITEM, `${scope}; none broken`, [
        out.evidence("url", ctx.origin, scope),
      ]);
    return out.build();
  },
};
