import { sha256Hex } from "@/server/lib/audit/ids";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";

/** K4 in-memory store: tests and dry runs. */
export function createMemoryEvidenceStore(): EvidenceStore & {
  objects: Map<string, Uint8Array>;
} {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    async put(key, bytes) {
      objects.set(key, bytes);
      return {
        key,
        sha256: await sha256Hex(new TextDecoder().decode(bytes)),
        byteSize: bytes.byteLength,
      };
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async deleteRun(projectId, runId) {
      for (const key of objects.keys()) {
        if (key.startsWith(`${projectId}/${runId}/`)) objects.delete(key);
      }
    },
  };
}
