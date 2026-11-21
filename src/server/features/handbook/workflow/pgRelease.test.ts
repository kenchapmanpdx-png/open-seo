import { beforeEach, describe, expect, it, vi } from "vitest";
import { withStepRelease } from "./pgRelease";

const env = vi.hoisted(() => ({}) as Record<string, string>);
const end = vi.hoisted(() => vi.fn());

vi.mock("cloudflare:workers", () => ({ env }));
vi.mock("@/db/provider", () => ({ getDatabaseProvider: () => "postgres" }));
vi.mock("@/db", () => ({ db: { $client: Object.assign(() => {}, { end }) } }));

describe("withStepRelease", () => {
  beforeEach(() => {
    delete env.PG_STEP_RELEASE;
    end.mockResolvedValue(undefined);
  });

  it("ends the step client after the body returns", async () => {
    await expect(withStepRelease(async () => "ok")).resolves.toBe("ok");
    expect(end).toHaveBeenCalledWith({ timeout: 5 });
  });

  it("ends the step client when the body throws", async () => {
    await expect(
      withStepRelease(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(end).toHaveBeenCalledOnce();
  });

  it("keeps the client open when PG_STEP_RELEASE=0", async () => {
    env.PG_STEP_RELEASE = "0";
    await withStepRelease(async () => "ok");
    expect(end).not.toHaveBeenCalled();
  });
});
