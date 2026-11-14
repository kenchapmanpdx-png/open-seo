import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";

/** K4 filesystem store for CLI runs (ADR-003 fallback): gzip at `<root>/<key>.gz`. */
export function createFsEvidenceStore(root: string): EvidenceStore {
  return {
    async put(key, bytes) {
      const path = join(root, `${key}.gz`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, gzipSync(bytes));
      return {
        key,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.byteLength,
      };
    },
    async get(key) {
      const path = join(root, `${key}.gz`);
      return existsSync(path)
        ? new Uint8Array(gunzipSync(readFileSync(path)))
        : null;
    },
    async deleteRun(projectId, runId) {
      rmSync(join(root, projectId, runId), { recursive: true, force: true });
    },
  };
}
