// OpenSEO watchdog (fork/DEPENDABILITY.md WO-B13-013, ADR-028). One pass per
// run of openseo-watchdog.service (timer: every 2 min): probe → decide → act.
// Reached only through `bash fork/scripts/run-local.sh ops watchdog`, which
// has loaded .env.local into this process. Nothing here prints an env value.
//
// `decide()` is pure and holds every rule (W0–W9); the rest gathers the probe
// and carries out the actions. Files: state, status and log under
// fork/runs/_ops/.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const HOUR_MS = 3600_000;
const MAINT_MAX_MS = 12 * HOUR_MS;
const BUILDING_MAX_MS = 15 * 60_000;
const BEAT_GUARD_S = 120;
const RESTART_BUDGET = 3; // per hour, app and sidecar each
const POOLER_SOCKET_LIMIT = 120; // client cap 200 (E5)
const APP_UP_FOR_CRON_S = 15 * 60;
const BACKUP_MAX_H = 36;
const DISK_MIN_GB = 5;
const SELFTEST_MAX_AGE_MS = 8 * 24 * HOUR_MS;
export const P1_RE =
  /EMAXCONN|max client|MaxClientsInSessionMode|too many clients|remaining connection slots/i;
const DB_DOWN_NOTE =
  "database unreachable (Supabase down or paused, or no internet)";

export const initialState = () => ({
  lastAt: 0,
  level: "ok",
  healthFail: 0,
  dbFail: 0,
  pingConnFail: 0,
  poolFail: 0,
  deepFail: 0,
  lastDeepAt: 0,
  appRestarts: [],
  sidecarRestarts: [],
});

/** Deep render probe every `everyMs`, only while no Handbook run holds the lease. */
export function deepProbeDue(prev, health, now, everyMs) {
  if (!health || !health.checks.sidecar.ok) return false;
  if (health.checks.handbook.leaseHolder) return false;
  return now - prev.lastDeepAt >= everyMs;
}

/**
 * probe: { maintenance, building, health (ForkHealth | null = unreachable),
 *   ping: { ok: true } | { ok: false, kind: "pool" | "connection" | "skipped" },
 *   p1Lines, appUpSec, backupAgeH, diskFreeGb, buildFailed, poolerSockets,
 *   deep: null | { ok }, selftest: null | { at, ok } }
 * Returns { actions, next, level, note }. Actions: restart-app, sidecar-heal,
 * restart-sidecar, restart-tick, notify, post-health.
 */
