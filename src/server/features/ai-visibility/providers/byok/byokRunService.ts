import {
  CATEGORIES_VERSION,
  categorizeSource,
} from "@/server/features/ai-visibility/citations/categorize";
import { AiVisibilityRepository } from "@/server/features/ai-visibility/repositories/AiVisibilityRepository";
import { aiBrands } from "@/server/features/ai-visibility/services/aiVisibilityConfiguration";
import { matchAiBrand } from "@/server/features/ai-visibility/services/aiVisibilityMatching";
import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { createSupabaseEvidenceStore } from "@/server/features/handbook/engine/supabase-evidence-store";
import { getByokKey } from "@/server/features/handbook/secrets/CredentialRepository";
import { sha256Hex } from "@/server/lib/audit/ids";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { getIsoCountryCode } from "@/shared/keyword-locations";
import type { AiBrand } from "@/shared/ai-visibility";
import { ByokRepository as repo } from "./ByokRepository";
import type { ByokProviderId } from "./contracts";
import { byokProviders } from "./index";
import type { ByokRunResult } from "./types";

// BYOK runs (ADR-015 §1–3): tracker prompts × the tracker's configured
// providers, with the organization's own keys. Spend is capped per run and
// never touches upstream billing or credits.

const CONCURRENCY_PER_PROVIDER = 2;
const DEFAULT_BUDGET_USD = 2;
const SCHEDULE_BATCH = 5;
const DAY_MS = 86_400_000;

type Prompt = { id: string; text: string };

export type ByokRunSummary = {
  runId: string;
  status: "completed" | "failed";
  completed: number;
  failed: number;
  costUsdMicros: number;
};

async function budgetMicros(): Promise<number> {
  const raw = Number(await getOptionalEnvValue("BYOK_RUN_BUDGET_USD"));
  const usd = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BUDGET_USD;
  return Math.round(usd * 1_000_000);
}

async function evidenceStore(): Promise<EvidenceStore> {
  const url = await getOptionalEnvValue("SUPABASE_URL");
  const serviceRoleKey = await getOptionalEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (url && serviceRoleKey)
    return createSupabaseEvidenceStore({ url, serviceRoleKey });
  // ADR-003 fallback: the answer row is kept; the raw payload is not persisted.
  console.warn("byok: Supabase storage not configured; raw output not stored");
  return createMemoryEvidenceStore();
}

/** Elmo `isFanoutQuery`: a non-empty search that is not the prompt itself. */
const normalizeQuery = (query: string) => query.trim().toLowerCase();

/**
 * Spend guard shared by every call in a run. A call starts only while
 * committed spend plus in-flight calls (priced at the dearest call so far)
 * stays under the budget.
 */
function createBudget(limitMicros: number) {
  let spent = 0;
  let inFlight = 0;
  let dearest = 0;
  return {
    tryStart() {
      if (spent + inFlight * dearest >= limitMicros) return false;
      inFlight += 1;
      return true;
    },
    finish(costMicros: number) {
      inFlight -= 1;
      spent += costMicros;
      dearest = Math.max(dearest, costMicros);
    },
    get spent() {
      return spent;
    },
  };
}

async function pool<T>(
  items: T[],
  size: number,
  work: (item: T) => Promise<void>,
) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift())
        await work(item);
    }),
  );
}

function answerRows(input: {
  answerId: string;
  prompt: Prompt;
  result: ByokRunResult;
  brands: AiBrand[];
}) {
  const { answer } = input.result;
  const ownDomains = input.brands.filter((b) => b.own).map((b) => b.domain);
  const competitorDomains = input.brands
    .filter((b) => !b.own)
    .map((b) => b.domain);
  const promptNormalized = normalizeQuery(input.prompt.text);
  return {
    sources: answer.citations.map((citation) => ({
      id: crypto.randomUUID(),
      answerId: input.answerId,
      ...citation,
      ...categorizeSource({ ...citation, ownDomains, competitorDomains }),
      categoriesVersion: CATEGORIES_VERSION,
    })),
    matches: input.brands.map((brand) => ({
      id: crypto.randomUUID(),
      answerId: input.answerId,
      ...brand,
      ...matchAiBrand({ ...answer, collectedAt: null }, brand),
    })),
    webQueries: answer.webQueries.map((query, position) => {
      const normalized = normalizeQuery(query);
      return {
        id: crypto.randomUUID(),
        answerId: input.answerId,
        position,
        query,
        normalized,
        isFanout: normalized.length > 0 && normalized !== promptNormalized,
      };
    }),
  };
}

/**
 * Runs every active prompt of a tracker against its configured BYOK providers.
 * The caller has already checked that the tracker belongs to `organizationId`.
 */
