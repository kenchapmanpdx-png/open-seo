// B16 WO-B16-090 step 4: axe color-contrast on the four novice pages in one
// look, light and dark. axe-core is not an app dependency: pass the path to
// `axe.min.js` (copied from the sidecar image:
// `docker cp sidecar-sidecar-1:/app/node_modules/axe-core/axe.min.js /tmp/`).
// Usage: node fork/scripts/b16-axe.mjs <axe.min.js> [base] [projectId] [look]
// Prints one line per page × theme; exit 1 on any contrast violation.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [axePath, base = "http://127.0.0.1:3001", projectArg, look = "c"] =
  process.argv.slice(2);
if (!axePath) throw new Error("pass the path to axe.min.js");
const axeSource = readFileSync(axePath, "utf8");

const browser = await chromium.launch();
const open = async (theme) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(
    (t) => window.localStorage.setItem("theme-preference", t),
    theme,
  );
  return context.newPage();
};

const probe = await open("light");
let projectId = projectArg;
if (!projectId) {
  await probe.goto(`${base}/`, { waitUntil: "load" });
  await probe.waitForTimeout(5000);
  projectId = probe.url().match(/\/p\/([^/?#]+)/)?.[1];
}
if (!projectId) throw new Error("no project found; pass a projectId");
await probe.goto(`${base}/p/${projectId}/handbook`, { waitUntil: "load" });
await probe.waitForTimeout(5000);
const runHref = await probe
  .getByRole("link", { name: /open full results/ })
  .first()
  .getAttribute("href")
  .catch(() => null);
await probe.context().close();

const PAGES = [
  ["dashboard", `/p/${projectId}`],
  ["check", `/p/${projectId}/handbook/check`],
  ["handbook", `/p/${projectId}/handbook`],
  ...(runHref ? [["fixlist", runHref]] : []),
];

let violations = 0;
for (const theme of ["light", "dark"]) {
  for (const [name, path] of PAGES) {
    const page = await open(theme);
    await page.goto(`${base}${path}?look=${look}`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, {
        runOnly: { type: "rule", values: ["color-contrast"] },
      });
      return r.violations.flatMap((v) =>
        v.nodes.map((n) => ({
          target: n.target.join(" "),
          summary: n.failureSummary?.split("\n").slice(-1)[0] ?? "",
        })),
      );
    });
    violations += result.length;
    console.log(
      `${result.length ? "FAIL" : "OK  "} ${name} ${theme} look=${look}: ${result.length} contrast violation(s)`,
    );
    for (const v of result.slice(0, 8))
      console.log(`     ${v.target} — ${v.summary.slice(0, 160)}`);
    await page.context().close();
  }
}
await browser.close();
process.exit(violations ? 1 : 0);
