import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseEvidenceStore } from "./supabase-evidence-store";

// Minimal Storage REST stand-in: keeps uploaded bytes and content type by URL.
const objects = new Map<string, { bytes: Uint8Array; type: string }>();

beforeEach(() => {
  objects.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        objects.set(url, {
          bytes: new Uint8Array(await new Response(init.body).arrayBuffer()),
          type: new Headers(init.headers).get("content-type") ?? "",
        });
        return new Response("{}");
      }
      const o = objects.get(url);
      return o
        ? new Response(new Uint8Array(o.bytes), {
            headers: { "content-type": o.type },
          })
        : new Response(null, { status: 404 });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const store = createSupabaseEvidenceStore({
  url: "https://x.supabase.co",
  serviceRoleKey: "k",
});

describe("supabase evidence store gzip", () => {
  it("stores bodies gzip'd and reads back the original bytes", async () => {
    const html = new TextEncoder().encode("<html>" + "a".repeat(5000));
    const stored = await store.put("p/r/html/x.html", html, "text/html");
    expect(stored.byteSize).toBe(html.byteLength);

    const [uploaded] = [...objects.values()];
    expect(uploaded.bytes.slice(0, 2)).toEqual(new Uint8Array([0x1f, 0x8b]));
    expect(uploaded.bytes.byteLength).toBeLessThan(html.byteLength);

    expect(await store.get("p/r/html/x.html")).toEqual(html);
  });

  it("leaves already-gzip'd stage blobs untouched", async () => {
    const blob = new Uint8Array([0x1f, 0x8b, 1, 2, 3]);
    await store.put("p/r/stages/map-0.json.gz", blob, "application/gzip");
    expect(await store.get("p/r/stages/map-0.json.gz")).toEqual(blob);
  });
});

describe("supabase evidence store transient errors (WO-B20-008)", () => {
  const answers = (statuses: number[]) => {
    const fetchMock = vi.fn(async () => {
      const status = statuses.shift() ?? 200;
      return new Response(status === 200 ? "{}" : "error", { status });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  const body = new TextEncoder().encode("lighthouse json");

  it("keeps the upload when Storage answers 520 then 200", async () => {
    const fetchMock = answers([520, 200]);
    await expect(
      store.put("p/r/lighthouse/x.json", body, "application/json"),
    ).resolves.toMatchObject({ key: "p/r/lighthouse/x.json" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still fails after three transient answers", async () => {
    answers([520, 503, 429]);
    await expect(
      store.put("p/r/lighthouse/x.json", body, "application/json"),
    ).rejects.toThrow("evidence upload failed: HTTP 429");
  });
});