export async function runByokTracker(input: {
  trackerId: string;
  organizationId: string;
  providers?: ByokProviderId[];
  promptIds?: string[];
  store?: EvidenceStore;
}): Promise<ByokRunSummary | null> {
  const scope = await repo.getTrackerScope(input.trackerId);
  if (!scope || scope.organizationId !== input.organizationId) return null;

  const allPrompts = await repo.listActivePrompts(input.trackerId);
  const prompts = input.promptIds
    ? allPrompts.filter((p) => input.promptIds?.includes(p.id))
    : allPrompts;
  const configured = (await repo.listTrackerProviders(input.trackerId)).filter(
    (row) => !input.providers || input.providers.includes(row.provider),
  );
  const project = await AiVisibilityRepository.getProject(scope.projectId);
  const brands = project
    ? aiBrands(
        project,
        await AiVisibilityRepository.listCompetitors(project.id),
      )
    : [];
  const store = input.store ?? (await evidenceStore());
  const budget = createBudget(await budgetMicros());
  const country = getIsoCountryCode(scope.locationCode) || undefined;

  const runId = crypto.randomUUID();
  await repo.createRun({
    id: runId,
    projectId: scope.projectId,
    organizationId: scope.organizationId,
    trackerId: input.trackerId,
    status: "running",
  });

  let completed = 0;
  let failed = 0;
  const saveFailure = async (
    prompt: Prompt,
    row: { provider: ByokProviderId; model: string },
    error: string,
  ) => {
    failed += 1;
    await repo.saveAnswer({
      answer: {
        id: crypto.randomUUID(),
        runId,
        promptId: prompt.id,
        ...row,
        webSearch: true,
        status: "failed",
        error,
      },
      sources: [],
      matches: [],
      webQueries: [],
    });
  };

  await Promise.all(
    configured.map(async (row) => {
      const key = await getByokKey(scope.organizationId, row.provider);
      if (!key) {
        for (const prompt of prompts) await saveFailure(prompt, row, "no_key");
        return;
      }
      const provider = byokProviders[row.provider];
      await pool(prompts, CONCURRENCY_PER_PROVIDER, async (prompt) => {
        if (!budget.tryStart()) return saveFailure(prompt, row, "budget");
        let result: ByokRunResult;
        try {
          result = await provider.run({
            apiKey: key.key,
            prompt: prompt.text,
            model: row.model,
            webSearch: true,
            location: country,
            language: scope.languageCode,
          });
        } catch (error) {
          budget.finish(0);
          const message = error instanceof Error ? error.message : "error";
          return saveFailure(prompt, row, message.slice(0, 500));
        }
        budget.finish(result.costUsdMicros);

        const answerId = crypto.randomUUID();
        const json = JSON.stringify(result.rawOutput);
        const digest = (await sha256Hex(json)).slice(0, 16);
        const stored = await store.put(
          `${scope.projectId}/${runId}/byok/${digest}-${row.provider}.json`,
          new TextEncoder().encode(json),
          "application/json",
        );
        const { answer } = result;
        await repo.saveAnswer({
          answer: {
            id: answerId,
            runId,
            promptId: prompt.id,
            provider: row.provider,
            model: row.model,
            modelVersion: answer.modelVersion,
            webSearch: true,
            status: "completed",
            answerMarkdown: answer.answerMarkdown,
            rawOutputPath: stored.key,
            inputTokens: answer.usage.inputTokens,
            outputTokens: answer.usage.outputTokens,
            searchCalls: answer.usage.searchCalls,
            costUsdMicros: result.costUsdMicros,
          },
          ...answerRows({ answerId, prompt, result, brands }),
        });
        completed += 1;
      });
    }),
  );

  const status = completed > 0 ? "completed" : "failed";
  await repo.finishRun(runId, { status, costUsdMicros: budget.spent });
  return { runId, status, completed, failed, costUsdMicros: budget.spent };
}

/**
 * 5-minute job: claims due schedules (advancing `next_run_at` first, so a
 * slow run is never started twice) and runs them one after another.
 */
export async function runDueByokSchedules(now = new Date()) {
  const due = await repo.listDueSchedules(now.toISOString(), SCHEDULE_BATCH);
  let started = 0;
  for (const schedule of due) {
    const next = new Date(
      now.getTime() + schedule.intervalDays * DAY_MS,
    ).toISOString();
    const claimed = await repo.advanceSchedule(
      schedule.trackerId,
      schedule.nextRunAt,
      next,
    );
    if (!claimed) continue;
    const scope = await repo.getTrackerScope(schedule.trackerId);
    if (!scope) continue;
    started += 1;
    await runByokTracker({
      trackerId: schedule.trackerId,
      organizationId: scope.organizationId,
    });
  }
  return { started };
}

export const byokScheduleJob = {
  name: "ai-visibility:byok-schedule",
  run: () => runDueByokSchedules(),
};
