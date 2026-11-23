// Read-only SELECT against POSTGRES_DATABASE_URL; prints rows as JSON.
// Never prints the connection string. Load env the way run-local.sh does:
//   bash -c 'set -a; . ./.env.local; set +a; POSTGRES_DATABASE_URL=$SUPABASE_DB_URL pnpm exec tsx fork/scripts/run-query.ts "<select>"'
import postgres from "postgres";

const query = process.argv[2];
const url = process.env.POSTGRES_DATABASE_URL;
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
