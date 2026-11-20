import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowStep } from "cloudflare:workers";
import { HandbookLeaseRepository } from "@/server/features/handbook/repositories/HandbookLeaseRepository";
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
  HandbookRepository: {
    getProjectSetting: vi.fn(),
    listCrawledUrls: vi.fn(),
    getRun: vi.fn(),
  },
}));
vi.mock(
  "@/server/features/handbook/repositories/HandbookLeaseRepository",
  () => ({
    HandbookLeaseRepository: {
      acquire: vi.fn(),
      renew: vi.fn(),
      release: vi.fn(),
    },
  }),
);
vi.mock("@/server/features/handbook/services/HandbookRunService", () => ({
  HandbookRunService: {
    startRun: vi.fn(),
    planRun: vi.fn(),
    runStage: vi.fn(),
    failRun: vi.fn(),
  },
}));

const sleep = vi.fn();
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- steps run directly through the pgStep mock
const step = { sleep } as unknown as WorkflowStep;
const enabled = {
  projectId: "p1",
  enabled: true,
  mode: "AUDIT" as const,
  tierOverride: null,
  copyQuality: false,
  serpOriginality: false,
  updatedAt: "",
};
// Only `status` is read by the run-status guard.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const run = (status: string) => ({ status }) as never;
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
    vi.mocked(HandbookLeaseRepository.acquire).mockResolvedValue(true);
    vi.mocked(HandbookRepository.getRun).mockResolvedValue(run("running"));
  });

  it("does nothing when the project flag is off", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue({
      ...enabled,
      enabled: false,
    });
    await runHandbookPhase(step, params);
    expect(HandbookRunService.startRun).not.toHaveBeenCalled();
  });

  it("runs a project without a settings row in AUDIT mode (default on)", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue(null);
    await runHandbookPhase(step, params);
    expect(HandbookRunService.startRun).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "AUDIT", tierOverride: null }),
    );
  });

  it("runs with a per-audit run id and swallows engine failures", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue(enabled);
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

  it("waits queued while another run holds the lease, then runs and releases", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue(enabled);
    vi.mocked(HandbookLeaseRepository.acquire)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    await runHandbookPhase(step, params);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(HandbookRunService.runStage).toHaveBeenCalled();
    expect(HandbookLeaseRepository.release).toHaveBeenCalledWith("hb-a1");
  });

  it("stops a run the reconciler already finished, without writing", async () => {
    vi.mocked(HandbookRepository.getProjectSetting).mockResolvedValue(enabled);
    vi.mocked(HandbookRepository.getRun)
      .mockResolvedValueOnce(run("running"))
      .mockResolvedValue(run("failed"));
    await expect(runHandbookPhase(step, params)).resolves.toBeUndefined();
    expect(HandbookLeaseRepository.acquire).toHaveBeenCalledTimes(1);
    expect(HandbookRunService.runStage).not.toHaveBeenCalled();
    expect(HandbookRunService.failRun).not.toHaveBeenCalled();
  });
});
