import { describe, expect, it } from "vitest";
import type {
  CollectorContext,
  SafeFetch,
} from "@/server/features/handbook/contracts/collectors";
import {
  context,
  snapshot,
  statusOf,
} from "@/server/features/handbook/checks/check-test-fixtures";
import { resourceStatusCheck } from "@/server/features/handbook/checks/resource-status";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { resourcesCollector } from "./resources";

/** Every URL answers 404 (not transient, so no retry wait). */
const notFound: SafeFetch = async (url) => ({
  url,
  finalUrl: url,
  status: 404,
  headers: [],
  body: "",
  truncated: false,
  redirectChain: [],
  timingMs: 1,
});

const ctx: CollectorContext = {
  runId: "r1",
  origin: "https://example.com",
  fetch: notFound,
  fetchOffsite: notFound,
  storeBody: async (kind, url) => `${kind}:${url}`,
  log: () => {},
};

/** One page of `body` → resources collector → SUPP-20 check. */
async function brokenImages(body: string) {
  const url = "https://example.com/";
  const page = { ...snapshot("/"), images: extractHtmlFacts(body, url).images };
  const resources = await resourcesCollector.collect(ctx, {
    pages: { status: "ok", snapshots: [page] },
  });
  const result = await resourceStatusCheck.run(context({ resources }));
  return {
    status: statusOf(result, "SUPP-20"),
    detail: result.findings.map((f) => f.detail).join("\n"),
  };
}

describe("resources → SUPP-20 (WO-B25-001)", () => {
  it("does not probe a <noscript> tracking pixel", async () => {
    const result = await brokenImages(
      `<body><noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1&ev=PageView&noscript=1"></noscript></body>`,
    );
    expect(result.status).not.toBe("OPEN");
  });

  it("still reports a broken content image inside <noscript> (Showit)", async () => {
    const result = await brokenImages(
      `<body><noscript><img src="//static.showit.co/400/a/logo.png" class="se-img" alt="Logo"></noscript></body>`,
    );
    expect(result.status).toBe("OPEN");
    expect(result.detail).toContain("static.showit.co/400/a/logo.png");
  });

  it("still reports a 1×1 tracker image outside <noscript>", async () => {
    const result = await brokenImages(
      `<body><img height="1" width="1" src="https://www.facebook.com/tr?id=1"></body>`,
    );
    expect(result.status).toBe("OPEN");
  });

  it("still reports a visible broken image (salonvata)", async () => {
    const result = await brokenImages(
      `<body><img src="/wp-content/uploads/2016/07/vata-logo.png" alt="Vata"></body>`,
    );
    expect(result.status).toBe("OPEN");
  });
});

describe("resources → SUPP-20, lazy images (WO-B25-010)", () => {
  it("probes the data-src behind a data: placeholder src", async () => {
    const result = await brokenImages(
      `<body><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="https://example.com/missing.png" alt="x"></body>`,
    );
    expect(result.status).toBe("OPEN");
    expect(result.detail).toContain("https://example.com/missing.png");
  });

  it("reads data-lazy-src and data-original too", async () => {
    for (const attr of ["data-lazy-src", "data-original"]) {
      const result = await brokenImages(
        `<body><img src="about:blank" ${attr}="https://example.com/lazy.png"></body>`,
      );
      expect(result.detail).toContain("https://example.com/lazy.png");
    }
  });

  it("prefers an http src over data-src", async () => {
    const result = await brokenImages(
      `<body><img src="https://example.com/a.png" data-src="https://example.com/b.png"></body>`,
    );
    expect(result.detail).toContain("a.png");
    expect(result.detail).not.toContain("b.png");
  });
});
