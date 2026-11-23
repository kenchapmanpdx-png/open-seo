import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import {
  robotsBlockedRequests,
  STATIC_RENDER_TYPES,
} from "@/server/features/handbook/engine/robots-blocked";
import { createResult } from "./support";

/**
 * ROBOTS render-resource guard (handbook §18, P3-20): no robots.txt Disallow
 * (Googlebot's group) on a script, stylesheet, XHR/fetch, image or font the
 * rendered page requests from a host whose robots.txt was fetched. Off-site
 * hosts are ignored (their robots.txt is not fetched).
 *
 * Severity by effect (WO-B19-004): the render collector re-renders each
 * template sample with the blocked requests aborted. Different main text →
 * S1 with the missing lines as evidence; same text on every measured sample
 * → S4 ("blocked resources do not change the rendered content"). No
 * platform allow-list. Renders without that measurement (older runs) keep
 * the by-type rule: S1 for a script, stylesheet, image or font, S2 when
 * only XHR/fetch calls are blocked.
 */
const ITEMS = ["P3-20"];

export const renderResourcesCheck: HandbookCheck = {
  id: "robots.render-resources",
  itemIds: ITEMS,
  class: "ROBOTS",
  requires: ["render", "robots"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { render, robots } = ctx.collected;
    if (render.status !== "ok" || robots.status !== "ok") return out.build();
    const hosts = new Map(
      robots.hosts.filter((h) => h.status === 200).map((h) => [h.host, h]),
    );
    if (hosts.size === 0) {
      out.na("P3-20", "no robots.txt (HTTP 200) on any host");
      return out.build();
    }

    let checked = 0;
    const blocked: { page: string; url: string; type: string; rule: string }[] =
      [];
    for (const page of render.pages) {
      const found = robotsBlockedRequests(page.js.requests, robots);
      checked += found.checked;
      for (const b of found.blocked) blocked.push({ page: page.url, ...b });
    }

    const robotsRef = () => {
      const [host] = hosts.values();
      return out.evidence(
        "robotsTxt",
        `${new URL(ctx.origin).protocol}//${host.host}/robots.txt`,
        host.groups
          .map(
            (g) =>
              `User-agent: ${g.userAgents.join(", ")}\n${g.rules.map((r) => `${r.type}: ${r.path}`).join("\n")}`,
          )
          .join("\n\n"),
        host.storageKey,
      );
    };

    if (blocked.length > 0) {
      const pages = [...new Set(blocked.map((b) => b.page))];
      const measured = render.pages.filter((p) => p.js.robotsBlocked);
      const changed = measured.filter((p) => !p.js.robotsBlocked?.sameContent);
      const staticBlocked = blocked.some((b) =>
        STATIC_RENDER_TYPES.has(b.type),
      );
      const effect =
        measured.length === 0
          ? staticBlocked
            ? ({ severity: "S1" } as const)
            : ({
                severity: "S2",
                severityReason:
                  "only XHR/fetch calls are blocked; they may be telemetry rather than content",
              } as const)
          : changed.length > 0
            ? ({ severity: "S1" } as const)
            : ({
                severity: "S4",
                severityReason:
                  "blocked resources do not change the rendered content",
              } as const);
      const effectLines =
        measured.length === 0
          ? staticBlocked
            ? []
            : [
                "Only XHR/fetch calls are blocked: confirm whether their responses feed visible content (GSC URL Inspection → page resources).",
              ]
          : measured.map((p) => {
              const r = p.js.robotsBlocked;
              const words = `${r?.wordsNormal} words rendered normally, ${r?.wordsBlocked} with the blocked requests aborted`;
              return r?.sameContent
                ? `${p.url} — same content without them (${words})`
                : `${p.url} — content changes without them (${words}); missing: ${(r?.missing ?? []).join(" | ") || "layout / word count only"}`;
            });
      out.finding({
        itemIds: ["P3-20"],
        ...effect,
        title:
          effect.severity === "S4"
            ? "robots.txt blocks render requests (rendered content unchanged)"
            : "robots.txt blocks resources needed to render the page",
        detail: [
          ...effectLines,
          ...blocked
            .slice(0, 20)
            .map((b) => `${b.page} loads ${b.type} ${b.url} — ${b.rule}`),
        ].join("\n"),
        fix: "Remove the Disallow rules that match scripts, styles, images, fonts or API calls used while rendering (or add a longer Allow rule for them).",
        fixability: "FIXABLE",
        effort: "S",
        urls: pages,
        evidenceRefs: [
          robotsRef(),
          ...render.pages
            .filter((p) => pages.includes(p.url))
            .slice(0, 5)
            .map((p) =>
              out.evidence(
                "renderedDom",
                p.url,
                [
                  ...blocked
                    .filter((b) => b.page === p.url)
                    .map((b) => `${b.type} ${b.url} — ${b.rule}`),
                  ...(p.js.robotsBlocked
                    ? [
                        `aborted re-render: ${p.js.robotsBlocked.wordsNormal} → ${p.js.robotsBlocked.wordsBlocked} words, same content ${p.js.robotsBlocked.sameContent}`,
                        ...p.js.robotsBlocked.missing.map(
                          (m) => `missing: ${m}`,
                        ),
                      ]
                    : []),
                ].join("\n"),
                p.js.renderedKey,
              ),
            ),
        ],
      });
    } else if (checked === 0) {
      out.na("P3-20", "rendered pages requested no same-host resources");
    } else {
      out.pass(
        "P3-20",
        `${checked} same-host render requests on ${render.pages.length} pages allowed for Googlebot`,
        [robotsRef()],
      );
    }
    return out.build();
  },
};
