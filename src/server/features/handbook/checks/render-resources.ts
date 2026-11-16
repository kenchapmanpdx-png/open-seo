import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { decide } from "@/server/features/handbook/engine/robots";
import { createResult } from "./support";

/**
 * ROBOTS render-resource guard (handbook §18, P3-20): no robots.txt Disallow
 * (Googlebot's group) on a script, stylesheet, XHR/fetch, image or font the
 * rendered page requests from a host whose robots.txt was fetched. Off-site
 * hosts are ignored (their robots.txt is not fetched).
 *
 * S1 when a blocked request is a script, stylesheet, image or font (render
 * input by type). XHR/fetch only → S2: the run cannot tell content data from
 * telemetry (e.g. Squarespace `/api/census/*` beacons under its fixed
 * `Disallow: /api/`), so it does not cap the grade on that alone.
 */
const ITEMS = ["P3-20"];
const STATIC_TYPES = new Set(["script", "stylesheet", "image", "font"]);
const RENDER_TYPES = new Set([...STATIC_TYPES, "xhr", "fetch"]);

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
      for (const req of page.js.requests) {
        if (!RENDER_TYPES.has(req.resourceType)) continue;
        let u: URL;
        try {
          u = new URL(req.url);
        } catch {
          continue;
        }
        const host = hosts.get(u.host);
        if (!host) continue;
        checked += 1;
        const d = decide(
          host.host,
          host.groups,
          "Googlebot",
          u.pathname + u.search,
        );
        if (!d.allowed)
          blocked.push({
            page: page.url,
            url: req.url,
            type: req.resourceType,
            rule: d.matchedRule ?? "disallow",
          });
      }
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
      const staticBlocked = blocked.some((b) => STATIC_TYPES.has(b.type));
      out.finding({
        itemIds: ["P3-20"],
        severity: staticBlocked ? "S1" : "S2",
        ...(staticBlocked
          ? {}
          : {
              severityReason:
                "only XHR/fetch calls are blocked; they may be telemetry rather than content",
            }),
        title: "robots.txt blocks resources needed to render the page",
        detail: blocked
          .slice(0, 20)
          .map((b) => `${b.page} loads ${b.type} ${b.url} — ${b.rule}`)
          .concat(
            staticBlocked
              ? []
              : [
                  "Only XHR/fetch calls are blocked: confirm whether their responses feed visible content (GSC URL Inspection → page resources).",
                ],
          )
          .join("\n"),
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
                blocked
                  .filter((b) => b.page === p.url)
                  .map((b) => `${b.type} ${b.url} — ${b.rule}`)
                  .join("\n"),
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
