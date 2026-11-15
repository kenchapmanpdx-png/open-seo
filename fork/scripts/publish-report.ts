/**
 * Publishes a handbook client report as a static snapshot on Vercel
 * (ADR-011 "Client report publishing", WO-B4-012).
 *
 *   pnpm exec tsx fork/scripts/publish-report.ts <report.json>
 *   pnpm exec tsx fork/scripts/publish-report.ts --unpublish <slug>
 *
 * Writes fork/vercel/reports/r/<slug>/index.html (slug: 32-char base64url,
 * unguessable), deploys the whole fork/vercel/reports directory to the
 * `openseo-reports` Vercel project (production), then checks the live URL
 * sends `x-robots-tag: noindex` and the root is a 404. VERCEL_TOKEN comes
 * from the environment or .env.local and is never printed. Published
 * snapshots are not committed (r/ is gitignored), so every deploy ships the
 * snapshots on this machine; published.json maps slug → run id + dates.
 */
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { reportJsonSchema } from "@/server/features/handbook/contracts/exports";
import { renderClientReportHtml } from "@/server/features/handbook/export/client-report";
import { REGISTRY } from "@/server/features/handbook/registry";

const ROOT = "fork/vercel/reports";
const PROJECT = "openseo-reports";
const API = "https://api.vercel.com";
/** Local bookkeeping, never deployed. */
const NOT_DEPLOYED = new Set([".gitignore", "published.json", ".vercel"]);

const publishedSchema = z.record(
  z.string(),
  z.object({
    runId: z.string(),
    origin: z.string(),
    publishedAt: z.string(),
    unpublishedAt: z.string().optional(),
  }),
);
const publishedPath = join(ROOT, "published.json");
const readPublished = () =>
  publishedSchema.parse(JSON.parse(readFileSync(publishedPath, "utf8")));
const writePublished = (data: z.infer<typeof publishedSchema>) =>
  writeFileSync(publishedPath, `${JSON.stringify(data, null, 2)}\n`);

function token(): string {
  if (!process.env.VERCEL_TOKEN && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  const value = process.env.VERCEL_TOKEN;
  if (!value) throw new Error("VERCEL_TOKEN missing (environment/.env.local)");
  return value;
}

async function vercel<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
  });
  const body: unknown = await res.json();
  if (!res.ok)
    throw new Error(
      `Vercel ${path.split("?")[0]} → ${res.status}: ${JSON.stringify(body).slice(0, 300)}`,
    );
  return schema.parse(body);
}

/** Screenshots from the CLI run beside report.json: page URL → data URI. */
function screenshots(reportPath: string): Map<string, string> {
  const dir = dirname(reportPath);
  const collectedPath = join(dir, "collected.json");
  const shots = new Map<string, string>();
  if (!existsSync(collectedPath)) return shots;
  const collected = z
    .object({
      render: z
        .array(
          z.object({
            url: z.string(),
            firstScreenKey: z.string().nullish(),
          }),
        )
        .nullish(),
    })
    .parse(JSON.parse(readFileSync(collectedPath, "utf8")));
  for (const page of collected.render ?? []) {
    const file = page.firstScreenKey
      ? join(dir, "evidence", `${page.firstScreenKey}.gz`)
      : null;
    if (!file || !existsSync(file)) continue;
    const bytes = gunzipSync(readFileSync(file));
    const png = bytes.subarray(0, 4).toString("hex") === "89504e47";
    shots.set(
      page.url,
      `data:image/${png ? "png" : "jpeg"};base64,${bytes.toString("base64")}`,
    );
  }
  return shots;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (NOT_DEPLOYED.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

async function teamQuery(): Promise<string> {
  const { teams } = await vercel(
    "/v2/teams",
    z.object({ teams: z.array(z.object({ id: z.string() })) }),
  );
  return teams[0] ? `?teamId=${teams[0].id}` : "";
}

/** Deploys ROOT to production; returns the public base URL. */
async function deploy(): Promise<string> {
  const team = await teamQuery();
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
    url: z.string(),
  });
  for (let i = 0; i < 60; i++) {
    const d = await vercel(`/v13/deployments/${created.id}${team}`, deployment);
    if (d.readyState === "ERROR" || d.readyState === "CANCELED")
      throw new Error(`deployment ${created.id} ${d.readyState}`);
    if (d.readyState === "READY" && d.alias?.length) {
      if (process.env.REPORTS_DOMAIN)
        return `https://${process.env.REPORTS_DOMAIN}`;
      // The project alias (shortest) is public; deployment URLs may sit
      // behind Vercel deployment protection.
      const alias = [...d.alias].sort((a, b) => a.length - b.length)[0];
      return `https://${alias}`;
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(`deployment ${created.id} not ready after 3 min`);
}

async function verify(base: string, path: string) {
  const page = await fetch(`${base}${path}`, { method: "HEAD" });
  const robots = page.headers.get("x-robots-tag");
  const root = await fetch(`${base}/`, { method: "HEAD" });
  console.log(`page ${page.status} · x-robots-tag: ${robots ?? "(none)"}`);
  console.log(`root ${root.status}`);
  if (
    page.status !== 200 ||
    !robots?.includes("noindex") ||
    root.status !== 404
  )
    throw new Error("live check failed");
}

async function publish(reportPath: string) {
  const report = reportJsonSchema.parse(
    JSON.parse(readFileSync(reportPath, "utf8")),
  );
  const html = renderClientReportHtml(report, REGISTRY, {
    screenshots: screenshots(reportPath),
  });
  const slug = randomBytes(24).toString("base64url");
  mkdirSync(join(ROOT, "r", slug), { recursive: true });
  writeFileSync(join(ROOT, "r", slug, "index.html"), html);
  const base = await deploy();
  writePublished({
    ...readPublished(),
    [slug]: {
      runId: report.run.id,
      origin: report.site.origin,
      publishedAt: new Date().toISOString(),
    },
  });
  console.log(`${base}/r/${slug}/ (${Math.round(html.length / 1000)} KB)`);
  await verify(base, `/r/${slug}/`);
}

async function unpublish(slug: string) {
  const published = readPublished();
  const entry = published[slug];
  if (!entry) throw new Error(`unknown slug ${slug}`);
  rmSync(join(ROOT, "r", slug), { recursive: true, force: true });
  const base = await deploy();
  writePublished({
    ...published,
    [slug]: { ...entry, unpublishedAt: new Date().toISOString() },
  });
  const res = await fetch(`${base}/r/${slug}/`, { method: "HEAD" });
  console.log(`unpublished ${slug}: ${res.status}`);
}

const [arg, value] = process.argv.slice(2);
if (arg === "--unpublish" && value) await unpublish(value);
else if (arg && !arg.startsWith("--")) await publish(arg);
else {
  console.error("usage: publish-report.ts <report.json> | --unpublish <slug>");
  process.exit(2);
}
