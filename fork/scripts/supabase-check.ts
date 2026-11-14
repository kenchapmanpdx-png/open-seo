// Report Supabase hardening state: tables without RLS, and anon/authenticated grants.
// Never prints the connection string.
import postgres from "postgres";

const url = process.env.POSTGRES_DATABASE_URL;
if (!url) throw new Error("POSTGRES_DATABASE_URL not set");
const sql = postgres(url, { max: 1 });
try {
  const [tables] =
    await sql`select count(*)::int as n from pg_tables where schemaname = 'public'`;
  const noRls = await sql`
    select n.nspname || '.' || c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p') and n.nspname in ('public','drizzle') and not c.relrowsecurity`;
  const grants = await sql`
    select count(*)::int as n from information_schema.role_table_grants
    where table_schema in ('public','drizzle') and grantee in ('anon','authenticated')`;
  console.log(`public tables: ${tables.n}`);
  console.log(
    `tables without RLS: ${noRls.length}${noRls.length ? " → " + noRls.map((r) => r.t).join(", ") : ""}`,
  );
  console.log(`anon/authenticated table grants: ${grants[0].n}`);
} finally {
  await sql.end();
}
