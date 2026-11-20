// `run-local.sh ops e2e-read <auditId> [--json]` (fork/DEPENDABILITY.md
// WO-B13-002). Read-only database truth for the in-app E2E harness
// (`inapp-audit.mjs`): the audit row, its 403/429 share, the Handbook run
// linked to it (`handbook_run.audit_id`), stage rows, findings count and LLM
// cost. `ops e2e-read --projects [--json]` lists live projects with their
// Handbook settings (test-project lookup). One connection, closed at the end.
// Never prints the connection string.
import postgres from "postgres";

const args = process.argv.slice(2);
const json = args.includes("--json");
const positional = args.filter((a) => !a.startsWith("--"));
const listProjects = args.includes("--projects");
const auditId = positional[0];
if (!listProjects && (!auditId || !/^[\w-]+$/.test(auditId))) {
  console.error("usage: e2e-read.ts <auditId> [--json] | --projects [--json]");
  process.exit(2);
}
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL not set (run through run-local.sh ops)");
  process.exit(1);
}

type StageStatus = "pending" | "running" | "done" | "failed" | "skipped";
// Several batches of one stage collapse to the most telling status.
const STAGE_RANK: StageStatus[] = [
  "failed",
  "running",
  "pending",
  "done",
  "skipped",
];

const num = (v: unknown) => (v == null ? null : Number(v));

function maxPagesOf(config: string | null): number | null {
  try {
    const parsed: unknown = JSON.parse(config ?? "{}");
    if (parsed && typeof parsed === "object" && "maxPages" in parsed) {
      return num(parsed.maxPages);
    }
  } catch {
    // malformed config → unknown
  }
  return null;
}

const sql = postgres(url, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  onnotice: () => {},
});

async function readProjects() {
  return sql<
    {
      id: string;
      name: string;
      domain: string | null;
      handbookEnabled: boolean | null;
      copyQuality: boolean | null;
      serpOriginality: boolean | null;
    }[]
  >`
    select p.id, p.name, p.domain,
      s.enabled as "handbookEnabled", s.copy_quality as "copyQuality",
      s.serp_originality as "serpOriginality"
    from projects p
    left join handbook_project_setting s on s.project_id = p.id
    where p.archived_at is null
    order by p.created_at`;
}

