import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { MAX_RESOURCES } from "@/server/features/handbook/collectors/resources";
import { effectiveStatus } from "@/server/features/handbook/collectors/probe";
import { createResult } from "./support";

/**
 * SUPP-20 (ADR-031): images, stylesheets and scripts on read pages answer.
 * Broken = no answer, 404, 410 or 5xx after the browser retest; a 403 is
 * never broken (bot-only or hotlink blocks). One finding per broken URL with
 * its page count.
 */
const ITEM = "SUPP-20";
const KIND = { img: "Image", css: "Stylesheet", js: "Script" } as const;

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
    for (const r of bad) {
      const status = effectiveStatus(r.probe);
      const answer = status === null ? "no answer" : `HTTP ${status}`;
      const pages = r.sourceUrls.length;
      out.finding({
        itemIds: [ITEM],
        severity: "S2",
        title: `${KIND[r.kind]} returns an error on ${pages} page${pages === 1 ? "" : "s"}`,
        detail: `${r.url} — ${answer}; used on ${pages} page(s), e.g. ${r.sourceUrls.slice(0, 5).join(", ")}\n${scope}`,
        fix: "Restore the file at this URL or update every page that uses it (usually one template, header or theme setting).",
        fixability: "FIXABLE",
        effort: "S",
        urls: r.sourceUrls,
        evidenceRefs: [
          out.evidence(
            "status",
            r.url,
            r.probe
              ? `${r.probe.method} ${r.probe.status} → ${r.probe.finalUrl}${r.probe.browserRetest ? `; browser retest ${r.probe.browserRetest.status}` : ""}`
              : "no answer (DNS, connect or timeout failure)",
          ),
        ],
      });
    }
    if (bad.length === 0)
      out.pass(ITEM, `${scope}; none broken`, [
        out.evidence("url", ctx.origin, scope),
      ]);
    return out.build();
  },
};
