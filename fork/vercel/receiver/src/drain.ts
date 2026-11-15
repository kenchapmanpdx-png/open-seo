import { createHmac, timingSafeEqual } from "node:crypto";
import { createDrainDb, type DiscardRow, type DrainDb } from "./db";
import { normalizeVercelDrainEntry, parseDrainBody } from "./normalize";
import { isAiCandidate } from "./prefilter";
import type { TrafficEvent } from "../../../../src/server/features/ai-traffic/contracts";

// Vercel log drain → Supabase (ADR-013 §1). Filters and stores evidence only;
// classification runs in the app so rules can change and re-run.

const MAX_BODY_BYTES = 4 * 1024 * 1024;

type DrainConfig = { secret: string; verifyToken?: string; db: DrainDb };

function signatureMatches(
  body: Buffer,
  signature: string | null,
  secret: string,
) {
  if (!signature) return false;
  const expected = Buffer.from(
    createHmac("sha1", secret).update(body).digest("hex"),
  );
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function hourOf(entryTimestamp: number) {
  return new Date(entryTimestamp).toISOString().slice(0, 13);
}

export async function handleDrain(
  request: Request,
  config: DrainConfig,
): Promise<Response> {
  const headers = config.verifyToken
    ? { "x-vercel-verify": config.verifyToken }
    : undefined;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  if (
    !signatureMatches(
      body,
      request.headers.get("x-vercel-signature"),
      config.secret,
    )
  )
    return new Response(null, { status: 403, headers });

  let entries;
  try {
    entries = parseDrainBody(body.toString("utf8"));
  } catch {
    return new Response(null, { status: 400, headers });
  }

  type Batch = { kept: TrafficEvent[]; discards: Map<string, number> };
  const byProject = new Map<string, Batch>();
  for (const entry of entries) {
    const event = normalizeVercelDrainEntry(entry);
    if (!event) continue; // build / firewall / console lines
    let batch = byProject.get(entry.projectId);
    if (!batch) {
      batch = { kept: [], discards: new Map() };
      byProject.set(entry.projectId, batch);
    }
    if (isAiCandidate(event)) batch.kept.push(event);
    else {
      const hour = hourOf(entry.timestamp);
      batch.discards.set(hour, (batch.discards.get(hour) ?? 0) + 1);
    }
  }

  const discards: DiscardRow[] = [];
  for (const [vercelProjectId, batch] of byProject) {
    const site = await config.db.findSite(vercelProjectId);
    const allowed = site?.hosts.length
      ? new Set(site.hosts.map((host) => host.toLowerCase()))
      : null;
    const kept: TrafficEvent[] = [];
    for (const event of batch.kept) {
      if (site && (!allowed || allowed.has((event.host ?? "").toLowerCase())))
        kept.push(event);
      else {
        const hour = event.observedAt.slice(0, 13);
        batch.discards.set(hour, (batch.discards.get(hour) ?? 0) + 1);
      }
    }
    if (site) await config.db.insertEvents(site.id, kept);
    for (const [hour, count] of batch.discards)
      discards.push({ vercelProjectId, hour, siteId: site?.id ?? null, count });
  }
  await config.db.addDiscards(discards);
  return new Response(null, { status: 200, headers });
}

let db: DrainDb | null = null;

/** Vercel Node runtime entry (web handler). */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.DRAIN_SECRET;
  const url = process.env.TRAFFIC_INGEST_DB_URL;
  if (!secret || !url) return new Response(null, { status: 503 });
  db ??= createDrainDb(url);
  return handleDrain(request, {
    secret,
    verifyToken: process.env.DRAIN_VERIFY_TOKEN,
    db,
  });
}
