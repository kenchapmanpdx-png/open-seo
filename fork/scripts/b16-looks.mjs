// B16 WO-B16-005: screenshots of each fork look (upstream / a / b / c) in light
// and dark on the pages Ken uses, plus a contact sheet `looks.html`.
// Usage: node fork/scripts/b16-looks.mjs [base] [projectId] [outDir]
//   base defaults to http://127.0.0.1:4022; projectId = the landing project.
// The look is previewed with `?look=`; the theme with the upstream
// `theme-preference` localStorage key. Exit 1 on page errors.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [
  base = "http://127.0.0.1:4022",
  projectArg,
  outDir = "fork/runs/b16/looks",
] = process.argv.slice(2);
const LOOKS = ["upstream", "a", "b", "c"];
const THEMES = ["light", "dark"];
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function openPage(theme) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(
    (t) => window.localStorage.setItem("theme-preference", t),
    theme,
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  return page;
}

// Project and latest completed run from the Handbook page.
const probe = await openPage("light");
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
  ["dashboard", ""],
  ["check", "handbook/check"],
  ["handbook", "handbook"],
  ...(runHref ? [["fixlist", runHref.replace(/^\/p\/[^/]+\//, "")]] : []),
];

const shots = [];
for (const theme of THEMES) {
  const page = await openPage(theme);
  for (const look of LOOKS) {
    for (const [name, path] of PAGES) {
      const sep = path.includes("?") ? "&" : "?";
      await page.goto(`${base}/p/${projectId}/${path}${sep}look=${look}`, {
        waitUntil: "load",
      });
      await page.waitForTimeout(3500);
      const file = `${name}-${look}-${theme}.png`;
      await page.screenshot({ path: `${outDir}/${file}` });
      shots.push({ name, look, theme, file });
      if (name === "fixlist") {
        const show = page.getByRole("button", { name: "Show", exact: true });
        if (await show.count()) {
          await show.first().click();
          await page.waitForTimeout(800);
          const open = `fixlist-open-${look}-${theme}.png`;
          await page.screenshot({ path: `${outDir}/${open}`, fullPage: true });
          shots.push({ name: "fixlist-open", look, theme, file: open });
        }
      }
    }
  }
  await page.context().close();
}
await browser.close();

const names = [...new Set(shots.map((s) => s.name))];
const cell = (name, look, theme) => {
  const s = shots.find(
    (x) => x.name === name && x.look === look && x.theme === theme,
  );
  return s
    ? `<td><a href="${s.file}"><img src="${s.file}" loading="lazy"></a></td>`
    : "<td></td>";
};
const html = `<!doctype html><meta charset="utf-8"><title>B16 looks</title>
<style>body{font:14px system-ui;margin:16px}td,th{padding:4px;vertical-align:top}img{width:340px;border:1px solid #ccc}</style>
<h1>Pick a look</h1><p>Columns: upstream, A, B, C. Click a picture for full size. To try one live, add <code>?look=a</code> (or b, c, upstream) to any app URL.</p>
${names
  .map(
    (name) =>
      `<h2>${name}</h2><table><tr><th></th>${LOOKS.map((l) => `<th>${l}</th>`).join("")}</tr>${THEMES.map(
        (t) =>
          `<tr><th>${t}</th>${LOOKS.map((l) => cell(name, l, t)).join("")}</tr>`,
      ).join("")}</table>`,
  )
  .join("\n")}`;
writeFileSync(`${outDir}/looks.html`, html);
console.log(
  JSON.stringify({ projectId, run: runHref, shots: shots.length, errors }),
);
process.exit(errors.length ? 1 : 0);
