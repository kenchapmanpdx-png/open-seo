import { describe, expect, it, vi } from "vitest";
import { withRestartRetry } from "./sidecar-effects";

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
