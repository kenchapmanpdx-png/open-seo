// Fork in-app UI smoke: load each fork page in headless Chromium against a running
// dev server and report console errors, page errors, failed requests and 5xx responses.
// Usage: node fork/scripts/ui-smoke.mjs [baseUrl] [projectId]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:4022";
let projectId = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage();
let problems = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  // The browser logs the ignored 404 above as a bare "Failed to load resource".
  if (/Failed to load resource.*404/.test(m.text()) && ignored404) return;
  problems.push(`console: ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) =>
  problems.push(`pageerror: ${e.message.slice(0, 300)}`),
);
// Upstream noise in local no-auth mode: the auth client polls a route that is not mounted.
const ignore = (url) =>
  url.includes("/api/auth/get-session") || url.includes("/__tsd/");
let ignored404 = false;
page.on("response", (r) => {
  if (r.status() < 400) return;
  if (ignore(r.url())) ignored404 = true;
  else problems.push(`HTTP ${r.status()} ${r.url()}`);
});
// TanStack devtools' console SSE is aborted on every navigation; not an app error.
page.on(
  "requestfailed",
  (r) =>
    !ignore(r.url()) &&
    problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`),
);

if (!projectId) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  const m = page.url().match(/\/p\/([^/?#]+)/);
  projectId = m?.[1];
  if (!projectId) {
    const href = await page
      .locator('a[href*="/p/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    projectId = href?.match(/\/p\/([^/?#]+)/)?.[1];
  }
  console.log(`landing ${page.url()} → project ${projectId ?? "(none)"}`);
}
if (!projectId) throw new Error("no project found; pass a projectId");

let runId = process.argv[4];
const paths = [
  "handbook",
  "handbook/overview",
  "handbook/ai-traffic",
  "handbook/bing",
  "handbook/ai-visibility-byok",
  "handbook/backlinks-cc",
  "handbook/agency",
];
let failed = 0;
async function visit(path) {
  problems = [];
  ignored404 = false;
  const res = await page.goto(`${base}/p/${projectId}/${path}`, {
    waitUntil: "load",
    timeout: 60000,
  });
  await page.waitForTimeout(4000);
  const h = await page
    .locator("h1, h2")
    .first()
    .textContent()
    .catch(() => "");
  const errText = await page
    .getByText(/something went wrong|failed to load|error/i)
    .locator("visible=true")
    .first()
    .textContent({ timeout: 500 })
    .catch(() => null);
  const ok = res && res.status() < 400 && problems.length === 0;
  if (!ok) failed++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${res?.status()} /${path} — heading: ${(h ?? "").trim().slice(0, 60)}${errText ? ` — text: ${errText.trim().slice(0, 120)}` : ""}`,
  );
  for (const p of problems) console.log(`     ${p}`);
  await page.screenshot({
    path: `${process.env.SMOKE_SHOTS ?? "/tmp"}/${path.replaceAll("/", "_")}.png`,
    fullPage: true,
  });
}
// WO-B11-006: the handbook tab's "Copy rules" dialog opens with the pack text.
async function checkCopyRules() {
  await page.getByRole("button", { name: "Copy rules" }).click();
  const text = await page
    .getByTestId("copy-rules-text")
    .textContent({ timeout: 5000 })
    .catch(() => "");
  const ok = /Order of authority/.test(text ?? "");
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} copy rules dialog — text present`);
  await page.keyboard.press("Escape");
}
for (const p of paths) {
  await visit(p);
  if (p === "handbook") await checkCopyRules();
  if (p === "handbook" && !runId) {
    const href = await page
      .locator(`a[href*="/handbook/"]`)
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")))
      .catch(() => []);
    runId = href
      .map((h) => h?.match(/\/handbook\/((?:hb-)?[0-9a-f-]{36})$/)?.[1])
      .find(Boolean);
  }
}
if (runId) await visit(`handbook/${runId}`);
else console.log("SKIP run page — no run found on the handbook tab");
await browser.close();
process.exit(failed ? 1 : 0);