export function decide(prev, probe, now) {
  const next = {
    ...initialState(),
    ...prev,
    lastAt: now,
    appRestarts: prev.appRestarts.filter((t) => now - t < HOUR_MS),
    sidecarRestarts: prev.sidecarRestarts.filter((t) => now - t < HOUR_MS),
  };
  const fails = [];
  const warns = [];
  let restartApp = null; // reason
  let beatExempt = false;
  let sidecar = null; // action
  let tick = false;

  const health = probe.health;
  next.healthFail = health ? 0 : prev.healthFail + 1;
  if (!health) {
    warns.push("health route unreachable");
    if (next.healthFail >= 2) {
      fails.push("health route unreachable on 2 passes");
      restartApp = "W1 health route unreachable";
    }
  }

  const ping = probe.ping;
  next.pingConnFail =
    !ping.ok && ping.kind === "connection" ? prev.pingConnFail + 1 : 0;
  const poolTrouble = probe.p1Lines > 0 || (!ping.ok && ping.kind === "pool");
  next.poolFail = poolTrouble ? prev.poolFail + 1 : 0;

  if (next.pingConnFail >= 2) {
    // W2b: restarting cannot fix an unreachable database.
    fails.push(DB_DOWN_NOTE);
    restartApp = null;
  } else if (next.poolFail >= 2) {
    restartApp = "W2c pool exhausted";
    beatExempt = true;
  }

  if (health) {
    const c = health.checks;
    next.dbFail = c.db.ok ? 0 : prev.dbFail + 1;
    if (!c.db.ok) warns.push(`database check failing: ${c.db.error ?? "?"}`);
    if (next.dbFail >= 3 && ping.ok && next.pingConnFail < 2 && !restartApp) {
      restartApp = "W2a app database check failing, own ping ok";
      beatExempt = true;
    }

    if (!c.sidecar.ok) {
      warns.push(`sidecar: ${c.sidecar.reason ?? "down"}`);
      sidecar = {
        type: "sidecar-heal",
        tokenRejected: /token rejected/.test(c.sidecar.reason ?? ""),
      };
    }

    if (probe.deep) {
      next.lastDeepAt = now;
      next.deepFail = probe.deep.ok ? 0 : prev.deepFail + 1;
      if (!probe.deep.ok) warns.push("render probe failed");
      if (next.deepFail >= 2 && !sidecar) {
        sidecar = { type: "restart-sidecar" };
        next.deepFail = 0;
      }
    }

    if (
      c.cron.state === "stale" ||
      (c.cron.state === "unknown" && (probe.appUpSec ?? 0) > APP_UP_FOR_CRON_S)
    ) {
      warns.push(`cron ${c.cron.state}`);
      tick = true;
    }

    if (
      !restartApp &&
      !c.handbook.leaseHolder &&
      c.audits.running === 0 &&
      probe.poolerSockets > POOLER_SOCKET_LIMIT
    ) {
      restartApp = `W7 ${probe.poolerSockets} pooler sockets while idle`;
    }

    const beat = c.handbook.beatAgeSec;
    if (restartApp && !beatExempt && beat !== null && beat < BEAT_GUARD_S) {
      warns.push(`restart held: Handbook beat ${beat}s old`);
      restartApp = null;
    }
    if (health.testMode) warns.push("test mode on");
  } else {
    next.dbFail = prev.dbFail;
  }

  if (probe.backupAgeH !== null && probe.backupAgeH > BACKUP_MAX_H)
    warns.push(`newest backup ${probe.backupAgeH} h old`);
  if (probe.backupAgeH === null) warns.push("no backup file found");
  if (probe.diskFreeGb !== null && probe.diskFreeGb < DISK_MIN_GB)
    warns.push(`disk free ${probe.diskFreeGb} GB`);
  if (probe.buildFailed) warns.push("last build failed (old build served)");
  // W8 (WO-B13-016): weekly self-test failed or missed its weekly run.
  const st = probe.selftest;
  if (st && !st.ok) warns.push(`weekly self-test failed (${st.at})`);
  else if (st && now - Date.parse(st.at) > SELFTEST_MAX_AGE_MS)
    warns.push(`weekly self-test last ran ${st.at}`);

  const actions = [];
  if (restartApp) {
    if (next.appRestarts.length >= RESTART_BUDGET) {
      fails.push(
        `app restart budget spent (${RESTART_BUDGET}/h): ${restartApp}`,
      );
    } else {
      actions.push({ type: "restart-app", reason: restartApp });
      next.appRestarts = [...next.appRestarts, now];
    }
  }
  if (sidecar) {
    if (next.sidecarRestarts.length >= RESTART_BUDGET) {
      fails.push(`sidecar restart budget spent (${RESTART_BUDGET}/h)`);
    } else {
      actions.push(sidecar);
      next.sidecarRestarts = [...next.sidecarRestarts, now];
    }
  }
  if (tick) actions.push({ type: "restart-tick" });

  const level = fails.length
    ? "fail"
    : warns.length || actions.length
      ? "warn"
      : "ok";
  const note = [...fails, ...warns].join("; ") || "all checks ok";

  if (probe.maintenance || probe.building) {
    // W0: the build is working on the app; probe and log only.
    next.level = prev.level;
    return {
      actions: [],
      next,
      level,
      note: `${probe.maintenance ? "maintenance" : "building"}: ${note}`,
    };
  }

  if (level !== prev.level) actions.push({ type: "notify", level, note });
  if (health) actions.push({ type: "post-health" });
  next.level = level;
  return { actions, next, level, note };
}

// ---------------------------------------------------------------- runtime

