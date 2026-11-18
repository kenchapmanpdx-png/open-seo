import type {
  CollectedData,
  Collector,
  HeadersData,
} from "@/server/features/handbook/contracts/collectors";
import { tryFetch } from "./fetch-collectors";

const FONT_FILE = /\.(?:woff2?|ttf|otf|eot)(?:[?#]|$)/i;

/**
 * One same-host asset URL per type, as first seen in raw HTML (home page
 * first, then crawl order): stylesheet, script, image, font. Header probes
 * for cache policy (P7-07) and per-type header rules.
 */
function assetUrls(collected: Partial<CollectedData>): string[] {
  if (collected.pages?.status !== "ok") return [];
  const live = collected.pages.snapshots.filter((s) => s.status === 200);
  const pages = [
    ...live.filter((s) => new URL(s.url).pathname === "/"),
    ...live.filter((s) => new URL(s.url).pathname !== "/"),
  ];
  const first = (pick: (s: (typeof pages)[number]) => string[]) => {
    for (const page of pages) {
      const host = new URL(page.finalUrl).host;
      const hit = pick(page).find((url) => {
        try {
          return new URL(url).host === host;
        } catch {
          return false;
        }
      });
      if (hit) return [hit];
    }
    return [];
  };
  return [
    ...new Set([
      ...first((s) =>
        s.markup.headLinks
          .filter((l) => /\bstylesheet\b/i.test(l.rel))
          .map((l) => l.href),
      ),
      ...first((s) => s.markup.scripts.flatMap((x) => (x.src ? [x.src] : []))),
      ...first((s) => s.images.map((i) => i.src)),
      ...first((s) =>
        s.markup.headLinks
          .filter((l) => l.as === "font" || FONT_FILE.test(l.href))
          .map((l) => l.href),
      ),
    ]),
  ];
}

// HTML headers: every crawled page's own response (ADR-021); one fetch each
// for a stylesheet, script, image, font, a 404 URL, plain-HTTP home (not followed).
export const headersCollector: Collector<"headers"> = {
  key: "headers",
  dependsOn: ["pages"],
  async collect(ctx, collected) {
    const responses: HeadersData["responses"][number][] = [];
    const seen = new Set<string>();
    if (collected.pages?.status === "ok") {
      for (const s of collected.pages.snapshots) {
        if (!s.headers || seen.has(s.finalUrl)) continue;
        seen.add(s.finalUrl);
        responses.push({
          url: s.finalUrl,
          status: s.status,
          headers: s.headers,
        });
      }
    }
    const origin = new URL(ctx.origin);
    const probes = [
      ...assetUrls(collected),
      `${origin.origin}/__openseo-404-${Date.now().toString(36)}`,
      `http://${origin.host}/`,
    ];
    for (const url of probes) {
      const plainHttp = url === probes.at(-1);
      const res = await tryFetch(
        ctx,
        url,
        plainHttp ? { maxRedirects: 0 } : {},
      );
      if (res)
        responses.push({
          url: res.finalUrl,
          status: res.status,
          headers: res.headers.filter(([k]) => k !== "set-cookie"),
        });
    }
    if (responses.length === 0)
      return { status: "unavailable", reason: "no response" };
    return { status: "ok", responses };
  },
};
