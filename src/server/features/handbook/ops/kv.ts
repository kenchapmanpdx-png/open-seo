// Handbook recovery keys in the shared `KV` namespace (B13 WO-B13-010,
// ADR-027). Both workers bind the same namespace (E30), so the audit worker's
// beats are visible to the app worker's reconciler. KV is a hint only: run
// and audit rows decide what happens; a missing or unreadable key reads null.
import { env } from "cloudflare:workers";
import { z } from "zod";

const BEAT_TTL_S = 24 * 3600;
const RERUN_TTL_S = 7 * 24 * 3600;
const SELF_TEST_KEY = "fork:hb:selftest";

const beatSchema = z.object({
  ts: z.number(),
  stage: z.string(),
  batch: z.number(),
});
type Beat = z.infer<typeof beatSchema>;

const rerunNoteSchema = z.union([
  z.object({ newAuditId: z.string(), at: z.string() }),
  z.object({ blockedBy: z.string() }),
]);
type RerunNote = z.infer<typeof rerunNoteSchema>;

const beatKey = (runId: string) => `fork:hb:beat:${runId}`;
const rerunKey = (auditId: string) => `fork:hb:rerun:${auditId}`;

async function readJson<T>(key: string, schema: z.ZodType<T>) {
  try {
    const raw = await env.KV.get(key);
    if (!raw) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const HandbookKv = {
  putBeat: (runId: string, beat: Beat) =>
    env.KV.put(beatKey(runId), JSON.stringify(beat), {
      expirationTtl: BEAT_TTL_S,
    }),
  getBeat: (runId: string) => readJson(beatKey(runId), beatSchema),
  putRerunNote: (auditId: string, note: RerunNote) =>
    env.KV.put(rerunKey(auditId), JSON.stringify(note), {
      expirationTtl: RERUN_TTL_S,
    }),
  getRerunNote: (auditId: string) =>
    readJson(rerunKey(auditId), rerunNoteSchema),
  /** Put + get round trip; false on any error or a mismatched read. */
  async selfTest(): Promise<boolean> {
    try {
      const value = String(Date.now());
      await env.KV.put(SELF_TEST_KEY, value, { expirationTtl: 60 });
      return (await env.KV.get(SELF_TEST_KEY)) === value;
    } catch {
      return false;
    }
  },
} as const;
