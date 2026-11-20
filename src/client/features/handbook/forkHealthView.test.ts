import { describe, expect, it } from "vitest";
import type { ForkHealth } from "@/server/features/handbook/ops/health";
import { chipView, runButtonView } from "./forkHealthView";

const health = (
  checks: Partial<ForkHealth["checks"]> = {},
  extra: Partial<ForkHealth> = {},
): ForkHealth => ({
  ok: true,
  checkedAt: "2026-11-20T00:00:00Z",
  testMode: false,
  checks: {
    db: { ok: true, ms: 5, serverConns: 3, error: null },
    sidecar: { ok: true, version: "1.7.0", reason: null },
    llm: { configured: true },
    cron: { state: "ok", lastTickAt: null, ageSec: 10 },
    handbook: { leaseHolder: null, beatAgeSec: null, interrupted24h: 0 },
    audits: { running: 0 },
    ...checks,
  },
  watchdog: null,
  ...extra,
});
const dbDown = {
  db: { ok: false, ms: null, serverConns: null, error: "timeout after 5 s" },
};
const sidecarDown = {
  sidecar: { ok: false, version: null, reason: "sidecar unreachable" },
};

describe("chipView", () => {
  it("is green when every check passes, with the test-mode label", () => {
    expect(chipView(health({}, { testMode: true }))).toMatchObject({
      tone: "green",
      testMode: true,
    });
  });

  it("is red on a database failure, before any other failure", () => {
    expect(chipView(health({ ...dbDown, ...sidecarDown }))).toMatchObject({
      tone: "red",
      label: "Database not reachable",
    });
  });

  it("is amber with the first failing check and its fix", () => {
    const view = chipView(
      health({ ...sidecarDown, llm: { configured: false } }),
    );
    expect(view).toMatchObject({
      tone: "amber",
      label: "Browser helper is off",
    });
    expect(view.fix).toContain("ops sidecar start");
  });
});

describe("runButtonView", () => {
  it("disables the button on a database failure and shows why", () => {
    expect(runButtonView(health(dbDown)).disabledReason).toBe(
      "Database not reachable: timeout after 5 s.",
    );
  });

  it("names the check groups a missing helper, key or test mode affect", () => {
    const view = runButtonView(
      health(
        { ...sidecarDown, llm: { configured: false } },
        { testMode: true },
      ),
    );
    expect(view.disabledReason).toBeNull();
    expect(view.warnings).toEqual([
      expect.stringContaining("browser render, accessibility and Lighthouse"),
      expect.stringContaining("AI-judged items"),
      expect.stringContaining("Test mode is on"),
    ]);
  });
});
