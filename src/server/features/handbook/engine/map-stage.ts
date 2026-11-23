import { z } from "zod";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import {
  pageProfileSchema,
  type PageProfile,
} from "@/server/features/handbook/contracts/page-profile";
import { pagesRead } from "../llm/budget";
import { buildMapJobs } from "../llm/map-input";
import { buildSiteFactMap, type MapCounts } from "../llm/reduce";
import type { SiteFactMap } from "@/server/features/handbook/contracts/site-fact-map";
import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import { createLimiter } from "../collectors/limiter";
import { collectRunStage } from "./render-pass";
import type { HandbookRuntime, RunInput } from "./runner";
import type { StageName } from "./stages";

/** Stage output: collector data, plus `pageProfiles` from the map stage. */
type StageOutput = Partial<CollectedData> & {
  pageProfiles?: readonly PageProfile[];
  mapCounts?: MapCounts;
};

/** One collection unit: the map stage runs the mapper, every other stage its collectors. */
export async function collectRunUnit(
  input: RunInput,
  runtime: HandbookRuntime,
  ctx: CollectorContext,
  { stage, batch }: { stage: StageName; batch: number },
  prior: Partial<CollectedData>,
): Promise<Partial<CollectedData>> {
  if (stage !== "map") return collectRunStage(input, ctx, stage, prior, batch);
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
): Promise<{ pageProfiles?: PageProfile[]; mapCounts?: MapCounts }> {
  const mapper = input.mapper;
  if (!mapper) return {};
  input.budget?.setPages(pagesRead(prior));
  const jobs = await buildMapJobs(prior, (key) => runtime.store.get(key));
  // Promise.all keeps job order (not completion order): the judge views are
  // built from this list, and a stable order keeps their prompts cached.
  const limit = createLimiter(MAP_CONCURRENCY);
  const outcomes = await Promise.all(
    jobs.map((job) => limit(() => mapper.profile(job))),
  );
  const profiles: PageProfile[] = [];
  const counts = { cached: 0, budget: 0, credits: 0, schema: 0, error: 0 };
  for (const outcome of outcomes) {
    if (outcome.profile) {
      profiles.push(outcome.profile);
      if (outcome.cached) counts.cached += 1;
    } else counts[outcome.reason] += 1;
  }
  runtime.log("handbook.map", {
    model: mapper.modelId,
    jobs: jobs.length,
    profiled: profiles.length,
    ...counts,
    droppedQuotes: profiles.reduce((n, p) => n + p.droppedQuotes, 0),
    costUsd: Number(mapper.spentUsd().toFixed(5)),
  });
  return {
    pageProfiles: profiles,
    mapCounts: { cached: counts.cached, skippedBudget: counts.budget },
  };
}

/** PageProfiles the map stage saved (stage store JSON in the app → parsed). */
export function stageProfiles(
  partial: Partial<CollectedData>,
): readonly PageProfile[] | undefined {
  if (!("pageProfiles" in partial)) return undefined;
  const parsed = z.array(pageProfileSchema).safeParse(partial.pageProfiles);
  return parsed.success ? parsed.data : undefined;
}

const mapCountsSchema = z.object({
  cached: z.number().int().nonnegative(),
  skippedBudget: z.number().int().nonnegative(),
});

/** Reduce stage (ADR-019): the K15 fact map over the map stage's profiles; none without profiles. */
export function stageFactMap(
  partial: Partial<CollectedData>,
  collected: CollectedData,
  profiles: readonly PageProfile[] | undefined,
): SiteFactMap | undefined {
  if (!profiles) return undefined;
  const counts =
    "mapCounts" in partial
      ? mapCountsSchema.safeParse(partial.mapCounts).data
      : undefined;
  const { jsonld, llms, pages } = collected;
  return buildSiteFactMap(
    profiles,
    jsonld.status === "ok" ? jsonld : null,
    llms.status === "ok" ? llms : null,
    pages.status === "ok" ? pages.snapshots : [],
    counts,
  );
}
