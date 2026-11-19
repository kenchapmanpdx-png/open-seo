import { z } from "zod";
import { sha256Hex } from "@/server/lib/audit/ids";
import {
  EVIDENCE_BUCKET,
  type EvidenceStore,
} from "@/server/features/handbook/contracts/evidence-store";

const GZIP_TYPE = "application/gzip";
const GZIP_HEADERS = {
  "content-encoding": "gzip",
  // Supabase Storage user metadata (base64 JSON).
  "x-metadata": btoa(JSON.stringify({ contentEncoding: "gzip" })),
};

const isGzip = (bytes: Uint8Array) =>
  bytes.byteLength > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream("gzip"));
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream("gzip"));
}

async function pipe(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)])
    .stream()
    .pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * K4 Supabase Storage store (ADR-003): private bucket, plain REST with the
 * service-role key (server-side only; no SDK in the worker bundle). The
 * bucket is created on first 404. Bodies are stored gzip'd (FULL-READ §7.4)
 * with `Content-Encoding: gzip` sent as metadata; `get` returns the original
 * bytes, and objects written before compression read back unchanged.
 * `sha256` / `byteSize` describe the original bytes.
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
      // Already-compressed blobs (stage outputs) are stored as given.
      const compress = contentType !== GZIP_TYPE;
      const body = compress ? await gzip(bytes) : bytes;
      const upload = () =>
        fetch(objectUrl(key), {
          method: "POST",
          headers: {
            ...auth,
            "content-type": contentType,
            "x-upsert": "true",
            ...(compress ? GZIP_HEADERS : {}),
          },
          body: new Uint8Array(body),
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
      const bytes = new Uint8Array(await res.arrayBuffer());
      // Storage may or may not replay Content-Encoding; the magic bytes decide.
      return res.headers.get("content-type") !== GZIP_TYPE && isGzip(bytes)
        ? gunzip(bytes)
        : bytes;
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

/**
 * Short-lived signed GET URL for one private evidence object, so the browser
 * downloads the body from storage instead of through the worker (ADR-003).
 * Not part of K4: only the Supabase store can sign. A gzip'd body is offered
 * as a `.gz` download, since Storage does not decompress it for the browser.
 */
export async function createSupabaseSignedUrl(
  config: { url: string; serviceRoleKey: string },
  key: string,
  expiresInSeconds: number,
): Promise<string | null> {
  const base = `${config.url.replace(/\/$/, "")}/storage/v1`;
  const path = `${EVIDENCE_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const auth = {
    authorization: `Bearer ${config.serviceRoleKey}`,
    apikey: config.serviceRoleKey,
  };
  const res = await fetch(`${base}/object/sign/${path}`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!res.ok) return null;
  const body: unknown = await res.json();
  if (
    !body ||
    typeof body !== "object" ||
    !("signedURL" in body) ||
    typeof body.signedURL !== "string"
  )
    return null;
  const signed = `${base}${body.signedURL}`;
  const head = await fetch(`${base}/object/${path}`, {
    headers: { ...auth, range: "bytes=0-1" },
  });
  const start = head.ok ? new Uint8Array(await head.arrayBuffer()) : null;
  if (
    !start ||
    head.headers.get("content-type") === GZIP_TYPE ||
    start[0] !== 0x1f ||
    start[1] !== 0x8b
  )
    return signed;
  const file = `${key.split("/").at(-1) ?? "evidence"}.gz`;
  return `${signed}${signed.includes("?") ? "&" : "?"}download=${encodeURIComponent(file)}`;
}

const storageEntries = z.array(
  z.object({
    name: z.string(),
    id: z.string().nullable(),
    metadata: z.object({ size: z.number().optional() }).nullable(),
  }),
);

/**
 * Total bytes in the evidence bucket, walking folders with the list API
 * (Storage has no bucket-size endpoint). Null when a list call fails or the
 * walk needs more than `maxRequests` calls.
 */
export async function readSupabaseStorageBytes(
  config: { url: string; serviceRoleKey: string },
  maxRequests = 500,
): Promise<number | null> {
  const base = `${config.url.replace(/\/$/, "")}/storage/v1`;
  let requests = 0;
  const walk = async (prefix: string): Promise<number | null> => {
    let total = 0;
    for (let offset = 0; ; offset += LIST_PAGE) {
      if (++requests > maxRequests) return null;
      const res = await fetch(`${base}/object/list/${EVIDENCE_BUCKET}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.serviceRoleKey}`,
          apikey: config.serviceRoleKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ prefix, limit: LIST_PAGE, offset }),
      });
      if (!res.ok) return null;
      const parsed = storageEntries.safeParse(await res.json());
      if (!parsed.success) return null;
      const page = parsed.data;
      for (const entry of page) {
        if (entry.id === null) {
          // A folder (no object id): descend.
          const sub = await walk(
            prefix ? `${prefix}/${entry.name}` : entry.name,
          );
          if (sub === null) return null;
          total += sub;
        } else {
          total += entry.metadata?.size ?? 0;
        }
      }
      if (page.length < LIST_PAGE) return total;
    }
  };
  return walk("");
}

const LIST_PAGE = 1000;
