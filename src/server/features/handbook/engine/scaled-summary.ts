import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { ScaledContent } from "@/server/features/handbook/contracts/scaled-copy";
import { SIMILAR, THIN_WORDS } from "../checks/duplicates";
import { scaledContentArtifact } from "./evidence";
import type { HandbookRuntime, RunInput } from "./runner";
import { duplicateClusters, indexable, median } from "../checks/scaled-sets";

/**
 * "Scaled content" summary block (fork/SCALED-COPY.md §3.5, ADR-022): counts
 * from the crawl snapshots and the run's findings, nothing new fetched, not
 * scored. Zeros stay 0. SUPP-18 is absent when its option is off.
 */
const MIN_TEMPLATE_PAGES = 3;

type FindingLike = { itemIds: readonly string[]; urls: readonly string[] };

const urlsOf = (findings: readonly FindingLike[], itemId: string) =>
  findings.filter((f) => f.itemIds.includes(itemId)).flatMap((f) => f.urls);

export function buildScaledContent(
  collected: CollectedData,
  findings: readonly FindingLike[],
  supp18?: ScaledContent["supp18"],
): ScaledContent {
  const snapshots =
    collected.pages.status === "ok" ? collected.pages.snapshots : [];
  const live = snapshots.filter(indexable);

  const thin = new Set([
    ...live.filter((s) => (s.mainWords ?? 0) < THIN_WORDS).map((s) => s.url),
    ...urlsOf(findings, "P5-15"),
  ]);

  // Own text = sentences found on no other indexable page.
  const pagesWith = new Map<number, number>();
  for (const s of live)
    for (const h of new Set(s.sentenceHashes))
      pagesWith.set(h, (pagesWith.get(h) ?? 0) + 1);
  const ownShare = new Map<string, number>();
  for (const s of live) {
    const hashes = [...new Set(s.sentenceHashes)];
    if (hashes.length === 0) continue;
    const own = hashes.filter((h) => pagesWith.get(h) === 1).length;
    ownShare.set(s.url, own / hashes.length);
  }
  const templates =
    collected.templates.status === "ok" ? collected.templates.templates : [];
  const ownTextShare = templates.flatMap((t) => {
    const shares = t.urls.flatMap((u) => ownShare.get(u) ?? []);
    return shares.length >= MIN_TEMPLATE_PAGES
      ? [
          {
            template: `${t.urlPattern} (e.g. ${new URL(t.urls[0]).pathname})`,
            pages: shares.length,
            median: Number(median(shares).toFixed(2)),
          },
        ]
      : [];
  });

  const supp17 = findings.filter((f) => f.itemIds.includes("SUPP-17"));
  const clusterUrls = new Set(duplicateClusters(live, SIMILAR).flat());
  // §3.1 rule 4: a URL in a P3-12 cluster and a SUPP-17 set counts once,
  // under P3-12 (P5-09 URLs already left the sets, rule 1).
  const supp17Urls = new Set(
    supp17.flatMap((f) => f.urls).filter((u) => !clusterUrls.has(u)),
  );
  return {
    indexablePages: live.length,
    duplicateClusterPages: clusterUrls.size,
    thinPages: thin.size,
    supp17Sets: supp17.length,
    supp17Pages: supp17Urls.size,
    ownTextShare,
    ...(supp18 ? { supp18 } : {}),
    supp19Pages: new Set(urlsOf(findings, "SUPP-19")).size,
  };
}

/** The summary as an artifact row; the app's run page reads it back (ADR-022). */
export const scaledContentEvidence = (
  input: RunInput,
  runtime: HandbookRuntime,
  collected: CollectedData,
  findings: readonly FindingLike[],
  supp18: ScaledContent["supp18"],
) =>
  scaledContentArtifact(
    input,
    runtime,
    buildScaledContent(collected, findings, supp18),
  );
