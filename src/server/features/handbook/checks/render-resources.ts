import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import {
  robotsBlockedRequests,
  STATIC_RENDER_TYPES,
} from "@/server/features/handbook/engine/robots-blocked";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";
import { createResult, normalizeUrl } from "./support";

type RobotsEffect = NonNullable<
  RenderData["pages"][number]["js"]["robotsBlocked"]
>;

/**
 * ROBOTS render-resource guard (handbook §18, P3-20): no robots.txt Disallow
 * (Googlebot's group) on a script, stylesheet, XHR/fetch, image or font the
 * rendered page requests from a host whose robots.txt was fetched. Off-site
 * hosts are ignored (their robots.txt is not fetched).
 *
 * Severity by effect (WO-B19-004): the render collector re-renders each
 * template sample with the blocked requests aborted; each page takes its
 * own result, else its template sample's. Different text → S1 with the
 * missing lines as evidence; same text → S4 ("blocked resources do not
 * change the rendered content"); one finding per outcome. No
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
      // Effect per page: its own re-render, else its template sample's.
      const templateOf = new Map<string, string>();
      if (ctx.collected.templates.status === "ok")
        for (const t of ctx.collected.templates.templates)
          for (const u of t.urls) templateOf.set(normalizeUrl(u), t.key);
      const byTemplate = new Map<string, RobotsEffect>();
      for (const p of render.pages) {
        const key = templateOf.get(normalizeUrl(p.url));
        if (key && p.js.robotsBlocked) byTemplate.set(key, p.js.robotsBlocked);
      }
      const effectOf = (url: string) => {
        const own = render.pages.find((p) => p.url === url)?.js.robotsBlocked;
        const key = templateOf.get(normalizeUrl(url));
        return own ?? (key ? byTemplate.get(key) : undefined);
      };
      const groups = {
        changed: [] as string[],
        same: [] as string[],
        unknown: [] as string[],
      };
      for (const page of new Set(blocked.map((b) => b.page))) {
        const e = effectOf(page);
        groups[!e ? "unknown" : e.sameContent ? "same" : "changed"].push(page);
      }
      // An unmeasured page (a one-page template gets no re-render of its own)
      // whose every blocking rule was measured "unchanged" elsewhere and never
      // "changed" takes that result (valentinecoffeeco /cart, /account/login).
      const rulesOf = (pages: string[]) =>
        new Set(
          blocked.filter((b) => pages.includes(b.page)).map((b) => b.rule),
        );
      const sameRules = rulesOf(groups.same);
      const changedRules = rulesOf(groups.changed);
      const cleared = (rule: string) =>
        sameRules.has(rule) && !changedRules.has(rule);
      const inferred = groups.unknown.filter((page) =>
        blocked.filter((b) => b.page === page).every((b) => cleared(b.rule)),
      );
      groups.unknown = groups.unknown.filter((p) => !inferred.includes(p));
      groups.same.push(...inferred);
      const emit = (
        pages: string[],
        effect: { severity: "S1" | "S2" | "S4"; severityReason?: string },
        title: string,
        lines: string[],
      ) => {
        if (pages.length === 0) return;
        const mine = blocked.filter((b) => pages.includes(b.page));
        out.finding({
          itemIds: ["P3-20"],
          ...effect,
          title,
          detail: [
            ...lines,
            ...mine
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
              .map((p) => {
                const e = effectOf(p.url);
                return out.evidence(
                  "renderedDom",
                  p.url,
                  [
                    ...mine
                      .filter((b) => b.page === p.url)
                      .map((b) => `${b.type} ${b.url} — ${b.rule}`),
                    ...(e
                      ? [
                          `re-render without them: ${e.wordsNormal} → ${e.wordsBlocked} words, same content ${e.sameContent}`,
                          ...e.missing.map((m) => `missing: ${m}`),
                        ]
                      : []),
                  ].join("\n"),
                  p.js.renderedKey,
                );
              }),
          ],
        });
      };
      const effectLine = (url: string) => {
        const e = effectOf(url);
        if (inferred.includes(url))
          return `${url} — not re-rendered; its blocking rules left ${groups.same.length - inferred.length} measured page(s) unchanged`;
        const words = `${e?.wordsNormal} words rendered normally, ${e?.wordsBlocked} with the blocked requests aborted`;
        return e?.sameContent
          ? `${url} — same content without them (${words})`
          : `${url} — content changes without them (${words}); missing: ${(e?.missing ?? []).join(" | ") || "word count only"}`;
      };
      emit(
        groups.changed,
        { severity: "S1" },
        "robots.txt blocks resources needed to render the page",
        groups.changed.map(effectLine),
      );
      emit(
        groups.same,
        {
          severity: "S4",
          severityReason:
            "blocked resources do not change the rendered content",
        },
        "robots.txt blocks render requests (rendered content unchanged)",
        groups.same.map(effectLine),
      );
      // Not measured: by type, rules measured unchanged elsewhere left out.
      const unknownStatic = blocked.some(
        (b) =>
          groups.unknown.includes(b.page) &&
          STATIC_RENDER_TYPES.has(b.type) &&
          !cleared(b.rule),
      );
      emit(
        groups.unknown,
        unknownStatic
          ? { severity: "S1" }
          : {
              severity: "S2",
              severityReason:
                "only XHR/fetch calls are blocked; they may be telemetry rather than content",
            },
        "robots.txt blocks resources needed to render the page",
        unknownStatic
          ? []
          : [
              "Only XHR/fetch calls are blocked: confirm whether their responses feed visible content (GSC URL Inspection → page resources).",
            ],
      );
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
