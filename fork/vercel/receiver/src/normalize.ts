import {
  DRAIN_REQUEST_SOURCES,
  vercelDrainEntrySchema,
  type TrafficEvent,
} from "../../../../src/server/features/ai-traffic/contracts";
import type { z } from "zod";

// Vercel drain payload → K9 TrafficEvent (ADR-013 §1 steps 3–4). Field
// mapping follows Canonry integration-vercel/src/normalize.ts (MIT, © 2026
// Arber X and contributors), rewritten for the drain shape: the request lives
// in `proxy`, whose `path` carries the query string and `userAgent` is an array
// (Vercel docs, Drains › Logs reference, updated 2026-09-11).

export type VercelDrainEntry = z.infer<typeof vercelDrainEntrySchema>;

const REQUEST_SOURCES: ReadonlySet<string> = new Set(DRAIN_REQUEST_SOURCES);

/** JSON array or NDJSON (chosen per drain). Invalid entries are skipped. */
export function parseDrainBody(raw: string): VercelDrainEntry[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  let values: unknown[];
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    values = Array.isArray(parsed) ? parsed : [];
  } else {
    values = trimmed
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line): unknown => JSON.parse(line));
  }
  return values.flatMap((value) => {
    const parsed = vercelDrainEntrySchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

function emptyToNull(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Null for build / firewall / console lines and entries without a request. */
export function normalizeVercelDrainEntry(
  entry: VercelDrainEntry,
): TrafficEvent | null {
  const proxy = entry.proxy;
  if (!proxy || !REQUEST_SOURCES.has(entry.source)) return null;
  const rawPath = emptyToNull(proxy.path);
  if (!rawPath) return null;
  const queryAt = rawPath.indexOf("?");
  const path = queryAt === -1 ? rawPath : rawPath.slice(0, queryAt) || "/";
  const queryString =
    queryAt === -1 ? null : emptyToNull(rawPath.slice(queryAt + 1));
  return {
    eventId: entry.id,
    observedAt: new Date(proxy.timestamp ?? entry.timestamp).toISOString(),
    method: emptyToNull(proxy.method),
    host: emptyToNull(proxy.host) ?? emptyToNull(entry.host),
    path,
    queryString,
    status: proxy.statusCode ?? null,
    userAgent: emptyToNull(proxy.userAgent?.[0]),
    remoteIp: emptyToNull(proxy.clientIp),
    referer: emptyToNull(proxy.referer),
    sourceType: "vercel-drain",
  };
}
