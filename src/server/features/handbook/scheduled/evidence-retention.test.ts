import { describe, expect, it, vi } from "vitest";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { createEvidenceRetentionJob } from "./evidence-retention";

vi.mock("cloudflare:workers", () => ({ env: {} }));

const run = (id: string, projectId: string, day: number, finished = true) => ({
  id,
  projectId,
  startedAt: `2026-11-${String(day).padStart(2, "0")} 00:00:00`,
  finishedAt: finished ? "x" : null,
  hasBodies: true,
});

describe("evidence retention job", () => {
  it("keeps bodies for the 2 newest runs per project and warns at 80 % quota", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createMemoryEvidenceStore();
    const deleteRun = vi.spyOn(store, "deleteRun");
    const clearStorageKeys = vi.fn(async () => {});
    const job = createEvidenceRetentionJob(async () => ({
      store,
      listRuns: async () => [
        run("a1", "A", 1),
        run("a2", "A", 2),
        run("a3", "A", 3),
        run("a4", "A", 4),
        run("b1", "B", 1),
      ],
      clearStorageKeys,
      readUsageBytes: async () => 0.85 * 1024 ** 3,
    }));

    expect(await job.run()).toMatchObject({ pruned: 2, warn: true });
    expect(deleteRun.mock.calls).toEqual([
      ["A", "a1"],
      ["A", "a2"],
    ]);
    expect(clearStorageKeys.mock.calls).toEqual([["a1"], ["a2"]]);
    const status = await store.get("_status/storage.json");
    expect(JSON.parse(new TextDecoder().decode(status!))).toMatchObject({
      warn: true,
    });
  });
});
