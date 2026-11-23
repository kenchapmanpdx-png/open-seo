// Read-only SELECT against POSTGRES_DATABASE_URL; prints rows as JSON.
// Never prints the connection string. URL: POSTGRES_DATABASE_URL, else
// SUPABASE_DB_URL, loaded from .env.local when neither is set:
//   pnpm exec tsx fork/scripts/run-query.ts "<select>"
import postgres from "postgres";

const query = process.argv[2];
// Unset → load .env.local into this process (never printed), like handbook-audit.ts.
if (!process.env.POSTGRES_DATABASE_URL && !process.env.SUPABASE_DB_URL)
  process.loadEnvFile(".env.local");
const url = process.env.POSTGRES_DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!query || !url || !/^\s*(select|with)\b/i.test(query)) {
  console.error('usage: tsx fork/scripts/run-query.ts "select …"');
  process.exit(2);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const rows = await sql.begin("read only", (tx) => tx.unsafe(query));
  console.log(JSON.stringify(rows, null, 1));
} finally {
  await sql.end();
}
