import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowStep } from "cloudflare:workers";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import { HandbookRunService } from "@/server/features/handbook/services/HandbookRunService";
import { runHandbookPhase } from "./hook";

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/server/workflows/pgStep", () => ({
  pgStep: (
    _step: unknown,
    _name: string,
    _config: unknown,
    fn: () => Promise<unknown>,
  ) => fn(),
}));
vi.mock("@/server/features/handbook/repositories/HandbookRepository", () => ({
  HandbookRepository: { getProjectSetting: vi.fn(), listCrawledUrls: vi.fn() },
}));
vi.mock("@/server/features/handbook/services/HandbookRunService", () => ({
  HandbookRunService: {
    startRun: vi.fn(),
    planRun: vi.fn(),
    runStage: vi.fn(),
    failRun: vi.fn(),
  },
}));

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- steps run directly through the pgStep mock
const step = {} as WorkflowStep;
const params = {
  auditId: "a1",
  projectId: "p1",
  startUrl: "https://example.com/start",
};

describe("runHandbookPhase", () => {
  beforeEach(() => {
    vi.mocked(HandbookRepository.listCrawledUrls).mockResolvedValue([
      "https://example.com/",
    ]);
    vi.mocked(HandbookRunService.startRun).mockResolvedValue(
      "2026-11-18T00:00:00Z",
    );
    vi.mocked(HandbookRunService.runStage).mockResolvedValue("done");
  });

  it("does nothing when the project flag is off", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue(null);
    await runHandbookPhase(step, params);
    expect(HandbookRunService.startRun).not.toHaveBeenCalled();
  });

  it("runs with a per-audit run id and swallows engine failures", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue({
      projectId: "p1",
      enabled: true,
      mode: "AUDIT",
      tierOverride: null,
      updatedAt: "",
    });
    vi.mocked(HandbookRunService.runStage).mockRejectedValue(new Error("boom"));
    await expect(runHandbookPhase(step, params)).resolves.toBeUndefined();
    expect(HandbookRunService.runStage).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "hb-a1",
        origin: "https://example.com",
        seedUrls: ["https://example.com/"],
      }),
      "crawl",
      0,
      expect.anything(),
    );
    expect(HandbookRunService.failRun).toHaveBeenCalled();
  });
});