async function readAudit(id: string) {
  const [audit] = await sql<
    {
      id: string;
      projectId: string;
      status: string;
      pagesCrawled: number;
      config: string | null;
      errorCode: string | null;
      errorDetail: string | null;
      failedPhase: string | null;
      completedAt: string | null;
    }[]
  >`
    select id, project_id as "projectId", status,
      pages_crawled as "pagesCrawled", config,
      error_code as "errorCode", error_detail as "errorDetail",
      failed_phase as "failedPhase", completed_at::text as "completedAt"
    from audits where id = ${id}`;
  if (!audit) return null;
  const [pages] = await sql<{ total: number; blocked: number }[]>`
    select count(*)::int as total,
      count(*) filter (where status_code in (403, 429))::int as blocked
    from audit_pages where audit_id = ${id}`;
  const [run] = await sql<
    {
      id: string;
      status: string;
      errorCode: string | null;
      grade: string | null;
      scoreFinal: number | null;
      coverageRead: number | null;
      coverageCapped: boolean;
      llmCostUsdRun: number;
      startedAt: string;
      finishedAt: string | null;
    }[]
  >`
    select id, status, error_code as "errorCode", grade,
      score_final as "scoreFinal", coverage_read as "coverageRead",
      coverage_capped as "coverageCapped", llm_cost_usd as "llmCostUsdRun",
      started_at as "startedAt", finished_at as "finishedAt"
    from handbook_run where audit_id = ${id}
    order by started_at desc limit 1`;
  let handbook = null;
  if (run) {
    const stageRows = await sql<
      {
        stage: string;
        batch: number;
        status: StageStatus;
        error: string | null;
      }[]
    >`
      select stage, batch, status, error from handbook_run_stage
      where run_id = ${run.id} order by stage, batch`;
    const stages: Record<string, StageStatus> = {};
    const stageErrors: Record<string, string> = {};
    for (const row of stageRows) {
      const prev = stages[row.stage];
      if (!prev || STAGE_RANK.indexOf(row.status) < STAGE_RANK.indexOf(prev)) {
        stages[row.stage] = row.status;
      }
      if (row.error && !stageErrors[row.stage]) {
        stageErrors[row.stage] = row.error.slice(0, 300);
      }
    }
    const [counts] = await sql<{ findings: number; llm: number }[]>`
      select
        (select count(*)::int from handbook_finding where run_id = ${run.id}) as findings,
        (select coalesce(sum(cost_usd), 0)::float8 from handbook_llm_call
          where run_id = ${run.id}) as llm`;
    handbook = {
      runId: run.id,
      status: run.status,
      errorCode: run.errorCode,
      grade: run.grade,
      scoreFinal: num(run.scoreFinal),
      findingsDb: counts?.findings ?? 0,
      coverageRead: num(run.coverageRead),
      coverageCapped: run.coverageCapped,
      stages,
      stageErrors,
      llmCostUsd: Number(counts?.llm ?? 0),
      llmCostUsdRun: Number(run.llmCostUsdRun),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
    };
  }
  return {
    audit: {
      id: audit.id,
      projectId: audit.projectId,
      status: audit.status,
      pagesCrawled: audit.pagesCrawled,
      maxPages: maxPagesOf(audit.config),
      errorCode: audit.errorCode,
      errorDetail: audit.errorDetail?.slice(0, 500) ?? null,
      failedPhase: audit.failedPhase,
      completedAt: audit.completedAt,
      pagesStored: pages?.total ?? 0,
      share403or429: pages?.total ? pages.blocked / pages.total : 0,
    },
    handbook,
  };
}

let exitCode = 0;
try {
  if (listProjects) {
    const rows = await readProjects();
    if (json) console.log(JSON.stringify({ projects: rows }));
    else
      for (const p of rows)
        console.log(
          `${p.id}  ${p.name}  domain=${p.domain ?? "-"} handbook=${p.handbookEnabled ?? "-"} copyQuality=${p.copyQuality ?? "-"} serpOriginality=${p.serpOriginality ?? "-"}`,
        );
  } else {
    const result = await readAudit(auditId);
    if (!result) {
      if (json) console.log(JSON.stringify({ error: "audit not found" }));
      else console.log(`audit ${auditId} not found`);
      exitCode = 1;
    } else if (json) {
      console.log(JSON.stringify(result));
    } else {
      const { audit, handbook } = result;
      console.log(
        `audit ${audit.id} ${audit.status} pages=${audit.pagesCrawled}/${audit.maxPages ?? "?"} completedAt=${audit.completedAt ?? "-"} share403or429=${audit.share403or429.toFixed(3)}${audit.errorCode ? ` error=${audit.errorCode} phase=${audit.failedPhase ?? "-"}` : ""}`,
      );
      if (!handbook) console.log("handbook: no run linked to this audit");
      else {
        console.log(
          `handbook ${handbook.runId} ${handbook.status} grade=${handbook.grade ?? "-"} score=${handbook.scoreFinal ?? "-"} findings=${handbook.findingsDb} llm=$${handbook.llmCostUsd.toFixed(4)} coverageRead=${handbook.coverageRead ?? "-"} capped=${handbook.coverageCapped} finishedAt=${handbook.finishedAt ?? "-"}`,
        );
        for (const [stage, status] of Object.entries(handbook.stages))
          console.log(
            `  stage ${stage}=${status}${handbook.stageErrors[stage] ? ` (${handbook.stageErrors[stage]})` : ""}`,
          );
      }
    }
  }
} catch (error) {
  // postgres errors can quote the host; print the class and code only.
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  console.error(
    `e2e-read failed: ${error instanceof Error ? error.name : "error"} ${code}`,
  );
  exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
process.exit(exitCode);
