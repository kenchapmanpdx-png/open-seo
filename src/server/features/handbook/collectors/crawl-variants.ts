import {
  sectionOf,
  variantPattern,
} from "@/server/features/handbook/engine/depth";

/**
 * WO-B27-004: parameter variants of known pages (same path, other query).
 * The first of each parameter pattern is read as a sample and not counted
 * against the page limit; the rest are skipped and counted. The page that
 * links a variant keeps the link, so link checks keep their evidence.
 */
export class Variants {
  private readonly patterns = new Set<string>();
  private readonly samples: string[] = [];
  private skipped = 0;
  constructor(patterns: Iterable<string> = []) {
    for (const p of patterns) this.patterns.add(p);
  }
  /** True when `url` is a variant (sampled or skipped): not a page to count. */
  take(url: string, known: ReadonlySet<string>): boolean {
    const pattern = variantPattern(url, known);
    if (pattern === null) return false;
    if (this.patterns.has(pattern)) this.skipped += 1;
    else {
      this.patterns.add(pattern);
      this.samples.push(url);
    }
    return true;
  }
  isSample(url: string) {
    return this.samples.includes(url);
  }
  pending(attempted: ReadonlySet<string>) {
    return this.samples.filter((u) => !attempted.has(u));
  }
  counts() {
    return { sampled: this.samples.length, skipped: this.skipped };
  }
}

export function bySection(urls: readonly string[]) {
  const out = new Map<string, string[]>();
  for (const url of urls) {
    const key = sectionOf(url);
    out.set(key, [...(out.get(key) ?? []), url]);
  }
  return [...out].map(([section, list]) => ({ section, urls: list }));
}
