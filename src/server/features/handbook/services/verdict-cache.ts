import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import { llmVerdictSchema } from "@/server/features/handbook/contracts/llm";
import type { VerdictCache } from "@/server/features/handbook/llm/judge";
import { sha256Hex } from "@/server/lib/audit/ids";

/**
 * Judge verdicts kept in the evidence store under
 * `<projectId>/_judge-cache/`, so an unchanged rerun of the project skips
 * its judge calls (FULL-READ §9 rerun cost). Outside any run folder, so
 * evidence retention keeps it; one small JSON object per verdict.
 */
export function storeVerdictCache(
  store: EvidenceStore,
  projectId: string,
): VerdictCache {
  const key = async (k: string) =>
    `${projectId}/_judge-cache/${await sha256Hex(k)}.json`;
  return {
    async get(k) {
      const bytes = await store.get(await key(k));
      if (!bytes) return null;
      try {
        const parsed = llmVerdictSchema.safeParse(
          JSON.parse(new TextDecoder().decode(bytes)),
        );
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    async put(k, verdict) {
      await store.put(
        await key(k),
        new TextEncoder().encode(JSON.stringify(verdict)),
        "application/json",
      );
    },
  };
}
