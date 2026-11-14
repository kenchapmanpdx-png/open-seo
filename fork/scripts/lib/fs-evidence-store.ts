import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";

/** K4 filesystem store for CLI runs (ADR-003 fallback): `<root>/<key>`. */
export function createFsEvidenceStore(root: string): EvidenceStore {
  return {
    async put(key, bytes) {
      const path = join(root, key);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
      return {
        key,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.byteLength,
      };
    },
    async get(key) {
      const path = join(root, key);
      return existsSync(path) ? new Uint8Array(readFileSync(path)) : null;
    },
    async deleteRun(projectId, runId) {
      rmSync(join(root, projectId, runId), { recursive: true, force: true });
    },
  };
}
