// Watchdog rules W0–W9 (WO-B13-013). Run: node --test fork/scripts/ops/watchdog.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, deepProbeDue, HOUR_MS, initialState } from "./watchdog.mjs";

const NOW = 1_800_000_000_000;

function health(over = {}) {
  const base = {
    ok: true,
    testMode: false,
    checks: {
      db: { ok: true, ms: 5, serverConns: 3, error: null },
      sidecar: { ok: true, version: "1.7.0", reason: null },
      llm: { configured: true },
      cron: { state: "ok", lastTickAt: null, ageSec: 60 },
      handbook: { leaseHolder: null, beatAgeSec: null, interrupted24h: 0 },
      audits: { running: 0, stale: 0 },
    },
  };
  return {
    ...base,
    ...over,
    checks: { ...base.checks, ...(over.checks ?? {}) },
  };
}

const probe = (over = {}) => ({
  maintenance: false,
  building: false,
  health: health(),
  ping: { ok: true },
  p1Lines: 0,
  appUpSec: 3600,
  backupAgeH: 5,
  diskFreeGb: 500,
  buildFailed: false,
  poolerSockets: 4,
  deep: null,
  selftest: null,
  ...over,
});
const state = (over = {}) => ({ ...initialState(), ...over });
const types = (r) => r.actions.map((a) => a.type);
const fresh = {
  handbook: { leaseHolder: "r1", beatAgeSec: 30, interrupted24h: 0 },
};

const cases = [
  ["all ok", state(), probe(), "ok", ["post-health"]],
  [
    "W0 maintenance: probe and log only",
    state({ healthFail: 1 }),
    probe({ maintenance: true, health: null }),
    "fail",
    [],
  ],
  [
    "W0 building marker: no action",
    state(),
    probe({
      building: true,
      health: health({
        checks: { sidecar: { ok: false, version: null, reason: "x" } },
      }),
    }),
    "warn",
    [],
  ],
  [
    "W1 first unreachable pass: wait",
    state(),
    probe({ health: null }),
    "warn",
    ["notify"],
  ],
  [
    "W1 second unreachable pass: restart app",
    state({ healthFail: 1, level: "warn" }),
    probe({ health: null }),
    "fail",
    ["restart-app", "notify"],
  ],
  [
    "W2a db failing 3 passes, own ping ok: restart despite fresh beat",
    state({ dbFail: 2, level: "warn" }),
    probe({
      health: health({
        ok: false,
        checks: {
          ...fresh,
          db: { ok: false, ms: null, serverConns: null, error: "x" },
        },
      }),
    }),
    "warn",
    ["restart-app", "post-health"],
  ],
  [
    "W2a not yet: db failing 2 passes",
    state({ dbFail: 1, level: "warn" }),
    probe({
      health: health({
        checks: { db: { ok: false, ms: null, serverConns: null, error: "x" } },
      }),
    }),
    "warn",
    ["post-health"],
  ],
  [
    "W2b own ping connection error 2 passes: fail, no restart",
    state({ pingConnFail: 1, dbFail: 5 }),
    probe({
      ping: { ok: false, kind: "connection" },
      health: health({
        checks: { db: { ok: false, ms: null, serverConns: null, error: "x" } },
      }),
    }),
    "fail",
    ["notify", "post-health"],
  ],
  [
    "W2c own ping pool error 2 passes: restart despite fresh beat",
    state({ poolFail: 1, level: "warn" }),
    probe({
      ping: { ok: false, kind: "pool" },
      health: health({ checks: fresh }),
    }),
    "warn",
    ["restart-app", "post-health"],
  ],
  [
    "W2c P1 log lines 2 passes: restart",
    state({ poolFail: 1, level: "warn" }),
    probe({ p1Lines: 3 }),
    "warn",
    ["restart-app", "post-health"],
  ],
  [
    "W3 sidecar down: heal chain",
    state(),
    probe({
      health: health({
        ok: false,
        checks: {
          sidecar: {
            ok: false,
            version: null,
            reason: "sidecar unreachable: x",
          },
        },
      }),
    }),
    "warn",
    ["sidecar-heal", "notify", "post-health"],
  ],
  [
    "W4 second failed render probe: docker restart",
    state({ deepFail: 1, level: "warn" }),
    probe({ deep: { ok: false } }),
    "warn",
    ["restart-sidecar", "post-health"],
  ],
  [
    "W5 cron stale: restart tick timer",
    state(),
    probe({
      health: health({
        checks: { cron: { state: "stale", lastTickAt: null, ageSec: 1000 } },
      }),
    }),
    "warn",
    ["restart-tick", "notify", "post-health"],
  ],
  [
    "W5 cron unknown, app up 5 min: wait",
    state({ level: "warn" }),
    probe({
      appUpSec: 300,
      health: health({
        checks: { cron: { state: "unknown", lastTickAt: null, ageSec: null } },
      }),
    }),
    "ok",
    ["notify", "post-health"],
  ],
  [
    "W6 app budget spent: no restart, fail",
    state({
      healthFail: 1,
      appRestarts: [NOW - 1000, NOW - 2000, NOW - 3000],
      level: "fail",
    }),
    probe({ health: null }),
    "fail",
    [],
  ],
  [
    "W6 restarts older than 1 h do not count",
    state({
      healthFail: 1,
      appRestarts: [NOW - HOUR_MS - 1, NOW - HOUR_MS - 2, NOW - 5000],
      level: "fail",
    }),
    probe({ health: null }),
    "fail",
    ["restart-app"],
  ],
  [
    "W7 idle with 130 pooler sockets: restart",
    state({ level: "warn" }),
    probe({ poolerSockets: 130 }),
    "warn",
    ["restart-app", "post-health"],
  ],
  [
    "W7 held while an audit runs",
    state(),
    probe({
      poolerSockets: 130,
      health: health({ checks: { audits: { running: 1 } } }),
    }),
    "ok",
    ["post-health"],
  ],
  [
    "beat younger than 120 s holds a W7 restart",
    state({ level: "warn" }),
    probe({
      poolerSockets: 130,
      health: health({
        checks: {
          handbook: { leaseHolder: null, beatAgeSec: 30, interrupted24h: 0 },
        },
      }),
    }),
    "warn",
    ["post-health"],
  ],
  [
    "W9 old backup: warn only",
    state(),
    probe({ backupAgeH: 40 }),
    "warn",
    ["notify", "post-health"],
  ],
  [
    "W9 low disk: warn only",
    state(),
    probe({ diskFreeGb: 3 }),
    "warn",
    ["notify", "post-health"],
  ],
  [
    "W9 build failed: warn only",
    state(),
    probe({ buildFailed: true }),
    "warn",
    ["notify", "post-health"],
  ],
  [
    "W8 self-test failed: warn only",
    state(),
    probe({
      selftest: { at: new Date(NOW - HOUR_MS).toISOString(), ok: false },
    }),
    "warn",
    ["notify", "post-health"],
  ],
  [
    "W8 self-test passed this week: ok",
    state(),
    probe({
      selftest: { at: new Date(NOW - HOUR_MS).toISOString(), ok: true },
    }),
    "ok",
    ["post-health"],
  ],
  [
    "W8 self-test older than 8 days: warn only",
    state(),
    probe({
      selftest: {
        at: new Date(NOW - 9 * 24 * HOUR_MS).toISOString(),
        ok: true,
      },
    }),
    "warn",
    ["notify", "post-health"],
  ],
  [
    "W9 test mode: warn only",
    state(),
    probe({ health: health({ testMode: true }) }),
    "warn",
    ["notify", "post-health"],
  ],
];