const OPS_DIR = "fork/runs/_ops";
const STATE_FILE = join(OPS_DIR, "watchdog-state.json");
const STATUS_FILE = join(OPS_DIR, "status.json");
const LOG_FILE = join(OPS_DIR, "watchdog.log");
const LOG_MAX_BYTES = 1024 * 1024;
const APP_URL = process.env.OPENSEO_APP_URL || "http://127.0.0.1:3001";
const APP_UNIT = "openseo-app.service";
const SIDECAR = "sidecar-sidecar-1";
const COMPOSE = "fork/sidecar/compose.yaml";

const redact = (text) =>
  String(text)
    .replace(/postgres(ql)?:\/\/\S+/g, "postgres://[redacted]")
    .replace(/Bearer \S+/g, "Bearer [redacted]");

function rotateLog() {
  try {
    if (statSync(LOG_FILE).size < LOG_MAX_BYTES) return;
  } catch {
    return;
  }
  for (let i = 2; i >= 1; i--) {
    if (existsSync(`${LOG_FILE}.${i}`))
      renameSync(`${LOG_FILE}.${i}`, `${LOG_FILE}.${i + 1}`);
  }
  renameSync(LOG_FILE, `${LOG_FILE}.1`);
}

function log(line) {
  const text = `${new Date().toISOString()} ${redact(line)}`;
  console.log(text);
  rotateLog();
  appendFileSync(LOG_FILE, `${text}\n`);
}

function ageMs(path) {
  try {
    return Date.now() - statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

function sh(cmd, args, timeoutMs = 120_000) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    env: process.env,
  });
  return {
    code: r.status ?? -1,
    out: redact(`${r.stdout ?? ""}${r.stderr ?? ""}`.trim()).slice(-400),
  };
}

function dockerBin() {
  const which = sh("bash", ["-c", "command -v docker"]);
  if (which.code === 0 && which.out) return which.out.split("\n")[0];
  if (existsSync("/usr/bin/docker")) return "/usr/bin/docker";
  return "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe";
}

