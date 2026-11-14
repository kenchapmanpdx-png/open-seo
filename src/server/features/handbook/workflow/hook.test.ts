import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowStep } from "cloudflare:workers";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import { HandbookService } from "@/server/features/handbook/services/HandbookService";
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
  HandbookRepository: { getProjectSetting: vi.fn() },
}));
vi.mock("@/server/features/handbook/services/HandbookService", () => ({
  HandbookService: { listCrawledUrls: vi.fn(), executeRun: vi.fn() },
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
    vi.mocked(HandbookService.listCrawledUrls).mockResolvedValue([
      "https://example.com/",
    ]);
  });

  it("does nothing when the project flag is off", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue(null);
    await runHandbookPhase(step, params);
    expect(HandbookService.executeRun).not.toHaveBeenCalled();
  });

  it("runs with a per-audit run id and swallows engine failures", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue({
      projectId: "p1",
      enabled: true,
      mode: "AUDIT",
      tierOverride: null,
      updatedAt: "",
    });
    vi.mocked(HandbookService.executeRun).mockRejectedValue(new Error("boom"));
    await expect(runHandbookPhase(step, params)).resolves.toBeUndefined();
    expect(HandbookService.executeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "hb-a1",
        origin: "https://example.com",
        seedUrls: ["https://example.com/"],
      }),
    );
  });
});
