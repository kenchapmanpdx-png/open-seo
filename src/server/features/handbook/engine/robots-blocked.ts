import type { RobotsData } from "@/server/features/handbook/contracts/collectors";
import { decide } from "./robots";

/**
 * P3-20 (handbook §18): render requests robots.txt disallows for Googlebot
 * on a host whose robots.txt was fetched (200). Off-site hosts are ignored
 * (their robots.txt is not fetched). Shared by the render collector (which
 * re-renders without them, WO-B19-004) and the check.
 */
export const STATIC_RENDER_TYPES = new Set([
  "script",
  "stylesheet",
  "image",
  "font",
]);
const RENDER_TYPES = new Set([...STATIC_RENDER_TYPES, "xhr", "fetch"]);

export type BlockedRequest = { url: string; type: string; rule: string };

export function robotsBlockedRequests(
  requests: ReadonlyArray<{ url: string; resourceType: string }>,
  robots: RobotsData,
): { checked: number; blocked: BlockedRequest[] } {
  const hosts = new Map(
    robots.hosts.filter((h) => h.status === 200).map((h) => [h.host, h]),
  );
  let checked = 0;
  const blocked: BlockedRequest[] = [];
  for (const req of requests) {
    if (!RENDER_TYPES.has(req.resourceType)) continue;
    let u: URL;
    try {
      u = new URL(req.url);
    } catch {
      continue;
    }
    const host = hosts.get(u.host);
    if (!host) continue;
    checked += 1;
    const d = decide(
      host.host,
      host.groups,
      "Googlebot",
      u.pathname + u.search,
    );
    if (!d.allowed)
      blocked.push({
        url: req.url,
        type: req.resourceType,
        rule: d.matchedRule ?? "disallow",
      });
  }
  return { checked, blocked };
}

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);
const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

/**
 * `needle` occurs in `hay` ignoring whitespace: a typing animation prints a
 * sentence as one span per letter ("A i r c o r"), the finished text as words.
 */
export function containsText(hay: string, needle: string) {
  return hay.replace(/\s+/g, "").includes(needle.replace(/\s+/g, ""));
}

/**
 * Main text of the normal render vs the render with the blocked requests
 * aborted: same content when the word sets overlap ≥ 98 % (Jaccard) and the
 * word counts are within 2 %.
 */
export function compareRenderedText(normal: string, blocked: string) {
  const a = words(normal);
  const b = words(blocked);
  const setA = new Set(a);
  const setB = new Set(b);
  const both = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 1 : both / union;
  const hi = Math.max(a.length, b.length);
  const sameContent =
    jaccard >= 0.98 && (hi === 0 || Math.abs(a.length - b.length) / hi <= 0.02);
  const missing = sentences(normal).filter((s) => !blocked.includes(s));
  return {
    wordsNormal: a.length,
    wordsBlocked: b.length,
    sameContent,
    missing,
  };
}
