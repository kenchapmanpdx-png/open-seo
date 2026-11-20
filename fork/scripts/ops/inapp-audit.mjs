// In-app end-to-end harness (fork/DEPENDABILITY.md WO-B13-002, R10).
// Started detached through `bash fork/scripts/run-local.sh ops e2e <label> …`.
//
//   --base http://127.0.0.1:3001  --url https://salonvata.com/  --max-pages <n>
//   --label <name>  [--project <id>]  [--via form|button]  [--no-wait-handbook]
//   [--timeout-min 60]  [--audit <id>]
//
// Resolves the B13 test project (A11; created once through the UI, id kept in
// fork/runs/_ops/test-project-id), turns its Handbook on through the Handbook
// settings card, starts the audit through the upstream Site Audit form, takes
// the audit id from the URL and polls database truth (`ops e2e-read --json`)
// until the audit and the Handbook run finish or the timeout hits. Then reads
// what the UI shows (runs list findings count, run page findings tab count,
// provisional banner) and writes fork/runs/_ops/e2e-<label>.json (E2EResult).
// `--audit <id>` re-attaches to an audit that is already running: no project
// setup, no new audit, poll + read only.
// Exit 0 only when audit and Handbook completed, the three findings counts
// agree and `problems` is empty; 1 otherwise; 2 on usage / refusal.
// Never prints an env value.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { chromium } from "@playwright/test";

const OPS = "fork/runs/_ops";
const TEST_PROJECT_NAME = "B13 test – salonvata.com";
const TEST_PROJECT_FILE = `${OPS}/test-project-id`;
const RESTORE_FILE = `${OPS}/restore-project-options.json`;
const MAX_AGE_MS = 12 * 3600 * 1000;
const POLL_MS = 30_000;

function parseArgs(argv) {
  const opts = {
    base: "http://127.0.0.1:3001",
    url: "https://salonvata.com/",
    maxPages: null,
    label: null,
    project: null,
    via: "form",
    waitHandbook: true,
    timeoutMin: 60,
    audit: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) usage(`${a} needs a value`);
      return v;
    };
    if (a === "--base") opts.base = next().replace(/\/$/, "");
    else if (a === "--url") opts.url = next();
    else if (a === "--max-pages") opts.maxPages = Number(next());
    else if (a === "--label") opts.label = next();
    else if (a === "--project") opts.project = next();
    else if (a === "--via") opts.via = next();
    else if (a === "--no-wait-handbook") opts.waitHandbook = false;
    else if (a === "--timeout-min") opts.timeoutMin = Number(next());
    else if (a === "--audit") opts.audit = next();
    else usage(`unknown argument ${a}`);
  }
  if (!opts.label || !/^[\w-]+$/.test(opts.label)) usage("--label <name>");
  if (!["form", "button"].includes(opts.via)) usage("--via form|button");
  if (!opts.audit && !(opts.maxPages > 0)) usage("--max-pages <n>");
  if (!(opts.timeoutMin > 0)) usage("--timeout-min <minutes>");
  if (opts.audit && !/^[\w-]+$/.test(opts.audit)) usage("--audit <id>");
  return opts;
}

function usage(msg) {
  console.error(`inapp-audit: ${msg}`);
  console.error(
    "usage: inapp-audit.mjs --label <name> --max-pages <n> [--base URL] [--url URL] [--project ID] [--via form|button] [--no-wait-handbook] [--timeout-min 60] [--audit ID]",
  );
  process.exit(2);
}

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const fresh = (file) =>
  existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE_MS;

/** Database truth through the ops verb; returns the parsed JSON object. */
function e2eRead(args) {
  const res = spawnSync(
    "bash",
    ["fork/scripts/run-local.sh", "ops", "e2e-read", ...args, "--json"],
    { encoding: "utf8", timeout: 120_000 },
  );
  const line = (res.stdout ?? "")
    .split("\n")
    .reverse()
    .find((l) => l.startsWith("{"));
  if (!line) {
    const err = (res.stderr || res.stdout || "").trim().split("\n").pop();
    throw new Error(`e2e-read ${args[0]} failed: ${err?.slice(0, 200)}`);
  }
  return JSON.parse(line);
}

