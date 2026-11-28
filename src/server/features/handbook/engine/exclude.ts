import { findExcludingPath } from "@/shared/audit-exclude-paths";

/**
 * Handbook "Leave out sections" (WO-B18-015): the audit's robots-style
 * patterns, plus the section index itself (WO-B19-015): `/blog/` also
 * leaves out `/blog` (with or without a query string), the way a user
 * means "leave out the blog".
 */
/**
 * WO-B27-090 (ADR-040): About / Contact pages are never left out, as home is
 * not: a leave-out is for volume, and the site-identity checks (P5-17, …)
 * need them. Shopify keeps them under `/pages/`, a section the automatic
 * scope can leave out. For Ken: "leave out About and Contact too".
 */
const IDENTITY_PAGE =
  /\/(about|about-us|our-story|who-we-are|our-team|meet-the-team|team|contact|contact-us)\/?$/i;

export const isIdentityPage = (path: string) => IDENTITY_PAGE.test(path);

export function handbookExcluded(
  patterns: readonly string[],
  url: string,
): string | undefined {
  if (patterns.length === 0) return undefined;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return findExcludingPath(patterns, url);
  }
  if (isIdentityPage(path)) return undefined;
  const hit = findExcludingPath(patterns, url);
  if (hit) return hit;
  return patterns.find(
    (p) =>
      p.length > 1 &&
      p.endsWith("/") &&
      !p.includes("*") &&
      p.slice(0, -1) === path,
  );
}
