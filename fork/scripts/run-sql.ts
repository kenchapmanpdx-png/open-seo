// Apply a SQL file to POSTGRES_DATABASE_URL. Used by run-local.sh after migrations.
// Never prints the connection string.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const file = process.argv[2];
const url = process.env.POSTGRES_DATABASE_URL;
if (!file || !url) {
  console.error(
    "usage: POSTGRES_DATABASE_URL=… tsx fork/scripts/run-sql.ts <file.sql>",
  );
  process.exit(2);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(file, "utf8"));
  console.log(`applied ${file}`);
} finally {
  await sql.end();
}
