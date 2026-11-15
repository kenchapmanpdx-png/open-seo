import type {
  CheckResult,
  EvidenceDraft,
  FindingDraft,
  ItemVerdict,
} from "@/server/features/handbook/contracts/check";
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
    { status: "PASS" | "NA" | "BLOCKED"; note: string; refs: string[] }
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

/** URL without fragment, for set membership across sitemap/links/canonicals. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.href;
  } catch {
    return url;
  }
}
