import { z } from "zod";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import {
  pageProfileSchema,
  type PageProfile,
} from "@/server/features/handbook/contracts/page-profile";
import { buildMapJobs } from "../llm/map-input";
import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import { collectRunStage } from "./render-pass";
import type { HandbookRuntime, RunInput } from "./runner";
import type { StageName } from "./stages";

/** Stage output: collector data, plus `pageProfiles` from the map stage. */
type StageOutput = Partial<CollectedData> & {
  pageProfiles?: readonly PageProfile[];
};

/** One collection unit: the map stage runs the mapper, every other stage its collectors. */
export async function collectRunUnit(
  input: RunInput,
  runtime: HandbookRuntime,
  ctx: CollectorContext,
  stage: StageName,
  prior: Partial<CollectedData>,
): Promise<Partial<CollectedData>> {
  if (stage !== "map") return collectRunStage(input, ctx, stage, prior);
  const out: StageOutput = await runMapStage(input, runtime, prior);
  return out;
}

/** Concurrent map calls (ADR-019). */
const MAP_CONCURRENCY = 4;

/**
 * Map stage (ADR-019): one PageProfile per HTML 200 page, template
 * boilerplate and llms.txt file, 4 calls at a time. Pages past the map
 * budget, or whose call fails, get no profile (counted in the log line).
 */
async function runMapStage(
  input: RunInput,
  runtime: HandbookRuntime,
  prior: Partial<CollectedData>,
): Promise<{ pageProfiles?: PageProfile[] }> {
  const mapper = input.mapper;
  if (!mapper) return {};
  const jobs = await buildMapJobs(prior, (key) => runtime.store.get(key));
  const profiles: PageProfile[] = [];
  const counts = { cached: 0, budget: 0, schema: 0, error: 0 };
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (!job) continue;
      const outcome = await mapper.profile(job);
      if (outcome.profile) {
        profiles.push(outcome.profile);
        if (outcome.cached) counts.cached += 1;
      } else counts[outcome.reason] += 1;
    }
  };
  await Promise.all(Array.from({ length: MAP_CONCURRENCY }, worker));
  runtime.log("handbook.map", {
    model: mapper.modelId,
    jobs: jobs.length,
    profiled: profiles.length,
    ...counts,
    droppedQuotes: profiles.reduce((n, p) => n + p.droppedQuotes, 0),
    costUsd: Number(mapper.spentUsd().toFixed(5)),
  });
  return { pageProfiles: profiles };
}

/** PageProfiles the map stage saved (stage store JSON in the app → parsed). */
export function stageProfiles(
  partial: Partial<CollectedData>,
): readonly PageProfile[] | undefined {
  if (!("pageProfiles" in partial)) return undefined;
  const parsed = z.array(pageProfileSchema).safeParse(partial.pageProfiles);
  return parsed.success ? parsed.data : undefined;
}
