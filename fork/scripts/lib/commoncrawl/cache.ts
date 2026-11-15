// Ported from Canonry/canonry@4b91e077 packages/integration-commoncrawl/src/cache.ts — MIT, © 2026 Arber X and contributors
// Licensed under the MIT License (https://opensource.org/licenses/MIT).
import fs from "node:fs";
import path from "node:path";
import {
  compareReleaseIds,
  isValidReleaseId,
} from "../../../../src/server/features/backlinks/providers/commoncrawl/release";
import { CC_CACHE_DIR } from "./release-discovery";

/** Directory holding one release's vertices/edges files. */
export function releaseCacheDir(
  release: string,
  cacheDir: string = CC_CACHE_DIR,
): string {
  if (!isValidReleaseId(release)) {
    throw new Error(`Invalid release id: ${release}`);
  }
  return path.join(cacheDir, release);
}

/** Cached release ids on disk, newest crawl window first. */
export function listCachedReleases(cacheDir: string = CC_CACHE_DIR): string[] {
  if (!fs.existsSync(cacheDir)) return [];
  return fs
    .readdirSync(cacheDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isValidReleaseId(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => compareReleaseIds(b, a));
}

/** Delete one cached release (no-op when absent). */
export function pruneCachedRelease(
  release: string,
  cacheDir: string = CC_CACHE_DIR,
): void {
  fs.rmSync(releaseCacheDir(release, cacheDir), {
    recursive: true,
    force: true,
  });
}

/** Keep the newest `keep` cached releases (ADR-016: latest two); returns pruned ids. */
export function pruneOldReleases(
  keep = 2,
  cacheDir: string = CC_CACHE_DIR,
): string[] {
  const pruned = listCachedReleases(cacheDir).slice(keep);
  for (const release of pruned) pruneCachedRelease(release, cacheDir);
  return pruned;
}
