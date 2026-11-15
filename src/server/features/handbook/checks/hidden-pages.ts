import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { decide } from "@/server/features/handbook/engine/robots";
import { createResult, normalizeUrl } from "./support";

/**
 * ROBOTS/HEADERS (handbook §10, §12, §18): hidden pages use noindex OR
 * Disallow (never both, a Disallow hides the noindex) and stay out of the
 * sitemap; private/staff URLs are not linked publicly; utility pages stay
 * linked (P3-14). Admin/staff paths need auth + `X-Robots-Tag: noindex`, no
 * Disallow conflict and no public links (P3-16). The crawler skips
 * Disallowed paths, so a Disallowed URL is judged from robots + links alone.
 */
const ITEMS = ["P3-14", "P3-16"];

const ADMIN = /(^|\/)(admin|staff|dashboard|wp-admin|portal)(\/|$)/i;
const UTILITY =
  /(^|\/)(cart|checkout|account|login|search|privacy|terms|legal)(\/|\.html?$|$)/i;

const noindex = (s: PageSnapshot) =>
  /noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`);
const pathOf = (url: string) => new URL(url).pathname;

export const hiddenPagesCheck: HandbookCheck = {
  id: "robots.hidden-pages",
  itemIds: ITEMS,
  class: "ROBOTS",
  requires: ["pages", "robots"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, robots, sitemap } = ctx.collected;
    if (pages.status !== "ok" || robots.status !== "ok") return out.build();
    const robotsUrl = new URL("/robots.txt", ctx.origin).href;
    const disallowRule = (url: string) => {
      const u = new URL(url);
      const host = robots.hosts.find((h) => h.host === u.host);
      if (!host) return null;
      const d = decide(u.host, host.groups, "*", u.pathname);
      return d.allowed ? null : d.matchedRule;
    };
    const robotsRef = (url: string, rule: string) =>
      out.evidence(
        "robotsTxt",
        robotsUrl,
        `User-agent: * → ${rule} matches ${pathOf(url)}`,
        robots.hosts.find((h) => h.host === new URL(url).host)?.storageKey,
      );
    const byUrl = new Map(pages.snapshots.map((s) => [normalizeUrl(s.url), s]));
    const publicPages = pages.snapshots.filter(
      (s) => s.status === 200 && !noindex(s) && !ADMIN.test(pathOf(s.url)),
    );
    const site = new URL(ctx.origin).hostname.replace(/^www\./, "");
    const linkedFrom = new Map<string, string[]>();
    for (const s of publicPages) {
      for (const link of s.links) {
        const target = normalizeUrl(link.href);
        if (new URL(target).hostname.replace(/^www\./, "") !== site) continue;
        if (target === normalizeUrl(s.url)) continue;
        const list = linkedFrom.get(target) ?? [];
        if (!list.includes(s.url)) list.push(s.url);
        linkedFrom.set(target, list);
      }
    }
    const linkRefs = (target: string) =>
      (linkedFrom.get(target) ?? [])
        .slice(0, 5)
        .map((src) =>
          out.evidence(
            "rawHtml",
            src,
            `<a href="${target}">`,
            byUrl.get(normalizeUrl(src))?.rawKey,
          ),
        );

    // P3-14 (a) noindex + Disallow on the same URL.
    const both = pages.snapshots.flatMap((s) => {
      const rule = noindex(s) ? disallowRule(s.url) : null;
      return rule ? [{ s, rule }] : [];
    });
    if (both.length > 0) {
      out.finding({
        itemIds: ["P3-14"],
        severity: "S3",
        title: "Pages are both noindex and Disallowed",
        detail: both
          .map(({ s, rule }) => `${s.url} — noindex + ${rule}`)
          .join("\n"),
        fix: "Pick one: keep noindex and drop the Disallow (so crawlers can see the noindex), or Disallow only resources that never need deindexing.",
        fixability: "FIXABLE",
        effort: "S",
        urls: both.map(({ s }) => s.url),
        evidenceRefs: both.map(({ s, rule }) => robotsRef(s.url, rule)),
      });
    }

    // (b) hidden URLs listed in the sitemap.
    const listedHidden =
      sitemap.status === "ok"
        ? sitemap.urls.flatMap((u) => {
            const rule = disallowRule(u.loc);
            const snap = byUrl.get(normalizeUrl(u.loc));
            if (rule) return [{ url: u.loc, why: rule }];
            if (snap && noindex(snap)) return [{ url: u.loc, why: "noindex" }];
            return [];
          })
        : [];
    if (listedHidden.length > 0 && sitemap.status === "ok") {
      out.finding({
        itemIds: ["P3-14"],
        severity: "S3",
        title: "Hidden (noindex/Disallowed) URLs listed in the sitemap",
        detail: listedHidden.map((h) => `${h.url} — ${h.why}`).join("\n"),
        fix: "Drop hidden pages from the sitemap.",
        fixability: "FIXABLE",
        effort: "S",
        urls: listedHidden.map((h) => h.url),
        evidenceRefs: [
          out.evidence(
            "sitemap",
            sitemap.sources[0]?.url ?? ctx.origin,
            listedHidden.map((h) => `${h.url} — ${h.why}`).join("\n"),
            sitemap.sources[0]?.storageKey,
          ),
        ],
      });
    }

    // (c) private/staff URLs linked from public pages (also P3-16).
    const adminUrls = new Set(
      [...linkedFrom.keys(), ...pages.snapshots.map((s) => normalizeUrl(s.url))]
        .filter((url) => ADMIN.test(pathOf(url)))
        .map(normalizeUrl),
    );
    const linkedAdmin = [...adminUrls].filter((url) => linkedFrom.has(url));
    if (linkedAdmin.length > 0) {
      out.finding({
        itemIds: ["P3-14"],
        severity: "S3",
        title: "Private/staff URLs are linked from public pages",
        detail: linkedAdmin
          .map(
            (url) => `${url} — linked from ${linkedFrom.get(url)?.join(", ")}`,
          )
          .join("\n"),
        fix: "Remove public links to staff/admin areas; reach them by bookmark or a login page.",
        fixability: "FIXABLE",
        effort: "S",
        urls: linkedAdmin,
        evidenceRefs: linkedAdmin.flatMap(linkRefs),
      });
    }

    // (d) utility pages must stay linked.
    const orphanUtility = pages.snapshots.filter(
      (s) =>
        s.status === 200 &&
        UTILITY.test(pathOf(s.url)) &&
        !linkedFrom.has(normalizeUrl(s.url)),
    );
    if (orphanUtility.length > 0) {
      out.finding({
        itemIds: ["P3-14"],
        severity: "S4",
        severityReason:
          "utility pages only (cart/account/legal), no ranking content",
        title: "Utility pages are not linked",
        detail: orphanUtility.map((s) => s.url).join("\n"),
        fix: "Keep cart, account, search and legal pages linked (header/footer) even when they are noindex.",
        fixability: "FIXABLE",
        effort: "S",
        urls: orphanUtility.map((s) => s.url),
        evidenceRefs: orphanUtility.map((s) =>
          out.evidence("linkGraph", s.url, `${s.url} — 0 internal inlinks`),
        ),
      });
    }

    const hiddenCount =
      pages.snapshots.filter(noindex).length +
      [...linkedFrom.keys()].filter((u) => disallowRule(u)).length;
    out.pass(
      "P3-14",
      `${hiddenCount} hidden URL(s); none noindex+Disallow, in the sitemap or linked as private`,
      [
        out.evidence(
          "robotsTxt",
          robotsUrl,
          "robots.txt evaluated for User-agent: *",
          robots.hosts[0]?.storageKey,
        ),
      ],
    );

    // P3-16 — admin/staff paths.
    if (adminUrls.size === 0) {
      out.na("P3-16", "no admin/staff path crawled or linked");
      return out.build();
    }
    const issues = [...adminUrls].flatMap((url) => {
      const snap = byUrl.get(url);
      const rule = disallowRule(url);
      const why: string[] = [];
      if (linkedFrom.has(url))
        why.push(`linked from ${linkedFrom.get(url)?.slice(0, 3).join(", ")}`);
      if (snap) {
        if (snap.status === 200 && /html/i.test(snap.contentType ?? "html"))
          why.push("answers 200 to an anonymous fetch (no auth)");
        if (!/noindex/i.test(snap.xRobotsTag ?? ""))
          why.push("no X-Robots-Tag: noindex header");
        if (rule && noindex(snap)) why.push(`noindex + ${rule}`);
      }
      return why.length > 0 ? [{ url, why, rule }] : [];
    });
    if (issues.length > 0) {
      out.finding({
        itemIds: ["P3-16"],
        severity: "S3",
        title: "Admin/staff area is exposed",
        detail: issues
          .map(
            (i) =>
              `${i.url} — ${i.why.join("; ")}${byUrl.has(i.url) ? "" : " (not fetched: Disallowed; auth/header unverified)"}`,
          )
          .join("\n"),
        fix: "Put admin/staff areas behind auth, send `X-Robots-Tag: noindex`, drop the robots Disallow for them, and remove public links.",
        fixability: "FIXABLE",
        effort: "M",
        urls: issues.map((i) => i.url),
        evidenceRefs: issues.flatMap((i) => [
          ...linkRefs(i.url),
          ...(i.rule ? [robotsRef(i.url, i.rule)] : []),
          ...(byUrl.has(i.url)
            ? [
                out.evidence(
                  "header",
                  i.url,
                  `X-Robots-Tag: ${byUrl.get(i.url)?.xRobotsTag ?? "(none)"}`,
                ),
              ]
            : []),
        ]),
      });
    } else {
      out.pass(
        "P3-16",
        `${adminUrls.size} admin path(s) unlinked; auth + noindex header present`,
        [out.evidence("url", ctx.origin, [...adminUrls].join("\n"))],
      );
    }
    return out.build();
  },
};
