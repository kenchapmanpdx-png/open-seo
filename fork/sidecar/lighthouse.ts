import { cpus } from "node:os";
import { chromium } from "@playwright/test";
import type {
  LighthouseRequest,
  LighthouseResponse,
} from "../../src/server/features/handbook/contracts/sidecar";

/**
 * Lighthouse node API against a dedicated Chromium with a debugging port
 * (mobile default). Lab TBT depends on host CPU, so `environment` records
 * it. The module is loaded at runtime from the sidecar's own package.
 */
type LhResult = {
  lhr: {
    lighthouseVersion: string;
    categories: Record<string, { score: number | null } | undefined>;
    audits: Record<
      string,
      | {
          numericValue?: number;
          details?: { items?: { node?: { snippet?: string } }[] };
        }
      | undefined
    >;
  };
};
type Lighthouse = (
  url: string,
  flags: Record<string, unknown>,
) => Promise<LhResult | undefined>;

const LH_MODULE = "lighthouse";
const PORT = 9333;

const DESKTOP = {
  formFactor: "desktop",
  screenEmulation: {
    mobile: false,
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    disabled: false,
  },
};

export async function runLighthouse(
  req: LighthouseRequest,
): Promise<LighthouseResponse> {
  const mod: unknown = await import(LH_MODULE);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- runtime-only sidecar dependency, not installed at the repo root
  const { default: lighthouse } = mod as { default: Lighthouse };
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${PORT}`],
  });
  try {
    const result = await lighthouse(req.url, {
      port: PORT,
      output: "json",
      logLevel: "error",
      ...(req.formFactor === "desktop" ? DESKTOP : { formFactor: "mobile" }),
    });
    if (!result) throw new Error("lighthouse returned no result");
    const { lhr } = result;
    const score = (id: string) => lhr.categories[id]?.score ?? null;
    const metric = (id: string) => lhr.audits[id]?.numericValue ?? null;
    return {
      url: req.url,
      lighthouseVersion: lhr.lighthouseVersion,
      environment: `${cpus()[0]?.model ?? "unknown CPU"} ×${cpus().length}; chromium ${browser.version()}`,
      categories: {
        performance: score("performance"),
        accessibility: score("accessibility"),
        bestPractices: score("best-practices"),
        seo: score("seo"),
      },
      metrics: {
        lcpMs: metric("largest-contentful-paint"),
        cls: metric("cumulative-layout-shift"),
        tbtMs: metric("total-blocking-time"),
        fcpMs: metric("first-contentful-paint"),
      },
      lcpElement:
        lhr.audits["largest-contentful-paint-element"]?.details?.items?.[0]
          ?.node?.snippet ?? null,
      report: lhr,
    };
  } finally {
    await browser.close();
  }
}
