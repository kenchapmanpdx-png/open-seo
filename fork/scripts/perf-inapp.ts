/**
 * In-app memory probe (WO-B9-026). Serves the perf-500 synthetic site on
 * 0.0.0.0 and checks whether the app's SSRF start-URL policy
 * (`normalizeAndValidateStartUrl`, the same check the in-app audit runs)
 * accepts any local address for it. It does not: loopback, RFC 1918, CGNAT
 * and link-local addresses are blocked in every AUTH_MODE, local_noauth
 * included, and `*.nip.io` names resolve to those addresses. That is correct
 * behavior, so the in-app 200 / 500-page measurement needs a public tunnel
 * to this server (Ken's OK) → BLOCKED-KEN.
 *
 * With `--origin <public tunnel URL>` (tunnel → `--port`), the script keeps
 * the site up and samples workerd RSS (/proc/<pid>/status VmRSS, every
 * workerd process summed) once a second for `--minutes`, while Ken starts
 * the in-app audit of that origin with max pages 200 or 500. Prints idle,
 * peak and final RSS.
 *
 *   pnpm exec tsx fork/scripts/perf-inapp.ts [--pages 500]
 *   pnpm exec tsx fork/scripts/perf-inapp.ts --pages 500 --port 8790 --origin https://<tunnel> --minutes 30
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { parseArgs } from "node:util";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { startSyntheticSite } from "./perf-500";

const { values } = parseArgs({
  options: {
    pages: { type: "string", default: "500" },
    port: { type: "string" },
    origin: { type: "string" },
    minutes: { type: "string", default: "30" },
  },
});
const total = Number(values.pages);

async function policyVerdict(url: string): Promise<string> {
  try {
    await normalizeAndValidateStartUrl(url);
    return "allowed";
  } catch (error) {
    return `blocked (${error instanceof Error ? error.message : String(error)})`;
  }
}

function workerdRssKb(): number {
  let pids: string[] = [];
  try {
    pids = execFileSync("pgrep", ["-x", "workerd"], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return 0; // no workerd running
  }
  let kb = 0;
  for (const pid of pids) {
    try {
      const status = readFileSync(`/proc/${pid}/status`, "utf8");
      kb += Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
    } catch {
      // process exited between pgrep and read
    }
  }
  return kb;
}

const { server, port: listenPort } = await startSyntheticSite(
  total,
  "0.0.0.0",
  Number(values.port ?? 0),
);
const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a?.family === "IPv4")
  .map((a) => a?.address ?? "");
const candidates = [
  ...addresses.map((a) => `http://${a}:${listenPort}/`),
  `http://127.0.0.1.nip.io:${listenPort}/`,
  ...addresses
    .filter((a) => a !== "127.0.0.1")
    .map((a) => `http://${a}.nip.io:${listenPort}/`),
];
const verdicts = await Promise.all(
  candidates.map(async (url) => ({ url, verdict: await policyVerdict(url) })),
);
for (const v of verdicts) console.log(`${v.verdict.padEnd(40)} ${v.url}`);
const allowed = verdicts.filter((v) => v.verdict === "allowed");

if (!values.origin) {
  server.close();
  console.log(
    allowed.length === 0
      ? "\nIn-app run: every local address is blocked by the SSRF policy (correct). BLOCKED-KEN: needs a public tunnel to this server; rerun with --port and --origin."
      : `\nIn-app run: ${allowed.length} local address(es) allowed — start the in-app audit on one and rerun with --origin to sample workerd RSS.`,
  );
  process.exit(0);
}

console.log(`\nOrigin policy: ${await policyVerdict(values.origin)}`);
const idle = workerdRssKb();
let peak = idle;
const mb = (kb: number) => `${Math.round(kb / 1024)} MB`;
console.log(
  `Serving ${total} pages on :${listenPort}; workerd idle RSS ${mb(idle)}. Start the in-app audit of ${values.origin} now.`,
);
const until = Date.now() + Number(values.minutes) * 60_000;
while (Date.now() < until) {
  await new Promise((r) => setTimeout(r, 1000));
  const now = workerdRssKb();
  peak = Math.max(peak, now);
}
console.log(
  JSON.stringify(
    {
      pages: total,
      idleRss: mb(idle),
      peakRss: mb(peak),
      finalRss: mb(workerdRssKb()),
    },
    null,
    2,
  ),
);
server.close();
process.exit(0);
