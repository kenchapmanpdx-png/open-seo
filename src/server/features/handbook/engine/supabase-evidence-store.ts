import { sha256Hex } from "@/server/lib/audit/ids";
import {
  EVIDENCE_BUCKET,
  type EvidenceStore,
} from "@/server/features/handbook/contracts/evidence-store";

/**
 * K4 Supabase Storage store (ADR-003): private bucket, plain REST with the
 * service-role key (server-side only; no SDK in the worker bundle). The
 * bucket is created on first 404.
 */
export function createSupabaseEvidenceStore(config: {
  url: string;
  serviceRoleKey: string;
}): EvidenceStore {
  const base = `${config.url.replace(/\/$/, "")}/storage/v1`;
  const auth = {
    authorization: `Bearer ${config.serviceRoleKey}`,
    apikey: config.serviceRoleKey,
  };
  let bucketReady: Promise<void> | null = null;
  const ensureBucket = () => {
    bucketReady ??= fetch(`${base}/bucket`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        id: EVIDENCE_BUCKET,
        name: EVIDENCE_BUCKET,
        public: false,
      }),
    }).then(async (res) => {
      // 409/400 "already exists" is fine.
      if (!res.ok && res.status !== 409 && res.status !== 400) {
        throw new Error(`evidence bucket create failed: HTTP ${res.status}`);
      }
    });
    return bucketReady;
  };
  const objectUrl = (key: string) =>
    `${base}/object/${EVIDENCE_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;

  const listNames = async (prefix: string): Promise<string[]> => {
    const res = await fetch(`${base}/object/list/${EVIDENCE_BUCKET}`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000 }),
    });
    if (!res.ok) return [];
    const body: unknown = await res.json();
    if (!Array.isArray(body)) return [];
    return body.flatMap((o: unknown) =>
      o && typeof o === "object" && "name" in o && typeof o.name === "string"
        ? [o.name]
        : [],
    );
  };

  return {
    async put(key, bytes, contentType) {
      const upload = () =>
        fetch(objectUrl(key), {
          method: "POST",
          headers: { ...auth, "content-type": contentType, "x-upsert": "true" },
          body: new Uint8Array(bytes),
        });
      let res = await upload();
      if (res.status === 404 || res.status === 400) {
        await ensureBucket();
        res = await upload();
      }
      if (!res.ok)
        throw new Error(`evidence upload failed: HTTP ${res.status}`);
      return {
        key,
        sha256: await sha256Hex(new TextDecoder().decode(bytes)),
        byteSize: bytes.byteLength,
      };
    },
    async get(key) {
      const res = await fetch(objectUrl(key), { headers: auth });
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error(`evidence read failed: HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async deleteRun(projectId, runId) {
      // Keys are <project>/<run>/<kind>/<file>: list the kind folders, then files.
      const runPrefix = `${projectId}/${runId}`;
      const files: string[] = [];
      for (const folder of await listNames(runPrefix)) {
        files.push(
          ...(await listNames(`${runPrefix}/${folder}`)).map(
            (f) => `${runPrefix}/${folder}/${f}`,
          ),
        );
      }
      if (files.length === 0) return;
      await fetch(`${base}/object/${EVIDENCE_BUCKET}`, {
        method: "DELETE",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ prefixes: files }),
      });
    },
  };
}
