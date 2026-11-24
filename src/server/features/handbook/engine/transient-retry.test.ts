import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./transient-retry";

const noWait = async () => {};

describe("withRetry (ADR-035 c)", () => {
  it("keeps the result when a transient failure is followed by success", async () => {
    const attempt = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(503)
      .mockResolvedValueOnce(200);
    const result = await withRetry(attempt, {
      tries: 3,
      retryable: (s) => s >= 500,
      wait: noWait,
    });
    expect(result).toBe(200);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("returns the last result after the last try, and stops when wait says so", async () => {
    const always503 = vi.fn(async () => 503);
    const policy = { tries: 3, retryable: () => true, wait: noWait };
    await expect(withRetry(always503, policy)).resolves.toBe(503);
    expect(always503).toHaveBeenCalledTimes(3);
    const stopped = vi.fn(async () => 503);
    await withRetry(stopped, { ...policy, wait: async () => false });
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it("retries a thrown error only when retryThrown is set", async () => {
    const flaky = () =>
      vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce("ok");
    const policy = { tries: 2, retryable: () => false, wait: noWait };
    await expect(
      withRetry(flaky(), { ...policy, retryThrown: true }),
    ).resolves.toBe("ok");
    await expect(withRetry(flaky(), policy)).rejects.toThrow("ECONNRESET");
  });
});

// Every wait in the Handbook is either a withRetry policy or one of these
// (a pacer or a timeout is not a retry). A new retry loop written with its
// own setTimeout fails here: put it on withRetry instead.
const SET_TIMEOUT_ALLOWED: Record<string, string> = {
  "engine/transient-retry.ts": "the shared sleep",
  "engine/safe-fetch.ts": "per-host politeness pacer, not a retry",
  "collectors/bot-fetch.ts": "bot-parity pacer, not a retry",
  "collectors/sidecar-per-url.ts":
    "shared render throttle and sidecar circuit breaker (state across pages)",
  "llm/serp-originality-collect.ts": "fetch timeout race",
  "ops/health.ts": "health check timeout race",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sourceFiles(join(dir, e.name))
      : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")
        ? [join(dir, e.name)]
        : [],
  );
}

describe("retry loops (WO-B20-015 c)", () => {
  it("wait with setTimeout only in the allow-listed files", () => {
    const root = join(import.meta.dirname, "..");
    const offenders = sourceFiles(root)
      .filter((f) => readFileSync(f, "utf8").includes("setTimeout("))
      .map((f) => relative(root, f))
      .filter((f) => !(f in SET_TIMEOUT_ALLOWED));
    expect(offenders).toEqual([]);
  });
});
