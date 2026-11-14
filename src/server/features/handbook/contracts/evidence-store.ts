/**
 * K4 — Evidence store (ADR-003). Implementations: Supabase Storage (app),
 * filesystem (CLI), memory (tests). Keys are
 * `<projectId>/<runId>/<kind>/<sha256-prefix>-<slug>.<ext>`.
 */
export type StoredObject = { key: string; sha256: string; byteSize: number };

export type EvidenceStore = {
  put: (
    key: string,
    bytes: Uint8Array,
    contentType: string,
  ) => Promise<StoredObject>;
  get: (key: string) => Promise<Uint8Array | null>;
  /** Removes every object under `<projectId>/<runId>/`. */
  deleteRun: (projectId: string, runId: string) => Promise<void>;
};

export const EVIDENCE_BUCKET = "handbook-evidence";
/** Max bytes of an inline `handbook_evidence.excerpt`. */
export const EVIDENCE_EXCERPT_MAX_BYTES = 2_048;
/** Runs per project whose stored bodies are kept (published reports exempt). */
export const EVIDENCE_RETAIN_RUNS = 5;