const opts = parseArgs(process.argv.slice(2));
if (opts.via === "button") {
  console.error("inapp-audit: --via button not built yet (WO-B13-014)");
  process.exit(2);
}
if (existsSync(`${OPS}/build-failed`)) {
  console.error(
    "inapp-audit: refusing to start, fork/runs/_ops/build-failed exists",
  );
  process.exit(2);
}
mkdirSync(OPS, { recursive: true });
// WO-B13-006 adds the stamp and its comparison with the tree; until then
// the stamp is recorded only.
const buildStamp = existsSync(`${OPS}/build-stamp`)
  ? readFileSync(`${OPS}/build-stamp`, "utf8").trim()
  : "none";
const startedAt = new Date().toISOString();
const testMode = fresh(`${OPS}/testmode.env`);
const outFile = `${OPS}/e2e-${opts.label}.json`;
log(
  `label=${opts.label} base=${opts.base} url=${opts.url} maxPages=${opts.maxPages ?? "-"} testMode=${testMode} buildStamp=${buildStamp.slice(0, 12)}`,
);

// ---------------------------------------------------------------- browser
const problems = [];
let collecting = true;
const browser = await chromium.launch();
const page = await browser.newPage();
// Same collection and ignore list as fork/scripts/ui-smoke.mjs.
const ignore = (url) =>
  url.includes("/api/auth/get-session") || url.includes("/__tsd/");
