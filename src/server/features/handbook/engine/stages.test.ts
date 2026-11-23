import { describe, expect, it, vi } from "vitest";
import type {
  CollectedData,
  Collector,
  CollectorContext,
  CollectorKey,
} from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";
import { createMemoryEvidenceStore } from "./memory-evidence-store";
import {
  collectStage,
  createEvidenceStageStore,
  createMemoryStageTracker,
  planBatches,
  runStagedHandbook,
  runStageUnit,
  type StageContext,
  type StageEngine,
} from "./stages";

const robots = {
  status: "unavailable",
  reason: "fixture",
} satisfies CollectedData["robots"];

function engine(): StageEngine & { seen: Partial<CollectedData>[] } {
  const seen: Partial<CollectedData>[] = [];
  return {
    seen,
    collect: vi.fn(async (stage) => (stage === "crawl" ? { robots } : {})),
    evaluate: vi.fn(async (collected: Partial<CollectedData>) => {
      seen.push(collected);
    }),
    report: vi.fn(async () => {}),
  };
}

function context(overrides: Partial<StageContext> = {}): StageContext {
  return {
    tracker: createMemoryStageTracker(),
    store: createEvidenceStageStore(createMemoryEvidenceStore(), "p", "r"),
    startedAt: new Date("2026-11-18T00:00:00Z"),
    maxMinutes: 90,
    now: () => new Date("2026-11-18T00:10:00Z"),
    ...overrides,
  };
}

describe("staged run", () => {
  it("crawl runs as two units: pages first, then the probes on the stored pages", async () => {
    const ran: string[] = [];
    const fake = (key: CollectorKey): Collector<CollectorKey> => ({
      key,
      dependsOn: [],
      collect: async (_ctx, collected) => {
        ran.push(key);
        return key === "robots"
          ? robots
          : {
              status: "unavailable",
              reason: collected.robots ? "saw robots" : "no robots",
            };
      },
    });
    const collectors = [fake("robots"), fake("outbound")];
    const collectorCtx: CollectorContext = {
      runId: "r",
      origin: "https://example.com",
      fetch: () => Promise.reject(new Error("unused")),
      fetchOffsite: () => Promise.reject(new Error("unused")),
      storeBody: async (kind, url) => `${kind}:${url}`,
      log: () => {},
    };
    const tracker = createMemoryStageTracker();
    const run = engine();
    vi.mocked(run.collect).mockImplementation((stage, prior, batch) =>
      collectStage(collectors, collectorCtx, stage, prior, batch),
    );
    await runStagedHandbook(run, context({ tracker }));
    expect(ran).toEqual(["robots", "outbound"]);
    expect(tracker.rows.get("crawl:0")?.status).toBe("done");
    expect(tracker.rows.get("crawl:1")?.status).toBe("done");
    expect(run.seen[0]?.outbound).toEqual({
      status: "unavailable",
      reason: "saw robots",
    });
  });

  it("replaying finished stages is a no-op and checks reload stored facts", async () => {
    const ctx = context();
    const first = engine();
    await runStagedHandbook(first, ctx);
    expect(first.seen[0]?.robots).toEqual(robots);
    const replay = engine();
    await runStagedHandbook(replay, ctx);
    expect(replay.collect).not.toHaveBeenCalled();
    expect(replay.evaluate).not.toHaveBeenCalled();
    expect(replay.report).not.toHaveBeenCalled();
  });

  it("retries a failed unit with attempt + 1", async () => {
    const tracker = createMemoryStageTracker();
    const ctx = context({ tracker });
    const flaky = engine();
    vi.mocked(flaky.collect).mockRejectedValueOnce(new Error("sidecar 502"));
    const batches = planBatches({});
    await expect(
      runStageUnit("render", 0, batches, flaky, ctx),
    ).rejects.toThrow("sidecar 502");
    expect(tracker.rows.get("render:0")).toMatchObject({
      status: "failed",
      attempt: 1,
    });
    await runStageUnit("render", 0, batches, flaky, ctx);
    expect(tracker.rows.get("render:0")).toMatchObject({
      status: "done",
      attempt: 2,
    });
  });

  it("past the run cap skips the remaining collection stages and still reports", async () => {
    const tracker = createMemoryStageTracker();
    const late = engine();
    await runStagedHandbook(
      late,
      context({ tracker, now: () => new Date("2026-11-18T02:00:00Z") }),
    );
    expect(tracker.rows.get("render:0")?.status).toBe("skipped");
    expect(tracker.rows.get("map:0")?.status).toBe("skipped");
    expect(tracker.rows.get("checks:0")?.status).toBe("done");
    expect(late.report).toHaveBeenCalled();
    expect(late.seen[0]?.render).toEqual({
      status: "unavailable",
      reason: "run time cap",
    });
  });

  it("Lighthouse all: 60 live pages → 3 batches and the cap rises 0.6 min per page", async () => {
    const pages = {
      status: "ok",
      snapshots: Array.from({ length: 60 }, (_, i) => snapshot(`/p${i}`)),
    } satisfies CollectedData["pages"];
    const tracker = createMemoryStageTracker();
    const run = engine();
    vi.mocked(run.collect).mockImplementation(async (stage) =>
      stage === "crawl" ? { pages } : {},
    );
    // Minute 100: past the 90-min base cap, inside 90 + 60 × 0.6 = 126.
    await runStagedHandbook(
      run,
      context({
        tracker,
        lighthouse: "all",
        now: () => new Date("2026-11-18T01:40:00Z"),
      }),
    );
    expect(planBatches({ pages }, "all").lighthouse).toBe(3);
    expect(planBatches({ pages }).lighthouse).toBe(1);
    expect(
      [0, 1, 2].map((b) => tracker.rows.get(`lighthouse:${b}`)?.status),
    ).toEqual(["done", "done", "done"]);
  });

  it("a sidecar probe reason skips every browser unit with that reason; other stages run", async () => {
    const tracker = createMemoryStageTracker();
    const run = engine();
    const sidecarProbe = vi.fn(async () => "sidecar unreachable: ECONNREFUSED");
    await runStagedHandbook(run, context({ tracker, sidecarProbe }));
    for (const stage of ["render", "axe", "lighthouse"])
      expect(tracker.rows.get(`${stage}:0`)).toMatchObject({
        status: "skipped",
        error: "sidecar unreachable: ECONNREFUSED",
      });
    for (const stage of ["crawl", "map", "checks"])
      expect(tracker.rows.get(`${stage}:0`)?.status).toBe("done");
    expect(sidecarProbe).toHaveBeenCalledTimes(1);
    expect(run.seen[0]?.render).toEqual({
      status: "unavailable",
      reason: "sidecar unreachable: ECONNREFUSED",
    });
  });

  it("a usable sidecar at render batch 0 runs every browser unit and probes once", async () => {
    const tracker = createMemoryStageTracker();
    const sidecarProbe = vi.fn(async () => null);
    await runStagedHandbook(engine(), context({ tracker, sidecarProbe }));
    for (const stage of ["render", "axe", "lighthouse"])
      expect(tracker.rows.get(`${stage}:0`)?.status).toBe("done");
    expect(sidecarProbe).toHaveBeenCalledTimes(1);
  });
});
