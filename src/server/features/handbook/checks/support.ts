import type {
  CheckResult,
  EvidenceDraft,
  FindingDraft,
  ItemVerdict,
} from "@/server/features/handbook/contracts/check";
import type { RobotsHost } from "@/server/features/handbook/contracts/collectors";
import type { EvidenceKind } from "@/server/features/handbook/contracts/registry-types";

/**
 * Small builder shared by K1 checks: collects evidence drafts under stable
 * refs, findings, and per-item verdicts, then derives each item's status
 * (OPEN when a finding cites it, else the PASS/NA the check recorded).
 */
const EXCERPT_CHARS = 1800;

export function clip(text: string): string {
  return text.length > EXCERPT_CHARS
    ? `${text.slice(0, EXCERPT_CHARS)}\n…`
    : text;
}

export function createResult(itemIds: readonly string[]) {
  const evidence = new Map<string, EvidenceDraft>();
  const findings: FindingDraft[] = [];
  const notes = new Map<
    string,
    {
      status: "PASS" | "NA" | "BLOCKED" | "LIMITED";
      note: string;
      refs: string[];
    }
  >();

  return {
    evidence(
      kind: EvidenceKind,
      url: string,
      excerpt: string,
      storageKey?: string | null,
    ): string {
      const ref = `${kind}:${url}:${evidence.size}`;
      evidence.set(ref, {
        ref,
        kind,
        url,
        excerpt: clip(excerpt),
        ...(storageKey ? { storageKey } : {}),
      });
      return ref;
    },
    finding(draft: Omit<FindingDraft, "source">) {
      findings.push({ ...draft, source: "deterministic" });
    },
    pass(itemId: string, note: string, refs: string[]) {
      notes.set(itemId, { status: "PASS", note, refs });
    },
    na(itemId: string, note: string) {
      notes.set(itemId, { status: "NA", note, refs: [] });
    },
    /** Only part of what the item asks could be verified (scores 0.5). */
    limited(itemId: string, note: string, refs: string[]) {
      notes.set(itemId, { status: "LIMITED", note, refs });
    },
    /** An optional collector this item needs is missing: never PASS. */
    blocked(itemId: string, note: string) {
      notes.set(itemId, { status: "BLOCKED", note, refs: [] });
    },
    build(): CheckResult {
      const statuses = itemIds.flatMap((itemId): ItemVerdict[] => {
        const cited = findings.filter((f) => f.itemIds.includes(itemId));
        if (cited.length > 0) {
          return [
            {
              itemId,
              status: "OPEN",
              note: cited.map((f) => f.title).join("; "),
              evidenceRefs: cited.flatMap((f) => f.evidenceRefs),
            },
          ];
        }
        const recorded = notes.get(itemId);
        if (!recorded) return [];
        return [
          {
            itemId,
            status: recorded.status,
            note: recorded.note,
            evidenceRefs: recorded.refs,
          },
        ];
      });
      return { statuses, findings, evidence: [...evidence.values()] };
    },
  };
}

export const headerValue = (
  headers: ReadonlyArray<readonly [string, string]>,
  name: string,
) => headers.find(([k]) => k.toLowerCase() === name)?.[1] ?? null;

export const formatHeaders = (
  headers: ReadonlyArray<readonly [string, string]>,
) => headers.map(([k, v]) => `${k}: ${v}`).join("\n");

/**
 * WO-B20-007: the only URL parser under `checks/`. Values read from a site
 * (hrefs, src, canonicals, sitemap `<loc>`, headers, robots.txt, JSON-LD)
 * can be malformed; one bad value must skip that value, never throw and
 * discard the whole check. `hostile-inputs.test.ts` runs every check on
 * malformed URLs and fails on any `new URL(` outside this file.
 */
export function parseUrl(value: string, base?: string): URL | undefined {
  return URL.canParse(value, base) ? new URL(value, base) : undefined;
}

/** Path of `url`; "" when malformed (matches no path rule). */
export const pathOf = (url: string, base?: string) =>
  parseUrl(url, base)?.pathname ?? "";

/** Hostname without `www.`; "" when malformed (matches no host). */
export const bareHost = (url: string) =>
  (parseUrl(url)?.hostname ?? "").replace(/^www\./, "");

/** The run origin (validated before the run starts; not a site-read value). */
export const originUrl = (origin: string) => new URL(origin);

/** `path` on the run origin, e.g. `siteUrl(ctx.origin, "/robots.txt")`. */
export const siteUrl = (origin: string, path = "/") =>
  new URL(path, origin).href;

/** URL without fragment, for set membership across sitemap/links/canonicals. */
export function normalizeUrl(url: string): string {
  const u = parseUrl(url);
  if (!u) return url;
  u.hash = "";
  return u.href;
}

/**
 * WO-B21-003: key for matching sitemap `<loc>` against crawled pages: the
 * normalized URL with its scheme folded (`http://x/a` = `https://x/a`). The
 * scheme difference itself is P3-19's finding; the host is not folded (www vs
 * bare stays P3-19's host rule). Everything else compares with `normalizeUrl`.
 */
export function sitemapKey(url: string): string {
  return normalizeUrl(url).replace(/^https?:\/\//i, "//");
}

/**
 * WO-B20-011: the robots.txt hosts that answer 4xx when the site has none at
 * all (no host answers 200, at least one answers 4xx, the rest only redirect,
 * e.g. `www.` → bare host). Empty otherwise: one shared rule for P3-15 and P3-19.
 */
export function missingRobotsHosts(hosts: readonly RobotsHost[]): RobotsHost[] {
  const missing = hosts.filter((h) => h.status >= 400 && h.status < 500);
  const others = hosts.filter((h) => !missing.includes(h));
  return missing.length > 0 &&
    others.every((h) => h.status >= 300 && h.status < 400)
    ? missing
    : [];
}
