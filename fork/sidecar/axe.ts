import type { Browser, Page } from "@playwright/test";
import type { z } from "zod";
import type {
  axeRequestSchema,
  AxeResponse,
} from "../../src/server/features/handbook/contracts/sidecar";
import { scrollToEnd, VIEWPORTS } from "./render";

/**
 * axe-core via @axe-core/playwright after a full-page scroll (handbook §8:
 * lazy sections must be in the DOM). The module is loaded at runtime from
 * the sidecar's own package (not a root dependency).
 */
type AxeBuilderCtor = new (opts: { page: Page }) => {
  analyze(): Promise<{
    testEngine: { version: string };
    violations: AxeResponse["violations"];
  }>;
};

const AXE_MODULE = "@axe-core/playwright";

export async function runAxe(
  browser: Browser,
  req: z.output<typeof axeRequestSchema>,
): Promise<AxeResponse> {
  const mod: unknown = await import(AXE_MODULE);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- runtime-only sidecar dependency, not installed at the repo root
  const { default: AxeBuilder } = mod as { default: AxeBuilderCtor };
  const context = await browser.newContext(VIEWPORTS[req.viewport]);
  try {
    const page = await context.newPage();
    await page.goto(req.url, { waitUntil: "load", timeout: 30_000 });
    await scrollToEnd(page);
    const result = await new AxeBuilder({ page }).analyze();
    return {
      url: page.url(),
      axeVersion: result.testEngine.version,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact ?? null,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n) => ({
          target: n.target.map(String),
          html: n.html.slice(0, 1000),
        })),
      })),
    };
  } finally {
    await context.close();
  }
}
