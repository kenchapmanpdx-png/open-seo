import { afterEach, describe, expect, it, vi } from "vitest";
import { handbookEnabled } from "./handbookDefaults";

vi.mock("cloudflare:workers", () => ({ env: {} }));

describe("handbookEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { row: { enabled: true }, env: "0", expected: true },
    { row: { enabled: false }, env: undefined, expected: false },
    { row: null, env: undefined, expected: true },
    { row: null, env: "1", expected: true },
    { row: null, env: "0", expected: false },
  ])("row $row, env $env → $expected", async ({ row, env, expected }) => {
    if (env !== undefined) vi.stubEnv("HANDBOOK_DEFAULT_ENABLED", env);
    expect(await handbookEnabled(row)).toBe(expected);
  });
});
