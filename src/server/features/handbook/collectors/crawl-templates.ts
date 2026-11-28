import { sort } from "remeda";
import { sha256Hex } from "@/server/lib/audit/ids";
import { templateBoilerplate } from "../engine/boilerplate";
import { pathPatterns } from "@/server/features/handbook/engine/depth";
import type {
  PageSnapshot,
  TemplatesData,
} from "@/server/features/handbook/contracts/collectors";

/** What clustering needs of each crawled page (site-crawl's page extras). */
type TemplateExtra = { skeleton: string; bytes: number; blocks: string[] };

// ---------------------------------------------------------------------------
// Template clustering (ADR-006)
// ---------------------------------------------------------------------------

export async function clusterTemplates(
  snapshots: readonly PageSnapshot[],
  extras: ReadonlyMap<string, TemplateExtra>,
): Promise<TemplatesData["templates"][number][]> {
  const html = snapshots.filter((s) => s.rawKey && s.status === 200);
  const patterns = pathPatterns(html.map((s) => s.url));
  const groups = new Map<
    string,
    { pattern: string; hash: string; urls: string[] }
  >();
  for (const snap of html) {
    const pattern = patterns.get(snap.url) ?? "/";
    const hash = (await sha256Hex(extras.get(snap.url)?.skeleton ?? "")).slice(
      0,
      8,
    );
    const key = `${pattern}:${hash}`;
    const group = groups.get(key) ?? { pattern, hash, urls: [] };
    group.urls.push(snap.url);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    urlPattern: g.pattern,
    skeletonHash: g.hash,
    urls: g.urls,
    samples: pickSamples(g.urls, (u) => extras.get(u)?.bytes ?? 0),
    boilerplate: templateBoilerplate(
      g.urls.map((u) => extras.get(u)?.blocks ?? []),
    ),
  }));
}

function pickSamples(urls: readonly string[], size: (url: string) => number) {
  const first = sort(
    urls,
    (a, b) => a.length - b.length || a.localeCompare(b),
  )[0];
  const bySize = sort(urls, (a, b) => size(a) - size(b));
  const median = bySize[Math.floor((bySize.length - 1) / 2)];
  const largest = bySize[bySize.length - 1];
  const picks: { url: string; reason: "first" | "median" | "largest" }[] = [];
  for (const [url, reason] of [
    [first, "first"],
    [median, "median"],
    [largest, "largest"],
  ] as const) {
    if (url && !picks.some((p) => p.url === url)) picks.push({ url, reason });
  }
  const ranks = [1, 2, 3] as const;
  return picks.flatMap((p, i) => {
    const rank = ranks[i];
    return rank ? [{ ...p, rank }] : [];
  });
}
