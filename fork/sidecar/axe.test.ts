import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { runAxe } from "./axe";

/**
 * WO-B26-004: a reveal animation (AOS-style fade from opacity 0) that the
 * full-page scroll starts must finish before axe reads colours, or axe
 * reports the blended mid-fade colour as low contrast.
 */
const page = (
  color: string,
) => `<!doctype html><html lang="en"><head><title>t</title>
<style>
  body { margin: 0; background: #fff; }
  .spacer { height: 3000px; }
  .reveal { opacity: 0; transition: opacity 1000ms linear; }
  .reveal.in { opacity: 1; }
</style></head><body><main>
  <h1>Reveal</h1><div class="spacer"></div>
  <p class="reveal" style="color: ${color}">Text that fades in when scrolled into view.</p>
</main><script>
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")));
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
</script></body></html>`;

async function contrastNodes(color: string) {
  const server = createServer((_, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(page(color));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const browser = await chromium.launch();
  try {
    const result = await runAxe(browser, {
      url: `http://127.0.0.1:${address.port}/`,
      viewport: "desktop",
    });
    return (
      result.violations.find((v) => v.id === "color-contrast")?.nodes.length ??
      0
    );
  } finally {
    await browser.close();
    server.close();
  }
}

describe.skipIf(!existsSync(chromium.executablePath()))("runAxe", () => {
  it("measures contrast after reveal animations finish", async () => {
    expect(await contrastNodes("#000")).toBe(0);
  }, 30_000);

  it("still reports text that is low contrast at rest", async () => {
    expect(await contrastNodes("#bbb")).toBe(1);
  }, 30_000);
});
