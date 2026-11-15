// Data-integrity check (B5 R1 step 4): every stored handbook finding has
// ≥1 evidence row with a URL and an excerpt or storage key. Read-only.
// Never prints the connection string. Run through run-local.sh's env:
//   set -a; . ./.env.local; set +a; POSTGRES_DATABASE_URL=$SUPABASE_DB_URL \
//     pnpm exec tsx fork/scripts/evidence-check.ts
import postgres from "postgres";

const url = process.env.POSTGRES_DATABASE_URL;
if (!url) throw new Error("POSTGRES_DATABASE_URL not set");
const sql = postgres(url, { max: 1 });
try {
  const [runs] =
    await sql`select count(*)::int as n from handbook_run where finished_at is not null`;
  const [findings] = await sql`select count(*)::int as n from handbook_finding`;
  const bare = await sql`
    select f.run_id, f.code from handbook_finding f
    where not exists (
      select 1 from handbook_evidence e
      where e.finding_id = f.id and e.url <> ''
        and (e.excerpt <> '' or e.storage_key is not null))`;
  console.log(`finished runs: ${runs.n} · findings: ${findings.n}`);
  console.log(
    `findings without usable evidence: ${bare.length}${
      bare.length
        ? " → " +
          bare
            .map((r) => `${r.run_id}/${r.code}`)
            .slice(0, 20)
            .join(", ")
        : ""
    }`,
  );
  if (bare.length) process.exitCode = 1;
} finally {
  await sql.end();
}
