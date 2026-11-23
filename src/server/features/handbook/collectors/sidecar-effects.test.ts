import { describe, expect, it, vi } from "vitest";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import { renderResponseSchema } from "@/server/features/handbook/contracts/sidecar";
import { robotsBlockedEffect, withRestartRetry } from "./sidecar-effects";

describe("withRestartRetry (WO-B19-016)", () => {
  it("retries once after the sidecar dropped the connection and is healthy again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })),
    );
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        reason: "sidecar /lighthouse unreachable: Network connection lost.",
      })
      .mockResolvedValueOnce({ ok: true, value: 1 });
    const pending = withRestartRetry(attempt, "http://sidecar", () => {});
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ ok: true, value: 1 });
    expect(attempt).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not retry a timeout or an HTTP error", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: "sidecar /lighthouse 500: x" });
    await withRestartRetry(attempt, "http://sidecar", () => {});
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

describe("robotsBlockedEffect (P3-20 by effect)", () => {
  const blockedUrl = "https://a.test/api/census";
  const response = (body: string) =>
    renderResponseSchema.parse({
      finalUrl: "https://a.test/",
      status: 200,
      html: `<html><body><main>${body}</main></body></html>`,
      screenshotPng: null,
      consoleErrors: [],
      requests: [{ url: blockedUrl, resourceType: "xhr", status: 200 }],
      mediaElements: [],
      opacityZeroWords: 0,
      firstScreenActions: [],
      timingMs: 0,
    });
  const robots: CollectedData["robots"] = {
    status: "ok",
    decisions: [],
    hosts: [
      {
        host: "a.test",
        status: 200,
        storageKey: null,
        sitemaps: [],
        parseWarnings: [],
        groups: [
          { userAgents: ["*"], rules: [{ type: "disallow", path: "/api/" }] },
        ],
      },
    ],
  };
  const page = (body: string) => ({
    ok: true as const,
    value: response(body),
  });
  const steady = "Our technicians repair furnaces across Chicago every day.";

  it("ignores text that also changes between two normal renders (aircor review widget)", async () => {
    const normal = `${steady} Reviews say the staff was kind and on time.`;
    const renders: Record<string, string> = {
      blocked: `${steady} Reviews say the crew was fast and tidy.`,
      control: `${steady} Reviews say the price was fair and clear.`,
    };
    const effect = await robotsBlockedEffect(
      async (abort) => page(renders[abort.length ? "blocked" : "control"]),
      response(normal),
      normal,
      robots,
    );
    expect(effect?.sameContent).toBe(true);
  });

  it("keeps a change when the missing text is stable across normal renders", async () => {
    const full = `${steady} Free estimates on every new system install.`;
    const effect = await robotsBlockedEffect(
      async (abort) => page(abort.length ? steady : full),
      response(full),
      full,
      robots,
    );
    expect(effect?.sameContent).toBe(false);
    expect(effect?.missing).toEqual([
      "Free estimates on every new system install.",
    ]);
  });
});
