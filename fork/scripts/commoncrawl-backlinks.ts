// Common Crawl domain-graph backlink baseline (ADR-016 §1, WO-B6-041).
//   pnpm exec tsx fork/scripts/commoncrawl-backlinks.ts [--release <id>] [--target <domain>] [--force]
// Probes the newest hyperlink-graph release (or uses --release), downloads the
// domain vertices + edges (~9 GB gz, resumable per file, cached under
// CC_CACHE_DIR, latest two releases kept), runs ONE DuckDB query for every
// target and writes cc_* rows to Supabase Postgres (SUPABASE_DB_URL from
// .env.local), one transaction per target.
// Targets: enabled cc_target rows. Each project's own domain (eTLD+1) is
// enrolled on first run; its project_competitors become targets too, so the
// card can show the competitor gap. --target <domain> limits the run to the
// projects whose domain is <domain> (and enrolls them). Without --target an
// already-imported release is skipped unless --force. Nothing secret is printed.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { getDomain } from "tldts";
import {
  compareReleaseIds,
  formatReleaseWindow,
  isValidReleaseId,
} from "../../src/server/features/backlinks/providers/commoncrawl/release";
import { pruneOldReleases, releaseCacheDir } from "./lib/commoncrawl/cache";
import { downloadFile } from "./lib/commoncrawl/download";
import { queryBacklinks } from "./lib/commoncrawl/query";
import {
  probeLatestRelease,
  probeRelease,
} from "./lib/commoncrawl/release-discovery";

const LIMIT_PER_TARGET = 5000;
const KEEP_DOMAIN_RELEASES = 4;

const { values } = parseArgs({
  options: {
    release: { type: "string" },
    target: { type: "string" },
    force: { type: "boolean", default: false },
  },
});
if (values.release && !isValidReleaseId(values.release)) {
  console.error(`invalid release id: ${values.release}`);
  process.exit(2);
}
const onlyDomain = values.target ? registrable(values.target) : null;
if (values.target && !onlyDomain) {
  console.error(`not a registrable domain: ${values.target}`);
  process.exit(2);
}

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.POSTGRES_DATABASE_URL;
if (!dbUrl)
  throw new Error("SUPABASE_DB_URL (or POSTGRES_DATABASE_URL) is required");
const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
const started = Date.now();
const log = (msg: string) =>
  console.log(`[cc ${((Date.now() - started) / 1000).toFixed(0)}s] ${msg}`);

function registrable(input: string): string | null {
  return getDomain(input.trim().toLowerCase()) ?? null;
}

interface Target {
  id: string;
  domain: string;
}

/**
 * Enroll own domains (disabled until turned on in the app; --target enables
 * them) and competitor domains of enabled projects, then return the targets.
 */
async function enrollAndSelectTargets(): Promise<Target[]> {
  const projects = await sql<
    { id: string; organization_id: string; domain: string | null }[]
  >`select id, organization_id, domain from projects where domain is not null`;
  const own = projects
    .map((p) => ({ ...p, regDomain: registrable(p.domain ?? "") }))
    .filter(
      (p): p is typeof p & { regDomain: string } =>
        !!p.regDomain && (!onlyDomain || p.regDomain === onlyDomain),
    );

  for (const p of own) {
    await sql`
      insert into cc_target (id, project_id, organization_id, domain, enabled)
      values (${randomUUID()}, ${p.id}, ${p.organization_id}, ${p.regDomain}, ${!!onlyDomain})
      on conflict (project_id, domain) do update
        set enabled = cc_target.enabled or excluded.enabled`;
  }

  // A project is in scope when its own-domain target is enabled.
  const rows = await sql<{ project_id: string; domain: string }[]>`
    select project_id, domain from cc_target where enabled`;
  const enabledProjects = own.filter((p) =>
    rows.some((r) => r.project_id === p.id && r.domain === p.regDomain),
  );

  // Their competitors become targets of the same project.
  for (const p of enabledProjects) {
    const competitors = await sql<{ domain: string }[]>`
      select domain from project_competitors where project_id = ${p.id}`;
    for (const c of competitors) {
      const domain = registrable(c.domain);
      if (!domain || domain === p.regDomain) continue;
      await sql`
        insert into cc_target (id, project_id, organization_id, domain, enabled)
        values (${randomUUID()}, ${p.id}, ${p.organization_id}, ${domain}, true)
        on conflict (project_id, domain) do nothing`;
    }
  }
  if (enabledProjects.length === 0) return [];
  return sql<Target[]>`
    select id, domain from cc_target
    where enabled and project_id in ${sql(enabledProjects.map((p) => p.id))}`;
}