for (const [name, prev, p, level, expected] of cases) {
  test(name, () => {
    const r = decide(prev, p, NOW);
    assert.equal(r.level, level, r.note);
    assert.deepEqual(types(r), expected);
  });
}

test("W2b note names the cause", () => {
  const r = decide(
    state({ pingConnFail: 1 }),
    probe({ ping: { ok: false, kind: "connection" } }),
    NOW,
  );
  assert.match(
    r.note,
    /database unreachable \(Supabase down or paused, or no internet\)/,
  );
});

test("W6 budget counts restarts made by the watchdog", () => {
  let prev = state();
  let restarts = 0;
  for (let i = 0; i < 6; i++) {
    const r = decide(prev, probe({ health: null }), NOW + i * 120_000);
    restarts += types(r).filter((t) => t === "restart-app").length;
    prev = r.next;
  }
  assert.equal(restarts, 3);
  assert.equal(prev.level, "fail");
});

test("flapping ok → fail → ok sends 2 notifications", () => {
  let prev = state();
  let notes = 0;
  const seq = [
    probe(),
    probe({ ping: { ok: false, kind: "connection" } }),
    probe({ ping: { ok: false, kind: "connection" } }),
    probe(),
  ];
  for (const [i, p] of seq.entries()) {
    const r = decide(prev, p, NOW + i * 120_000);
    notes += types(r).filter((t) => t === "notify").length;
    prev = r.next;
  }
  // ok → (connection 1: ok) → fail (notify) → ok (notify)
  assert.equal(notes, 2);
});

test("W0 keeps the last notified level so the change is sent afterwards", () => {
  const r = decide(
    state({ level: "ok" }),
    probe({ maintenance: true, diskFreeGb: 1 }),
    NOW,
  );
  assert.equal(r.next.level, "ok");
  assert.match(r.note, /^maintenance: /);
});

test("deep probe due every interval, only with the lease free and sidecar up", () => {
  const every = 1800_000;
  assert.equal(deepProbeDue(state(), health(), NOW, every), true);
  assert.equal(
    deepProbeDue(state({ lastDeepAt: NOW - 60_000 }), health(), NOW, every),
    false,
  );
  assert.equal(
    deepProbeDue(state(), health({ checks: fresh }), NOW, every),
    false,
  );
  assert.equal(deepProbeDue(state(), null, NOW, every), false);
});
