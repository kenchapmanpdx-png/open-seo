import { expect, it, vi } from "vitest";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import type { PageMapper } from "../llm/map";
import { collectRunUnit } from "./map-stage";
import type { HandbookRuntime, RunInput } from "./runner";

const llmsFile = (n: number) => ({
  url: `https://example.com/llms-${n}.txt`,
  status: 200,
  contentType: "text/plain",
  storageKey: null,
  links: [],
  text: `file ${n}`,
});

it("returns profiles in job order, not completion order", async () => {
  const mapper: PageMapper = {
    modelId: "mock",
    spentUsd: () => 0,
    // Later jobs finish first.
    profile: async (job) => {
      const n = Number(job.url.match(/llms-(\d)/)?.[1]);
      await new Promise((done) => setTimeout(done, (5 - n) * 10));
      return { profile: { url: job.url } as PageProfile, cached: true };
    },
  };
  const prior: Partial<CollectedData> = {
    llms: { status: "ok", files: [1, 2, 3, 4, 5].map(llmsFile), mdMirrors: [] },
  };
  const out = await collectRunUnit(
    { mapper } as RunInput,
    { store: { get: vi.fn() }, log: vi.fn() } as unknown as HandbookRuntime,
    {} as never,
    "map",
    prior,
  );
  const urls = (out as { pageProfiles: PageProfile[] }).pageProfiles.map(
    (p) => p.url,
  );
  expect(urls).toEqual([1, 2, 3, 4, 5].map((n) => llmsFile(n).url));
});
