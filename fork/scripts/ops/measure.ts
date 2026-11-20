// `run-local.sh ops measure <label> <minutes>` (fork/DEPENDABILITY.md WO-B13-001).
// Every 10 s appends to fork/runs/_ops/measure-<label>.csv:
//   time, sockets (established TCP to :5432 / :6543), serverConns
//   (pg_stat_activity rows for current_user, own session excluded; one
//   persistent session-pooler connection for the whole run), workerd RSS MB.
// Prints min / peak / last per column at the end. Never prints the URL.
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

const [label, minutesArg] = process.argv.slice(2);
const minutes = Number(minutesArg);
if (!label || !/^[\w-]+$/.test(label) || !(minutes > 0)) {
  console.error("usage: measure.ts <label> <minutes>");
  process.exit(2);
}
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL not set (run through run-local.sh ops)");
  process.exit(1);
}

const out = `fork/runs/_ops/measure-${label}.csv`;
mkdirSync("fork/runs/_ops", { recursive: true });
appendFileSync(out, "time,sockets,serverConns,workerdRssMb\n");

function sockets(): number {
  try {
    const text = execFileSync(
      "ss",
      ["-Htn", "state", "established", "( dport = :5432 or dport = :6543 )"],
      { encoding: "utf8" },
    );
    return text.split("\n").filter((l) => l.trim()).length;
  } catch {
    return -1;
  }
}

function workerdRssMb(): number {
  let kb = 0;
  for (const pid of readdirSync("/proc").filter((p) => /^\d+$/.test(p))) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8");
      if (!cmd.includes("workerd")) continue;
      const status = readFileSync(`/proc/${pid}/status`, "utf8");
      const m = /VmRSS:\s+(\d+)/.exec(status);
      if (m) kb += Number(m[1]);
    } catch {
      // process exited between readdir and read
    }
  }
  return Math.round(kb / 1024);
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });

async function serverConns(): Promise<number> {
  try {
    const rows = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_stat_activity
      where usename = current_user and pid <> pg_backend_pid()`;
    return rows[0]?.n ?? -1;
  } catch {
    return -1;
  }
}

type Row = { sockets: number; serverConns: number; workerdRssMb: number };
const rows: Row[] = [];
const end = Date.now() + minutes * 60_000;
while (Date.now() < end) {
  const row: Row = {
    sockets: sockets(),
    serverConns: await serverConns(),
    workerdRssMb: workerdRssMb(),
  };
  rows.push(row);
  appendFileSync(
    out,
    `${new Date().toISOString()},${row.sockets},${row.serverConns},${row.workerdRssMb}\n`,
  );
  await new Promise((r) => setTimeout(r, 10_000));
}
await sql.end({ timeout: 5 });

for (const key of ["sockets", "serverConns", "workerdRssMb"] as const) {
  const values = rows.map((r) => r[key]).filter((v) => v >= 0);
  if (values.length === 0) {
    console.log(`${key}: no data`);
    continue;
  }
  console.log(
    `${key}: min ${Math.min(...values)} peak ${Math.max(...values)} last ${values.at(-1)}`,
  );
}
console.log(`samples ${rows.length} → ${out}`);
