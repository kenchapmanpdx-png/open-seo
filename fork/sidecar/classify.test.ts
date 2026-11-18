import { describe, expect, it } from "vitest";
import { renderResponseSchema } from "../../src/server/features/handbook/contracts/sidecar";
import { classifyRequest, maxRendersFromEnv } from "./classify";

describe("classifyRequest", () => {
  it("aborts analytics beacons only when blockBeacons is on", () => {
    const ga = "https://www.google-analytics.com/g/collect?v=2&tid=G-X";
    expect(classifyRequest(ga, "fetch", true)).toBe("beacon");
    expect(classifyRequest(ga, "fetch", false)).toBeNull();
  });

  it("aborts a first-party GA4 collect proxy but never the page document", () => {
    expect(
      classifyRequest("https://site.example/g/collect?v=2", "fetch", true),
    ).toBe("beacon");
    expect(
      classifyRequest("https://site.example/collect", "document", true),
    ).toBeNull();
  });

  it("aborts media bodies even with beacons allowed", () => {
    expect(
      classifyRequest("https://cdn.example/hero.mp4?v=1", "other", false),
    ).toBe("media");
    expect(classifyRequest("https://cdn.example/stream", "media", false)).toBe(
      "media",
    );
  });

  it("lets ordinary site assets through", () => {
    expect(
      classifyRequest("https://site.example/app.js", "script", true),
    ).toBeNull();
    expect(
      classifyRequest("https://fonts.gstatic.com/a.woff2", "font", true),
    ).toBeNull();
  });
});

describe("maxRendersFromEnv", () => {
  it("defaults to 3 and accepts 1…8", () => {
    expect(maxRendersFromEnv(undefined)).toBe(3);
    expect(maxRendersFromEnv("2")).toBe(2);
    expect(maxRendersFromEnv("0")).toBe(3);
    expect(maxRendersFromEnv("many")).toBe(3);
  });
});

describe("K3 1.2.0 render response", () => {
  it("still accepts a 1.1.0 response without the new fields", () => {
    const parsed = renderResponseSchema.safeParse({
      finalUrl: "https://site.example/",
      status: 200,
      html: "<html></html>",
      screenshotPng: null,
      consoleErrors: [],
      requests: [
        { url: "https://site.example/", resourceType: "document", status: 200 },
      ],
      opacityZeroWords: 0,
      firstScreenActions: [],
      timingMs: 10,
    });
    expect(parsed.success).toBe(true);
  });
});
