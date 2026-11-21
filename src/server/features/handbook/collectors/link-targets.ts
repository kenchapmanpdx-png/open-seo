import { sort } from "remeda";
import type {
  Collector,
  LinkTargetsData,
} from "@/server/features/handbook/contracts/collectors";
import { normalizeUrl } from "@/server/features/handbook/checks/support";
import { noPace, pool, probeUrl } from "./probe";

/**
 * Internal link targets the crawl did not fetch (ADR-031, P3-08): every
 * same-host `<a href>` on crawled pages whose URL is neither a crawled URL
 * nor a crawled final URL, most-linked first, capped at 200. Probed through
 * `ctx.fetch` (site scope and pacing) with the Handbook user-agent.
 */
export const MAX_TARGETS = 200;
const WORKERS = 4;

export const linkTargetsCollector: Collector<"linkTargets"> = {
  key: "linkTargets",
  dependsOn: ["pages"],
  async collect(ctx, collected) {
    if (collected.pages?.status !== "ok")
      return { status: "unavailable", reason: "pages unavailable" };
    const host = new URL(ctx.origin).hostname.toLowerCase();
    const crawled = new Set(
      collected.pages.snapshots.flatMap((s) => [
        normalizeUrl(s.url),
        normalizeUrl(s.finalUrl),
      ]),
    );
    const found = new Map<string, string[]>();
    for (const page of collected.pages.snapshots) {
      for (const link of page.links) {
        let u: URL;
        try {
          u = new URL(link.href, page.finalUrl);
        } catch {
          continue;
        }
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
        if (u.hostname.toLowerCase() !== host) continue;
        const url = normalizeUrl(u.href);
        if (crawled.has(url)) continue;
        const sources = found.get(url) ?? [];
        if (!sources.includes(page.url)) sources.push(page.url);
        found.set(url, sources);
      }
    }
    const picked = sort(
      [...found],
      ([, a], [, b]) => b.length - a.length,
    ).slice(0, MAX_TARGETS);
    if (found.size > MAX_TARGETS)
      ctx.log("handbook.linkTargets.capped", {
        found: found.size,
        probed: MAX_TARGETS,
      });
    const targets: LinkTargetsData["targets"][number][] = await pool(
      picked,
      WORKERS,
      async ([url, sourceUrls]) => ({
        url,
        sourceUrls,
        probe: await probeUrl(ctx, ctx.fetch, noPace, url),
      }),
    );
    return { status: "ok", targets, found: found.size };
  },
};
