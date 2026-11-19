import { expect, it, vi } from "vitest";
import {
  createRenderThrottle,
  createSidecarGate,
  SIDECAR_TIMEOUT,
  SIDECAR_UNAVAILABLE,
} from "./sidecar-per-url";

const isThrottled = (status: number) => status === 429;

it("renders one page at a time once the site has answered 429", async () => {
  vi.useFakeTimers();
  const retry = createRenderThrottle();
  let inFlight = 0;
  let maxInFlight = 0;
  let calls = 0;
  const render = async () => {
    const status = ++calls === 1 ? 429 : 200;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((done) => setTimeout(done, 100));
    inFlight -= 1;
    return status;
  };
  const first = retry(render, isThrottled);
  await vi.advanceTimersByTimeAsync(150);
  const rest = Array.from({ length: 3 }, () => retry(render, isThrottled));
  const done = Promise.all([first, ...rest]);
  await vi.runAllTimersAsync();
  expect(await done).toEqual([200, 200, 200, 200]);
  vi.useRealTimers();
  expect(maxInFlight).toBe(1);
});

it("after 3 sidecar timeouts in a row probes /health once, then resumes or gives up", async () => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const timeout = { ok: false, reason: SIDECAR_TIMEOUT } as const;
  const attempt = vi.fn(async () => timeout);
  const run = async (healthy: boolean) => {
    const gate = createSidecarGate("http://sidecar", async () => healthy);
    for (let i = 0; i < 3; i++) expect(await gate(attempt)).toEqual(timeout);
    const next = gate(async () => ({ ok: true, value: 1 }) as const);
    await vi.advanceTimersByTimeAsync(60_000);
    return next;
  };
  expect(await run(true)).toEqual({ ok: true, value: 1 });
  expect(await run(false)).toEqual({ ok: false, reason: SIDECAR_UNAVAILABLE });
  vi.useRealTimers();
});