async function importTarget(
  target: Target,
  release: string,
  rows: { linkingDomain: string; numHosts: number }[],
) {
  await sql.begin(async (tx) => {
    const [summary] = await tx<{ id: string }[]>`
      insert into cc_backlink_summary (id, target_id, release_id, referring_domains, referring_hosts_sum)
      values (${randomUUID()}, ${target.id}, ${release}, ${rows.length},
              ${rows.reduce((sum, r) => sum + r.numHosts, 0)})
      on conflict (target_id, release_id) do update
        set referring_domains = excluded.referring_domains,
            referring_hosts_sum = excluded.referring_hosts_sum,
            imported_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      returning id`;
    await tx`delete from cc_backlink_domain where summary_id = ${summary.id}`;
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000).map((r) => ({
        id: randomUUID(),
        summary_id: summary.id,
        linking_domain: r.linkingDomain,
        num_hosts: r.numHosts,
      }));
      await tx`insert into cc_backlink_domain ${tx(chunk)}`;
    }
    // Retention: domain rows for the newest 4 releases; summaries kept.
    const summaries = await tx<{ id: string; release_id: string }[]>`
      select id, release_id from cc_backlink_summary where target_id = ${target.id}`;
    const stale = summaries
      .sort((a, b) => compareReleaseIds(b.release_id, a.release_id))
      .slice(KEEP_DOMAIN_RELEASES)
      .map((s) => s.id);
    if (stale.length > 0) {
      await tx`delete from cc_backlink_domain where summary_id in ${tx(stale)}`;
    }
  });
}

try {
  const probed = values.release
    ? await probeRelease(values.release)
    : await probeLatestRelease();
  if (!probed) {
    throw new Error(
      values.release
        ? `release ${values.release} not published (HEAD 404)`
        : "no Common Crawl release found in the last 15 months",
    );
  }
  const release = probed.release;
  log(`release ${release} (${formatReleaseWindow(release)})`);

  const [existing] = await sql<{ status: string }[]>`
    select status from cc_release where id = ${release}`;
  if (existing?.status === "imported" && !onlyDomain && !values.force) {
    log("already imported; --force to re-import");
    process.exit(0);
  }

  const targets = await enrollAndSelectTargets();
  if (targets.length === 0) {
    log("no enabled cc_target rows; nothing to do");
    process.exit(0);
  }
  log(`targets: ${targets.map((t) => t.domain).join(", ")}`);

  await sql`
    insert into cc_release (id, window_label, status, bytes)
    values (${release}, ${formatReleaseWindow(release) ?? release}, 'downloading',
            ${(probed.vertexBytes ?? 0) + (probed.edgesBytes ?? 0)})
    on conflict (id) do update set status = 'downloading'`;

  try {
    const dir = releaseCacheDir(release);
    const download = async (url: string) => {
      let lastPct = -1;
      const result = await downloadFile({
        url,
        destPath: path.join(dir, path.basename(url)),
        onProgress: (bytes, total) => {
          const pct = total ? Math.floor((bytes / total) * 100) : -1;
          if (pct !== lastPct && pct % 10 === 0) {
            lastPct = pct;
            log(`${path.basename(url)} ${pct}%`);
          }
        },
      });
      log(
        `${path.basename(url)}: ${(result.bytes / 1e9).toFixed(2)} GB${result.cached ? " (cached)" : ""}`,
      );
      return path.join(dir, path.basename(url));
    };
    const vertexPath = await download(probed.vertexUrl);
    const edgesPath = await download(probed.edgesUrl);
    const pruned = pruneOldReleases(2);
    if (pruned.length > 0) log(`pruned cache: ${pruned.join(", ")}`);

    const rows = await queryBacklinks({
      vertexPath,
      edgesPath,
      targets: [...new Set(targets.map((t) => t.domain))],
      limitPerTarget: LIMIT_PER_TARGET,
    });
    log(`query: ${rows.length} rows`);

    const summary: Record<string, number> = {};
    for (const target of targets) {
      const mine = rows.filter((r) => r.targetDomain === target.domain);
      await importTarget(target, release, mine);
      summary[target.domain] = mine.length;
    }
    await sql`
      update cc_release
      set status = 'imported',
          imported_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      where id = ${release}`;
    log(`imported: ${JSON.stringify(summary)}`);
  } catch (error) {
    await sql`update cc_release set status = 'failed' where id = ${release}`;
    throw error;
  }
} finally {
  await sql.end();
}