let ignored404 = false;
const note = (p) => {
  if (collecting && !problems.includes(p)) problems.push(p);
};
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (/Failed to load resource.*404/.test(m.text()) && ignored404) return;
  note(`console: ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) => note(`pageerror: ${e.message.slice(0, 300)}`));
page.on("response", (r) => {
  if (r.status() < 400) return;
  if (ignore(r.url())) ignored404 = true;
  else note(`HTTP ${r.status()} ${r.url()}`);
});
page.on("requestfailed", (r) => {
  // Navigating away aborts in-flight polls; not an app error.
  if (ignore(r.url()) || r.failure()?.errorText === "net::ERR_ABORTED") return;
  note(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
});

async function visit(path) {
  ignored404 = false;
  const res = await page.goto(`${opts.base}${path}`, {
    waitUntil: "load",
    timeout: 120_000,
  });
  if (!res || res.status() >= 400)
    note(`HTTP ${res?.status() ?? "none"} on ${path}`);
  await page.waitForTimeout(3000);
}

// ---------------------------------------------------------- test project
function projects() {
  return e2eRead(["--projects"]).projects;
}

async function createTestProject() {
  await visit("/");
  await page.getByLabel("Switch project").first().click();
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(TEST_PROJECT_NAME);
  // Domain left empty on purpose: a domain starts an automatic 50-page audit
  // (CreateProjectModal), which would be a second live audit (A8).
  await dialog.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/p\/[^/?#]+/, { timeout: 60_000 });
  await page.waitForTimeout(2000);
  const created = projects().find((p) => p.name === TEST_PROJECT_NAME);
  if (!created) throw new Error("project not found in the database");
  return created;
}

async function resolveProject() {
  if (opts.project) return opts.project;
  if (existsSync(TEST_PROJECT_FILE))
    return readFileSync(TEST_PROJECT_FILE, "utf8").trim();
  let project = projects().find((p) => p.name === TEST_PROJECT_NAME);
  if (!project) {
    try {
      project = await createTestProject();
      log(`created test project ${project.id} through the UI`);
    } catch (error) {
      log(`test project creation failed: ${error.message.slice(0, 200)}`);
      project = projects().find((p) => /salonvata\.com/.test(p.domain ?? ""));
      if (!project) throw new Error("no test project and no salonvata project");
      log(`fallback: existing salonvata project ${project.id}`);
      if (project.serpOriginality) {
        writeFileSync(
          RESTORE_FILE,
          `${JSON.stringify({ projectId: project.id, serpOriginality: true, at: startedAt }, null, 2)}\n`,
        );
        // No UI control sets this option; recorded for WO-090, left as is.
        note(
          `fallback project ${project.id} has SERP originality on; no UI control to turn it off (recorded in ${RESTORE_FILE})`,
        );
      }
    }
  }
  writeFileSync(TEST_PROJECT_FILE, `${project.id}\n`);
  return project.id;
}

const isOn = async (locator) =>
  (await locator.getAttribute("aria-checked")) === "true";

/** Handbook on, copy quality off, through the Handbook settings card. */
async function ensureHandbookSettings(projectId) {
  const current = projects().find((p) => p.id === projectId);
  if (current?.handbookEnabled && current.copyQuality === false) return;
  await visit(`/p/${projectId}/handbook`);
  // Base UI switches: the id sits on a hidden input; click the role=switch.
  const enabled = page.getByRole("switch", { name: "Enabled" });
  const copy = page.getByRole("switch", { name: /^Copy quality/ });
  await enabled.waitFor({ timeout: 60_000 });
  if (!(await isOn(enabled))) await enabled.click();
  if (await isOn(copy)) await copy.click();
  await page.getByRole("button", { name: "Save" }).click();
  await page
    .getByText("Handbook settings saved")
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  const after = projects().find((p) => p.id === projectId);
  if (!after?.handbookEnabled || after.copyQuality !== false)
    throw new Error("Handbook settings did not save (enabled / copy quality)");
  log(`handbook settings: enabled, copy quality off (${projectId})`);
}

// ------------------------------------------------------------ start audit
async function startAudit(projectId) {
  await visit(`/p/${projectId}/audit`);
  await page.getByRole("heading", { name: "Start New Audit" }).waitFor({
    timeout: 60_000,
  });
  await page.getByLabel("Site URL").fill(opts.url);
  const maxPages = page.locator("#audit-max-pages");
  await maxPages.fill(String(opts.maxPages));
  await maxPages.blur();
  await page.getByRole("button", { name: "Start Audit" }).click();
  await page.waitForURL(/[?&]auditId=/, { timeout: 120_000 });
  const auditId = new URL(page.url()).searchParams.get("auditId");
  if (!auditId) throw new Error("no auditId in the page URL");
  return auditId;
}

// ------------------------------------------------------------------- poll
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(auditId) {
  const deadline = Date.now() + opts.timeoutMin * 60_000;
  let auditDoneAt = null;
  let truth = null;
  let last = "";
  for (;;) {
    try {
      truth = e2eRead([auditId]);
    } catch (error) {
      log(`poll: ${error.message}`);
    }
    if (truth?.error) throw new Error(`audit ${auditId}: ${truth.error}`);
    if (truth?.audit) {
      const { audit, handbook } = truth;
      const line = `audit=${audit.status} pages=${audit.pagesCrawled}/${audit.maxPages ?? "?"} handbook=${
        handbook
          ? `${handbook.status} findings=${handbook.findingsDb} stages=${Object.entries(
              handbook.stages,
            )
              .map(([s, v]) => `${s}:${v}`)
              .join(",")}`
          : "none"
      }`;
      if (line !== last) log(line);
      last = line;
      if (audit.status !== "running") {
        auditDoneAt ??= Date.now();
        if (!opts.waitHandbook) return truth;
        if (handbook && ["completed", "failed"].includes(handbook.status))
          return truth;
        // The hook creates the run around finalize; give it time to appear.
        if (!handbook && Date.now() - auditDoneAt > 10 * 60_000) {
          note("no Handbook run linked to the audit 10 min after it ended");
          return truth;
        }
      }
    }
    if (Date.now() > deadline) {
      note(`timeout after ${opts.timeoutMin} min`);
      return truth;
    }
    await sleep(POLL_MS);
  }
}

// --------------------------------------------------------------- UI reads
async function readRunsList(projectId, runId) {
  await visit(`/p/${projectId}/handbook`);
  const row = page.locator("tr", {
    has: page.locator(`a[href$="/handbook/${runId}"]`),
  });
  try {
    await row.first().waitFor({ timeout: 30_000 });
  } catch {
    note(`runs list: no row links to run ${runId}`);
    return -1;
  }
  const headers = await page.locator("thead th").allInnerTexts();
  const col = headers.findIndex((h) => h.trim() === "Findings");
  const cells = await row.first().locator("td").allInnerTexts();
  const n = col >= 0 ? Number(cells[col]?.trim()) : NaN;
  if (!Number.isInteger(n)) {
    note(`runs list: findings cell not readable (${cells.join(" | ")})`);
    return -1;
  }
  return n;
}

async function readRunPage(projectId, runId) {
  await visit(`/p/${projectId}/handbook/${runId}`);
  let findingsPageCount = -1;
  const tab = page.getByRole("tab", { name: /^Findings \(\d+\)/ });
  try {
    await tab.waitFor({ timeout: 30_000 });
    const m = /Findings \((\d+)\)/.exec(await tab.innerText());
    findingsPageCount = m ? Number(m[1]) : -1;
  } catch {
    // handled below
  }
  if (findingsPageCount < 0) note("run page: findings tab count not found");
  const banner = page.getByRole("alert").filter({ hasText: /provisional/i });
  const provisional = (await banner.count()) > 0;
  let provisionalReason = null;
  if (provisional) {
    const desc = banner.first().locator('[data-slot="alert-description"]');
    provisionalReason = (
      (await desc.count())
        ? await desc.first().innerText()
        : await banner.first().innerText()
    ).trim();
  }
  return { findingsPageCount, provisional, provisionalReason };
}

// ------------------------------------------------------------------- main
let auditId = opts.audit;
let truth = null;

let fatal = null;
try {
  if (auditId) {
    log(`re-attach to audit ${auditId} (no project setup, no new audit)`);
  } else {
    const projectId = await resolveProject();
    log(`project ${projectId}`);
    await ensureHandbookSettings(projectId);
    auditId = await startAudit(projectId);
    log(`audit started ${auditId}`);
  }
  // Polling only reads the database; leave the browser idle meanwhile.
  await page.goto("about:blank");
  truth = await poll(auditId);
} catch (error) {
  fatal = error;
  note(`harness: ${error.message.slice(0, 300)}`);
}

let handbookOut = null;
if (truth?.audit && truth.handbook) {
  let ui = {
    findingsListCount: -1,
    findingsPageCount: -1,
    provisional: false,
    provisionalReason: null,
  };
  try {
    const projectId = truth.audit.projectId;
    const { runId } = truth.handbook;
    ui.findingsListCount = await readRunsList(projectId, runId);
    ui = { ...ui, ...(await readRunPage(projectId, runId)) };
    // The UI was read after polling; re-read truth so counts compare at rest.
    truth = e2eRead([auditId]);
  } catch (error) {
    note(`ui read: ${error.message.slice(0, 300)}`);
  }
  const h = truth.handbook;
  handbookOut = {
    runId: h.runId,
    status: h.status,
    errorCode: h.errorCode,
    grade: h.grade,
    scoreFinal: h.scoreFinal,
    findingsDb: h.findingsDb,
    findingsListCount: ui.findingsListCount,
    findingsPageCount: ui.findingsPageCount,
    provisional: ui.provisional,
    provisionalReason: ui.provisionalReason,
    coverageRead: h.coverageRead,
    coverageCapped: h.coverageCapped,
    stages: h.stages,
    llmCostUsd: h.llmCostUsd,
    finishedAt: h.finishedAt,
  };
}
collecting = false;
await browser.close();

const a = truth?.audit;
if (a && a.share403or429 >= 0.1)
  problems.push(
    `403/429 share ${(a.share403or429 * 100).toFixed(1)} % ≥ 10 % (A8: pause 60 min)`,
  );
const result = {
  label: opts.label,
  startedAt,
  buildStamp,
  testMode,
  audit: {
    id: a?.id ?? auditId ?? "",
    status: a?.status ?? "failed",
    pagesCrawled: a?.pagesCrawled ?? 0,
    maxPages: a?.maxPages ?? opts.maxPages ?? 0,
    errorCode: a?.errorCode ?? (a ? null : "harness"),
    errorDetail: a?.errorDetail ?? (a ? null : (fatal?.message ?? null)),
    completedAt: a?.completedAt ?? null,
    share403or429: a?.share403or429 ?? 0,
  },
  handbook: handbookOut,
  problems,
};
writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);

const h = result.handbook;
const countsAgree =
  h != null &&
  h.findingsListCount === h.findingsPageCount &&
  h.findingsPageCount === h.findingsDb;
// With --no-wait-handbook the run may still be going; its counts are not judged.
const ok =
  result.audit.status === "completed" &&
  (!opts.waitHandbook || (h?.status === "completed" && countsAgree)) &&
  problems.length === 0;
const exitCode = ok ? 0 : 1;
log(
  `result ${ok ? "PASS" : "FAIL"} → ${outFile}: audit=${result.audit.status} ${result.audit.pagesCrawled}/${result.audit.maxPages} handbook=${h ? `${h.status} grade=${h.grade ?? "null"} findings db/list/page=${h.findingsDb}/${h.findingsListCount}/${h.findingsPageCount} provisional=${h.provisional} llm=$${h.llmCostUsd.toFixed(4)}` : "none"} problems=${problems.length}`,
);
for (const p of problems) log(`  problem: ${p}`);
process.exit(exitCode);
