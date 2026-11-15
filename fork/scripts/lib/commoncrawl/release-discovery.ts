// Ported from Canonry/canonry@4b91e077 packages/integration-commoncrawl/src/{release-discovery,constants}.ts — MIT, © 2026 Arber X and contributors
// Licensed under the MIT License (https://opensource.org/licenses/MIT).
import os from "node:os";
import path from "node:path";
import {
  formatReleaseId,
  windowSlug,
} from "../../../../src/server/features/backlinks/providers/commoncrawl/release";

const CC_BASE_URL = "https://data.commoncrawl.org/projects/hyperlinkgraph";

export const CC_CACHE_DIR =
  process.env.CC_CACHE_DIR ??
  path.join(os.homedir(), ".cache", "openseo", "commoncrawl");

export function ccReleasePaths(release: string) {
  const base = `${CC_BASE_URL}/${release}/domain`;
  const vertexFilename = `${release}-domain-vertices.txt.gz`;
  const edgesFilename = `${release}-domain-edges.txt.gz`;
  return {
    vertexUrl: `${base}/${vertexFilename}`,
    edgesUrl: `${base}/${edgesFilename}`,
    vertexFilename,
    edgesFilename,
  };
}

export interface ProbedRelease {
  release: string;
  vertexUrl: string;
  edgesUrl: string;
  vertexBytes: number | null;
  edgesBytes: number | null;
  lastModified: string | null;
}

/**
 * Candidate releases newest-first: walk the window's FIRST month back one month
 * at a time from `now` (inclusive, `maxMonthsBack` steps). Cross-year windows
 * are probed too; they 404 today and cost one HEAD pair.
 */
function probeCandidates(now: Date, maxMonthsBack: number): string[] {
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  const out: string[] = [];
  for (let step = 0; step <= maxMonthsBack; step++) {
    out.push(formatReleaseId(year, windowSlug(month)));
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return out;
}

export async function probeRelease(
  release: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbedRelease | null> {
  const paths = ccReleasePaths(release);
  const [vertex, edges] = await Promise.all([
    fetchImpl(paths.vertexUrl, { method: "HEAD" }),
    fetchImpl(paths.edgesUrl, { method: "HEAD" }),
  ]);
  if (!vertex.ok || !edges.ok) return null;
  return {
    release,
    vertexUrl: paths.vertexUrl,
    edgesUrl: paths.edgesUrl,
    vertexBytes: parseContentLength(vertex.headers.get("content-length")),
    edgesBytes: parseContentLength(edges.headers.get("content-length")),
    lastModified: vertex.headers.get("last-modified"),
  };
}

export async function probeLatestRelease(
  opts: { now?: Date; maxMonthsBack?: number; fetchImpl?: typeof fetch } = {},
): Promise<ProbedRelease | null> {
  const candidates = probeCandidates(
    opts.now ?? new Date(),
    opts.maxMonthsBack ?? 14,
  );
  for (const release of candidates) {
    const result = await probeRelease(release, opts.fetchImpl);
    if (result) return result;
  }
  return null;
}

export function parseContentLength(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}
