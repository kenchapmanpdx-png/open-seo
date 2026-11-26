import { sort } from "remeda";
import type {
  Collector,
  ResourcesData,
} from "@/server/features/handbook/contracts/collectors";
import { imageUrl } from "@/server/features/handbook/engine/page-images";
import { hostPacer, pool, probeUrl } from "./probe";

/**
 * Page resources (ADR-031, SUPP-20): unique `<img>` URLs (`imageUrl`: http
 * `src`, else the lazy `data-src`),
 * stylesheet `<link href>` and `<script src>` URLs on read pages, most pages
 * first, capped at 300. Own-host URLs go through `ctx.fetch`, other hosts
 * through `ctx.fetchOffsite`; 1 request / s per host.
 */
export const MAX_RESOURCES = 300;
const WORKERS = 4;

type Kind = ResourcesData["resources"][number]["kind"];

export const resourcesCollector: Collector<"resources"> = {
  key: "resources",
  dependsOn: ["pages"],
  async collect(ctx, collected) {
    if (collected.pages?.status !== "ok")
      return { status: "unavailable", reason: "pages unavailable" };
    const host = new URL(ctx.origin).hostname.toLowerCase();
    const found = new Map<string, { kind: Kind; sources: string[] }>();
    const add = (
      raw: string | null,
      kind: Kind,
      base: string,
      page: string,
    ) => {
      if (!raw) return;
      let u: URL;
      try {
        u = new URL(raw, base);
      } catch {
        return;
      }
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      u.hash = "";
      const entry = found.get(u.href) ?? { kind, sources: [] };
      if (!entry.sources.includes(page)) entry.sources.push(page);
      found.set(u.href, entry);
    };
    for (const s of collected.pages.snapshots) {
      for (const img of s.images) add(imageUrl(img), "img", s.finalUrl, s.url);
      for (const l of s.markup.headLinks)
        if (/\bstylesheet\b/i.test(l.rel))
          add(l.href, "css", s.finalUrl, s.url);
      for (const sc of s.markup.scripts) add(sc.src, "js", s.finalUrl, s.url);
    }
    const picked = sort(
      [...found],
      ([, a], [, b]) => b.sources.length - a.sources.length,
    ).slice(0, MAX_RESOURCES);
    if (found.size > MAX_RESOURCES)
      ctx.log("handbook.resources.capped", {
        found: found.size,
        probed: MAX_RESOURCES,
      });
    const pace = hostPacer();
    const resources: ResourcesData["resources"][number][] = await pool(
      picked,
      WORKERS,
      async ([url, { kind, sources }]) => {
        const own = new URL(url).hostname.toLowerCase() === host;
        const probe = own
          ? await probeUrl(ctx, ctx.fetch, pace, url)
          : await probeUrl(ctx, ctx.fetchOffsite, pace, url);
        return { url, kind, sourceUrls: sources, probe };
      },
    );
    return { status: "ok", resources, found: found.size };
  },
};