async function readHealth() {
  try {
    const res = await fetch(`${APP_URL}/api/fork-health`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status !== 200) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Own database ping on the app's pooler port; one query, closed after. */
async function pingDb() {
  const url = process.env.SUPABASE_DB_URL || process.env.POSTGRES_DATABASE_URL;
  if (!url) return { ok: false, kind: "skipped" };
  let target;
  try {
    target = new URL(url);
  } catch {
    return { ok: false, kind: "skipped" };
  }
  let mode = "session";
  try {
    mode = readFileSync(join(OPS_DIR, "pool-mode"), "utf8").trim();
  } catch {}
  if (mode === "transaction" && target.port === "5432") target.port = "6543";
  if (process.env.WATCHDOG_DB_PING_HOST)
    target.hostname = process.env.WATCHDOG_DB_PING_HOST; // test hook (F5)
  const { default: postgres } = await import("postgres");
  const sql = postgres(target.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 1,
    onnotice: () => {},
  });
  try {
    await Promise.race([
      sql`select 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("ping timeout after 15 s")), 15_000),
      ),
    ]);
    return { ok: true };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      kind: P1_RE.test(text) ? "pool" : "connection",
      error: redact(text).slice(0, 200),
    };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

function p1LinesSince(sinceMs) {
  const since = Math.floor((sinceMs || Date.now() - 2 * 60_000) / 1000);
  const r = spawnSync(
    "journalctl",
    [
      "--user",
      "-u",
      APP_UNIT,
      "--no-pager",
      "-o",
      "cat",
      "--since",
      `@${since}`,
    ],
    { encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024 * 1024 },
  );
  return (r.stdout ?? "").split("\n").filter((line) => P1_RE.test(line)).length;
}

function appUpSec() {
  const mono = sh("systemctl", [
    "--user",
    "show",
    "-p",
    "ActiveEnterTimestampMonotonic",
    "--value",
    APP_UNIT,
  ]).out;
  const enteredUs = Number(mono);
  if (!enteredUs) return null;
  const uptimeS = Number(readFileSync("/proc/uptime", "utf8").split(" ")[0]);
  return Math.max(0, Math.round(uptimeS - enteredUs / 1e6));
}

function backupAgeH() {
  const dir =
    process.env.OPENSEO_BACKUP_DIR || join(homedir(), "openseo-backups");
  let newest = null;
  try {
    for (const name of readdirSync(dir)) {
      if (!/^\d{4}-\d{2}-\d{2}\.dump$/.test(name)) continue;
      const m = statSync(join(dir, name)).mtimeMs;
      if (newest === null || m > newest) newest = m;
    }
  } catch {}
  return newest === null ? null : Math.floor((Date.now() - newest) / HOUR_MS);
}

function diskFreeGb() {
  try {
    const s = statfsSync(".");
    return Math.floor((s.bavail * s.bsize) / 1024 ** 3);
  } catch {
    return null;
  }
}

function poolerSockets() {
  const r = sh("bash", [
    "-c",
    "ss -Htn state established '( dport = :5432 or dport = :6543 )' | wc -l",
  ]);
  return Number(r.out) || 0;
}

const ops = (...args) =>
  sh("bash", ["fork/scripts/ops/ops.sh", ...args], 300_000);
const sidecarUp = (...args) =>
  sh("bash", ["fork/scripts/ops/sidecar-up.sh", ...args], 600_000);

function healSidecar(tokenRejected) {
  const docker = dockerBin();
  if (tokenRejected) {
    sh(docker, ["compose", "-f", COMPOSE, "down"]);
    const up = sidecarUp();
    log(`W3 token rejected → compose down + up: exit ${up.code}`);
    return;
  }
  let r = sidecarUp();
  log(`W3 step 1 sidecar-up.sh: exit ${r.code} ${r.out.split("\n").pop()}`);
  if (r.code === 0) return;
  sh(docker, ["unpause", SIDECAR]);
  sh(docker, ["restart", SIDECAR]);
  r = sidecarUp();
  log(`W3 step 2 unpause + restart: exit ${r.code} ${r.out.split("\n").pop()}`);
  if (r.code === 0) return;
  sh(docker, ["compose", "-f", COMPOSE, "down"]);
  r = sidecarUp("--build");
  log(
    `W3 step 3 compose down + up --build: exit ${r.code} ${r.out.split("\n").pop()}`,
  );
}

async function notify(level, note) {
  const title = `OpenSEO ${level.toUpperCase()}`;
  const ps = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
  let toast = "unavailable";
  if (existsSync(ps)) {
    const script = [
      "[void][Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime];",
      "$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);",
      `$x=$t.GetElementsByTagName('text');$x.Item(0).AppendChild($t.CreateTextNode(${JSON.stringify(title).replace(/"/g, "'")}))|Out-Null;`,
      `$x.Item(1).AppendChild($t.CreateTextNode(${JSON.stringify(note.slice(0, 200)).replace(/'/g, "").replace(/"/g, "'")}))|Out-Null;`,
      "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('OpenSEO').Show([Windows.UI.Notifications.ToastNotification]::new($t))",
    ].join("");
    toast = `exit ${sh(ps, ["-NoProfile", "-Command", script], 20_000).code}`;
  }
  let email = "not configured";
  const key = process.env.RESEND_API_KEY;
  const to = process.env.HEALTH_ALERT_EMAIL;
  if (key && to) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from:
            process.env.HEALTH_ALERT_FROM || "OpenSEO <onboarding@resend.dev>",
          to: [to],
          subject: title,
          text: note,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      email = `HTTP ${res.status}`;
    } catch (error) {
      email = `error ${error instanceof Error ? error.name : "unknown"}`;
    }
  }
  log(`W8 notify level=${level}: toast ${toast}, email ${email}`);
}

async function postHealth(report) {
  try {
    const res = await fetch(`${APP_URL}/api/fork-health`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-openseo-watchdog": "1",
      },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status !== 204) log(`post-health HTTP ${res.status}`);
  } catch (error) {
    log(
      `post-health failed: ${error instanceof Error ? error.message : error}`,
    );
  }
}

/** JSON as prettier prints it (files under fork/ pass `format:check`). */
function writeJson(path, value) {
  const text = JSON.stringify(value, null, 2).replace(
    /^( *)("[^"]+": )?\[\n([^[\]{}]*?)\n *\]/gm,
    (whole, indent, key = "", items) => {
      const line = `${indent}${key}[${items.trim().split(/,\n */).join(", ")}]`;
      return line.length <= 80 ? line : whole;
    },
  );
  writeFileSync(path, `${text}\n`);
}

function readSelftest() {
  try {
    const s = JSON.parse(readFileSync(join(OPS_DIR, "selftest.json"), "utf8"));
    return typeof s.at === "string" && typeof s.ok === "boolean"
      ? { at: s.at, ok: s.ok }
      : null;
  } catch {
    return null;
  }
}

function readState() {
  try {
    return {
      ...initialState(),
      ...JSON.parse(readFileSync(STATE_FILE, "utf8")),
    };
  } catch {
    return initialState();
  }
}

async function main() {
  mkdirSync(OPS_DIR, { recursive: true });
  const now = Date.now();
  const prev = readState();
  const maintAge = ageMs(join(OPS_DIR, "maintenance"));
  const buildingAge = ageMs(join(OPS_DIR, "building"));
  const health = await readHealth();
  const sockets = poolerSockets();
  const deepEveryMs =
    (Number(process.env.WATCHDOG_DEEP_EVERY_S) || 1800) * 1000;
  let deep = null;
  if (deepProbeDue(prev, health, now, deepEveryMs)) {
    const r = sidecarUp("--probe");
    deep = { ok: r.code === 0 };
    log(`deep render probe: exit ${r.code} ${r.out.split("\n").pop()}`);
  }
  const probe = {
    maintenance: maintAge !== null && maintAge < MAINT_MAX_MS,
    building: buildingAge !== null && buildingAge < BUILDING_MAX_MS,
    health,
    ping: await pingDb(),
    p1Lines: p1LinesSince(prev.lastAt),
    appUpSec: appUpSec(),
    backupAgeH: backupAgeH(),
    diskFreeGb: diskFreeGb(),
    buildFailed: existsSync(join(OPS_DIR, "build-failed")),
    poolerSockets: sockets,
    deep,
    selftest: readSelftest(),
  };
  const { actions, next, level, note } = decide(prev, probe, now);
  const at = new Date(now).toISOString();
  const report = {
    at,
    level,
    note: note.slice(0, 400),
    selftest: probe.selftest,
    backupAgeH: probe.backupAgeH,
    diskFreeGb: probe.diskFreeGb,
    buildFailed: probe.buildFailed,
  };
  log(
    `pass level=${level} health=${health ? (health.ok ? "ok" : "not-ok") : "unreachable"} ping=${probe.ping.ok ? "ok" : probe.ping.kind} p1=${probe.p1Lines} sockets=${sockets} actions=${actions.map((a) => a.type).join(",") || "none"} note=${note}`,
  );
  writeJson(STATE_FILE, next);
  for (const action of actions) {
    if (action.type === "restart-app") {
      const r = ops("restart", "app");
      log(`${action.reason} → restart app: exit ${r.code}`);
    } else if (action.type === "sidecar-heal") {
      healSidecar(action.tokenRejected);
    } else if (action.type === "restart-sidecar") {
      const r = sh(dockerBin(), ["restart", SIDECAR]);
      log(
        `W4 render probe failed twice → docker restart ${SIDECAR}: exit ${r.code}`,
      );
    } else if (action.type === "restart-tick") {
      const r = ops("restart", "tick");
      log(`W5 cron → restart openseo-tick.timer: exit ${r.code}`);
    } else if (action.type === "notify") {
      await notify(action.level, action.note);
    } else if (action.type === "post-health") {
      await postHealth(report);
    }
  }
  writeJson(STATUS_FILE, {
    ...report,
    actions: actions.map((a) => a.reason ?? a.type),
    probe: { ...probe, health: health ? { ok: health.ok } : null },
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    log(`watchdog crashed: ${error instanceof Error ? error.stack : error}`);
    process.exit(1);
  });
}
