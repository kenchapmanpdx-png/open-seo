import { afterEach, describe, expect, it, vi } from "vitest";
import { createSidecar, SIDECAR_VERSION, type Engines } from "./server";

const unused = () => Promise.reject(new Error("engine not stubbed"));
const engines: Engines = {
  chromium: async () => "stub-chromium",
  render: unused,
  axe: unused,
  lighthouse: unused,
};

let close: (() => void) | undefined;
afterEach(() => close?.());

async function start(
  overrides: Partial<Parameters<typeof createSidecar>[0]> = {},
) {
  const server = createSidecar({
    token: "t",
    allowPrivate: false,
    engines,
    resolve: async () => ["10.0.0.5"],
    ...overrides,
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  close = () => server.close();
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const { port } = address;
  return (path: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      method: body ? "POST" : "GET",
      headers: { authorization: "Bearer t" },
      body: body ? JSON.stringify(body) : undefined,
    });
}

const renderBody = {
  url: "https://private.example/",
  javascript: true,
  viewport: "mobile",
  screenshot: "none",
  scrollToEnd: false,
};

describe("sidecar server", () => {
  it("reports its version and chromium on /health", async () => {
    const call = await start();
    const res = await call("/health");
    expect(await res.json()).toMatchObject({
      ok: true,
      version: SIDECAR_VERSION,
      chromium: "stub-chromium",
    });
  });

  it("rejects a /render body that fails the K3 schema with 400", async () => {
    const call = await start();
    const res = await call("/render", { ...renderBody, viewport: "tablet" });
    expect(res.status).toBe(400);
  });

  it("refuses a target that resolves to a private address with 422", async () => {
    const call = await start();
    const res = await call("/render", renderBody);
    expect(res.status).toBe(422);
    expect(await res.json()).toHaveProperty("error");
  });

  it("answers 504 past the deadline and exits on the second miss", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "Date"],
    });
    const exit = vi.fn();
    let started: (() => void) | undefined;
    const call = await start({
      allowPrivate: true,
      engines: {
        ...engines,
        render: () => {
          started?.();
          return new Promise(() => {});
        },
      },
      exit,
      log: () => {},
    });
    const missOnce = async () => {
      const reached = new Promise<void>((r) => (started = r));
      const res = call("/render", { ...renderBody, timeoutMs: 1000 });
      await reached;
      await vi.advanceTimersByTimeAsync(61_000);
      return (await res).status;
    };
    expect(await missOnce()).toBe(504);
    expect(exit).not.toHaveBeenCalled();
    expect(await missOnce()).toBe(504);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(exit).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
