import { findExcludingPath } from "@/shared/audit-exclude-paths";

/**
 * Handbook "Leave out sections" (WO-B18-015): the audit's robots-style
 * patterns, plus the section index itself (WO-B19-015): `/blog/` also
 * leaves out `/blog` (with or without a query string), the way a user
 * means "leave out the blog".
 */
export function handbookExcluded(
  patterns: readonly string[],
  url: string,
): string | undefined {
  const hit = findExcludingPath(patterns, url);
  if (hit || patterns.length === 0) return hit;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return undefined;
  }
  return patterns.find(
    (p) =>
      p.length > 1 &&
      p.endsWith("/") &&
      !p.includes("*") &&
      p.slice(0, -1) === path,
  );
}
