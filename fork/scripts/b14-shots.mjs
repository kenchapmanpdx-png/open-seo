// B14 exit (WO-B14-090): screenshots of the novice layout and a browser check
// of the Fix List (scores, groups, CSV export, done checkbox across reload).
// Usage: node fork/scripts/b14-shots.mjs <base> <projectId> <runId> [outDir]
//   [--progress <auditId>]   only the Check a site progress shot, then exit
// Exit 1 when a Fix List check fails. Writes <outDir>/b14-shots.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = args.indexOf("--progress");
const progressAudit = flag >= 0 ? args.splice(flag, 2)[1] : null;
const [base, projectId, runId, outDir = "fork/runs/b14"] = args;
if (!base || !projectId || (!runId && !progressAudit)) {
  console.error(
    "usage: b14-shots.mjs <base> <projectId> <runId> [outDir] [--progress <auditId>]",
  );
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
const go = async (path) => {
  await page.goto(`${base}/p/${projectId}/${path}`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
};
const shot = (name, opts = {}) =>
  page.screenshot({ path: `${outDir}/${name}.png`, ...opts });

if (progressAudit) {
  await go(`handbook/check?auditId=${progressAudit}`);
  await shot("check-progress", { fullPage: true });
  await browser.close();
  console.log(`check-progress.png (pageerrors ${errors.length})`);
  process.exit(0);
}

const checks = {};
await go("");
await shot("dashboard", { fullPage: true });
const sidebar = page.locator('[data-slot="sidebar-container"]').first();
if (await sidebar.count())
  await sidebar.screenshot({ path: `${outDir}/sidebar.png` });
else await shot("sidebar", { clip: { x: 0, y: 0, width: 300, height: 1000 } });

await go("handbook/check");
await shot("check-form", { fullPage: true });

await go(`handbook/${runId}`);
await page.getByRole("tab", { name: "Fix list" }).waitFor({ timeout: 30_000 });
checks.fixListDefault =
  (await page
    .getByRole("tab", { name: "Fix list" })
    .getAttribute("aria-selected")) === "true";
const tileText = await page.locator("main").innerText();
checks.scores = ["Overall", "SEO", "GEO", "AEO"].every((l) =>
  new RegExp(`(^|\\n)${l}\\n`).test(tileText),
);
checks.groups =
  tileText.match(/(Must fix|Should fix|Nice to have) \(\d+\)/g) ?? [];
await page.evaluate(() => window.scrollTo(0, 0));
await shot("fixlist-top");

// Export: the CSV header row.
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 15_000 }),
  page.getByRole("button", { name: "Download CSV" }).click(),
]);
const csvPath = `${outDir}/fix-list.csv`;
await download.saveAs(csvPath);
const csv = readFileSync(csvPath, "utf8");
checks.csvHeader = csv.split("\n")[0].trim().replaceAll('"', "");
checks.csvRows = csv.trim().split("\n").length - 1;

// Expanded row.
await page.getByRole("button", { name: "Show", exact: true }).first().click();
await page.getByText("How to fix").first().waitFor({ timeout: 5_000 });
await shot("fixlist-expanded", { fullPage: true });

// Done checkbox: tick, reload, still ticked; untick to leave no state behind.
const box = page.getByRole("checkbox", { name: /^Mark ".*" done$/ }).first();
const boxName = await box.getAttribute("aria-label");
await box.click();
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(4000);
const again = page.getByRole("checkbox", { name: boxName ?? "" });
checks.doneSurvivesReload =
  (await again.getAttribute("aria-checked")) === "true";
await again.click();

await page.getByRole("tab", { name: "Details" }).click();
await page.waitForTimeout(1500);
await shot("details", { fullPage: true });
await browser.close();

checks.pageErrors = errors;
const ok =
  checks.fixListDefault &&
  checks.scores &&
  checks.groups.length > 0 &&
  checks.csvHeader.startsWith("priority,categories,title") &&
  checks.csvRows > 0 &&
  checks.doneSurvivesReload &&
  errors.length === 0;
writeFileSync(
  `${outDir}/b14-shots.json`,
  `${JSON.stringify({ ok, ...checks }, null, 2)}\n`,
);
console.log(JSON.stringify({ ok, ...checks }, null, 2));
process.exit(ok ? 0 : 1);
