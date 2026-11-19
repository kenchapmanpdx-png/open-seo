import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import { normalizeUrl } from "@/server/features/handbook/checks/support";

/**
 * Which URLs the sidecar collectors (render, axe, Lighthouse) visit. A leaf
 * module so the stage planner can count Lighthouse batches without loading
 * the collectors.
 */

const MAX_SAMPLES = 16;
const CONTACT_PATH = /\/contact/i;
/** Lighthouse pages per stage batch in `all` mode (ADR-018). */
export const LIGHTHOUSE_BATCH_SIZE = 25;

/** Template rank-1 samples (max 16); null when templates are unavailable. */
export function sampleUrls(collected: Partial<CollectedData>): string[] | null {
  const templates = collected.templates;
  if (!templates || templates.status !== "ok") return null;
  return templates.templates
    .flatMap((t) => t.samples.filter((s) => s.rank === 1).map((s) => s.url))
    .slice(0, MAX_SAMPLES);
}

const HTML_TYPE = /html/i;

/** `full`: every live 200 HTML page (not a redirect), first-seen order. */
export function livePageUrls(
  collected: Partial<CollectedData>,
): string[] | null {
  const pages = collected.pages;
  if (!pages || pages.status !== "ok") return null;
  const seen = new Set<string>();
  return pages.snapshots.flatMap((s) => {
    const url = normalizeUrl(s.url);
    const live =
      s.status === 200 &&
      normalizeUrl(s.finalUrl) === url &&
      HTML_TYPE.test(s.contentType ?? "html");
    if (!live || seen.has(url)) return [];
    seen.add(url);
    return [s.url];
  });
}

/**
 * First-screen screenshot targets (FULL-READ §3.3): template rank-1
 * samples, home, contact pages and hubs (a directory URL with ≥ 2 rendered
 * pages below it).
 */
export function screenshotTargets(
  urls: readonly string[],
  samples: readonly string[],
): Set<string> {
  const paths = urls.map((u) => new URL(u).pathname);
  const out = new Set(samples.map(normalizeUrl));
  urls.forEach((url, i) => {
    const path = paths[i];
    const dir = path.endsWith("/") ? path : `${path}/`;
    const children = paths.filter((p) => p !== path && p.startsWith(dir));
    if (path === "/" || CONTACT_PATH.test(path) || children.length >= 2)
      out.add(normalizeUrl(url));
  });
  return out;
}
