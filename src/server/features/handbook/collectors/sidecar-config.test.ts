import { describe, expect, it, vi } from "vitest";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import { probeSidecar, sidecarConfigFromEnv } from "./sidecar-config";

const env = {
  token: "t0k3n-0123456789abcdef",
  url: undefined,
  lighthouse: "all",
  concurrency: "2",
};
const config = sidecarConfigFromEnv(env, "full");

const health = (contractsVersion = CONTRACTS_VERSION) =>
  Response.json({ ok: true, version: "1", chromium: "1", contractsVersion });

/** fetch stub: /health → `healthRes`, /token-check → `tokenStatus`. */
function stub(healthRes: () => Promise<Response>, tokenStatus = 404) {
  return vi.fn(async (url: string | URL | Request) =>
    String(url).endsWith("/health")
      ? healthRes()
      : new Response(null, { status: tokenStatus }),
  ) as unknown as typeof fetch;
}

describe("sidecarConfigFromEnv", () => {
  it("null without a token; otherwise carries depth, lighthouse and concurrency on the default URL", () => {
    expect(sidecarConfigFromEnv({ ...env, token: undefined }, "full")).toBe(
      null,
    );
    expect(config).toEqual({
      url: "http://127.0.0.1:4777",
      token: env.token,
      depth: "full",
      lighthouse: "all",
      concurrency: 2,
    });
  });
});

describe("probeSidecar", () => {
  it("token missing", async () => {
    expect(await probeSidecar(null)).toBe("sidecar token not set");
  });

  it("health timeout → unreachable", async () => {
    const timeout = stub(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    expect(await probeSidecar(config, timeout)).toBe(
      "sidecar unreachable: timeout after 3 s",
    );
  });

  it("contracts mismatch", async () => {
    expect(
      await probeSidecar(
        config,
        stub(async () => health("0.9.0")),
      ),
    ).toBe(`sidecar contracts 0.9.0 ≠ app ${CONTRACTS_VERSION}`);
  });

  it("401 on the token check → rejected; any other status → usable", async () => {
    expect(
      await probeSidecar(
        config,
        stub(async () => health(), 401),
      ),
    ).toBe("sidecar token rejected");
    expect(
      await probeSidecar(
        config,
        stub(async () => health(), 404),
      ),
    ).toBe(null);
  });
});
