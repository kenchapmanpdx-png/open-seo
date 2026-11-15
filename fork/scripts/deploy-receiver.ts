// Deploys the AI-traffic drain receiver (ADR-013 §1) and wires the drain.
// Idempotent: every run rotates DRAIN_SECRET and the traffic_ingest password.
//   1. alter role traffic_ingest login password (over SUPABASE_DB_URL)
//   2. Vercel project `openseo-ai-traffic-receiver`: env TRAFFIC_INGEST_DB_URL
//      (transaction pooler, user traffic_ingest) + DRAIN_SECRET, production deploy
//   3. log drain (JSON; static, lambda, edge, external, redirect) for every
//      Vercel project listed in ai_traffic_site → <receiver>/api/drain
//   4. unsigned POST → 403
// Secrets come from .env.local / are generated here; nothing is printed.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import postgres from "postgres";
import { z } from "zod";

const API = "https://api.vercel.com";
const PROJECT = "openseo-ai-traffic-receiver";
const DRAIN_NAME = "openseo-ai-traffic";
const ROOT = "fork/vercel/receiver";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
if (!VERCEL_TOKEN || !SUPABASE_DB_URL)
  throw new Error("VERCEL_TOKEN and SUPABASE_DB_URL are required (.env.local)");

async function vercel<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const body: unknown = res.status === 204 ? {} : await res.json();
  if (!res.ok)
    throw new Error(
      `Vercel ${path.split("?")[0]} → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
    );
  return schema.parse(body);
}

/** Session-pooler URL → transaction-pooler URL for the traffic_ingest role. */
function ingestUrl(password: string): string {
  const url = new URL(SUPABASE_DB_URL ?? "");
  const projectRef = decodeURIComponent(url.username).split(".")[1];
  if (!projectRef)
    throw new Error("SUPABASE_DB_URL user is not postgres.<ref>");
  url.username = `traffic_ingest.${projectRef}`;
  url.password = password;
  url.port = "6543";
  return url.toString();
}

async function rotateRole(password: string): Promise<string[]> {
  const sql = postgres(SUPABASE_DB_URL ?? "", { max: 1 });
  try {
    // Hex only, so the literal needs no escaping (DDL takes no parameters).
    await sql.unsafe(
      `alter role traffic_ingest with login password '${password}'`,
    );
    const rows = await sql<{ vercel_project_id: string }[]>`
      select vercel_project_id from ai_traffic_site`;
    return rows.map((row) => row.vercel_project_id);
  } finally {
    await sql.end();
  }
}

async function teamQuery(): Promise<string> {
  const { teams } = await vercel(
    "/v2/teams",
    z.object({ teams: z.array(z.object({ id: z.string() })) }),
  );
  return teams[0] ? `?teamId=${teams[0].id}` : "";
}

async function ensureProject(team: string): Promise<string> {
  const project = z.object({ id: z.string() });
  try {
    return (await vercel(`/v9/projects/${PROJECT}${team}`, project)).id;
  } catch {
    const created = await vercel(`/v11/projects${team}`, project, {
      method: "POST",
      body: JSON.stringify({ name: PROJECT, framework: null }),
    });
    return created.id;
  }
}

async function setEnv(
  team: string,
  projectId: string,
  key: string,
  value: string,
) {
  const sep = team ? "&" : "?";
  await vercel(
    `/v10/projects/${projectId}/env${team}${sep}upsert=true`,
    z.unknown(),
    {
      method: "POST",
      body: JSON.stringify({
        key,
        value,
        type: "encrypted",
        target: ["production"],
      }),
    },
  );
}

const NOT_DEPLOYED = new Set([
  "src",
  "fixtures",
  "node_modules",
  ".vercel",
  ".gitignore",
]);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (NOT_DEPLOYED.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

async function deploy(team: string): Promise<string> {
  execFileSync("pnpm", ["exec", "tsx", "fork/scripts/build-receiver.ts"], {
    stdio: "inherit",
  });
  const files = listFiles(ROOT).map((path) => ({
    file: relative(ROOT, path),
    data: readFileSync(path, "utf8"),
  }));
  const created = await vercel(
    `/v13/deployments${team}`,
    z.object({ id: z.string() }),
    {
      method: "POST",
      body: JSON.stringify({
        name: PROJECT,
        target: "production",
        files,
        projectSettings: { framework: null },
      }),
    },
  );
  const deployment = z.object({
    readyState: z.string(),
    alias: z.array(z.string()).optional(),
  });
  for (let i = 0; i < 60; i++) {
    const d = await vercel(`/v13/deployments/${created.id}${team}`, deployment);
    if (d.readyState === "ERROR" || d.readyState === "CANCELED")
      throw new Error(`deployment ${created.id} ${d.readyState}`);
    if (d.readyState === "READY" && d.alias?.length) {
      const alias = [...d.alias].sort((a, b) => a.length - b.length)[0];
      return `https://${alias}`;
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(`deployment ${created.id} not ready after 3 min`);
}

async function recreateDrain(
  team: string,
  base: string,
  secret: string,
  projectIds: string[],
) {
  const drains = await vercel(
    `/v1/log-drains${team}`,
    z.array(z.object({ id: z.string(), name: z.string().nullish() })),
  );
  for (const drain of drains.filter((d) => d.name === DRAIN_NAME))
    await vercel(`/v1/log-drains/${drain.id}${team}`, z.unknown(), {
      method: "DELETE",
    });
  if (projectIds.length === 0) {
    console.log(
      "no ai_traffic_site rows: drain not created (add a site, re-run)",
    );
    return;
  }
  await vercel(`/v1/log-drains${team}`, z.object({ id: z.string() }), {
    method: "POST",
    body: JSON.stringify({
      name: DRAIN_NAME,
      deliveryFormat: "json",
      url: `${base}/api/drain`,
      secret,
      sources: ["static", "lambda", "edge", "external", "redirect"],
      projectIds,
    }),
  });
  console.log(`drain ${DRAIN_NAME}: ${projectIds.length} project(s)`);
}

const secret = randomBytes(32).toString("hex");
const password = randomBytes(32).toString("hex");
const projectIds = await rotateRole(password);
const team = await teamQuery();
const projectId = await ensureProject(team);
await setEnv(team, projectId, "TRAFFIC_INGEST_DB_URL", ingestUrl(password));
await setEnv(team, projectId, "DRAIN_SECRET", secret);
const base = await deploy(team);
console.log(`receiver ${base}/api/drain`);
await recreateDrain(team, base, secret, projectIds);
const unsigned = await fetch(`${base}/api/drain`, {
  method: "POST",
  body: "[]",
});
console.log(`unsigned POST → ${unsigned.status}`);
if (unsigned.status !== 403)
  throw new Error("receiver accepted an unsigned POST");
