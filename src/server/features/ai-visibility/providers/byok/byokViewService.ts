import { omit, sortBy } from "remeda";
import {
  deleteByokKey,
  getByokKey,
  setByokKey,
  toKeyStatus,
} from "@/server/features/handbook/secrets/CredentialRepository";
import { AppError } from "@/server/lib/errors";
import { ByokRepository as repo } from "./ByokRepository";
import { runByokTracker } from "./byokRunService";
import { ENGINE_FOR_PROVIDER, type ByokProviderId } from "./contracts";
import { byokProviders } from "./index";

// BYOK page reads + settings (ADR-015 §1 comparison, §3 fan-out views).
// Every entry point resolves the tracker through project + organization.

type Scope = { projectId: string; organizationId: string };
type Cell = {
  runId: string;
  mentioned: boolean;
  cited: boolean;
  firstMention: number | null;
  sources: number;
  categories: Record<string, number>;
};
// Concrete (serializable) shape of K11 `aiVisibilityComparisonRowSchema`.
type ComparisonRow = {
  promptId: string;
  engine: string;
  provider: ByokProviderId;
  byokStatus: string;
  dataforseo: Cell | null;
  byok: (Cell & { fanoutQueries: number }) | null;
};

const RUN_HISTORY = 10;
const UPSTREAM_CANDIDATES = 20;
const FANOUT_ROWS = 5_000;
const TOP_QUERIES = 25;

async function trackerFor(scope: Scope) {
  const trackerId = await repo.getProjectTracker(
    scope.projectId,
    scope.organizationId,
  );
  if (!trackerId)
    throw new AppError("NOT_FOUND", "Set up AI visibility tracking first.");
  return trackerId;
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.NaN);

/** The upstream run with answers whose date is closest to `at`. */
function closestRun<
  T extends { createdAt: string; completedAt: string | null },
>(runs: T[], at: string): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const run of runs) {
    const gap = Math.abs(time(run.completedAt ?? run.createdAt) - time(at));
    if (gap < bestGap) [best, bestGap] = [run, gap];
  }
  return best;
}

type AnswerSet = {
  answers: { id: string; promptId: string; status: string }[];
  matches: {
    answerId: string;
    mentioned: boolean;
    cited: boolean;
    firstMention: number | null;
  }[];
  sources: { answerId: string; category: string | null }[];
};

/** One comparison cell per completed answer id. */
function cells(runId: string, set: AnswerSet, fanout?: Map<string, number>) {
  const out = new Map<string, Cell & { fanoutQueries: number }>();
  for (const answer of set.answers) {
    if (answer.status !== "completed") continue;
    const own = set.matches.find((m) => m.answerId === answer.id);
    const categories: Record<string, number> = {};
    let sources = 0;
    for (const source of set.sources)
      if (source.answerId === answer.id) {
        sources += 1;
        const key = source.category ?? "uncategorized";
        categories[key] = (categories[key] ?? 0) + 1;
      }
    out.set(answer.id, {
      runId,
      mentioned: own?.mentioned ?? false,
      cited: own?.cited ?? false,
      firstMention: own?.firstMention ?? null,
      sources,
      categories,
      fanoutQueries: fanout?.get(answer.id) ?? 0,
    });
  }
  return out;
}

async function comparison(trackerId: string) {
  const [latest] = (await repo.listRuns(trackerId, RUN_HISTORY)).filter(
    (run) => run.status === "completed",
  );
  if (!latest) return null;
  const upstream = closestRun(
    (await repo.listUpstreamRuns(trackerId, UPSTREAM_CANDIDATES)).filter(
      (run) => run.status === "completed" || run.status === "partial",
    ),
    latest.startedAt,
  );
  const byok = await repo.listRunAnswers(latest.id);
  const fanout = new Map<string, number>();
  for (const q of byok.queries)
    if (q.isFanout) fanout.set(q.answerId, (fanout.get(q.answerId) ?? 0) + 1);
  const byokCells = cells(latest.id, byok, fanout);
  const dfs = upstream ? await repo.listUpstreamRunAnswers(upstream.id) : null;
  const dfsCells =
    upstream && dfs
      ? cells(upstream.id, dfs)
      : new Map<string, Cell & { fanoutQueries: number }>();

  const rows: ComparisonRow[] = byok.answers.map((answer) => {
    const engine = ENGINE_FOR_PROVIDER[answer.provider];
    const observation = dfs?.answers.find(
      (o) => o.promptId === answer.promptId && o.engine === engine,
    );
    const dataforseo = observation ? dfsCells.get(observation.id) : undefined;
    return {
      promptId: answer.promptId,
      engine,
      provider: answer.provider,
      byokStatus: answer.status,
      dataforseo: dataforseo ? omit(dataforseo, ["fanoutQueries"]) : null,
      byok: byokCells.get(answer.id) ?? null,
    };
  });
  return {
    byokRun: latest,
    upstreamRun: upstream,
    // DataForSEO payloads are not kept upstream, so their fan-out is unknown.
    dataforseoFanout: "n/a (not stored upstream)" as const,
    rows,
  };
}

async function fanoutViews(trackerId: string) {
  const rows = await repo.listTrackerWebQueries(trackerId, FANOUT_ROWS);
  const perPrompt = new Map<
    string,
    Map<string, { query: string; count: number; providers: Set<string> }>
  >();
  const top = new Map<string, { query: string; count: number }>();
  for (const row of rows) {
    if (!row.isFanout) continue;
    const queries =
      perPrompt.get(row.promptId) ??
      new Map<
        string,
        { query: string; count: number; providers: Set<string> }
      >();
    perPrompt.set(row.promptId, queries);
    const entry = queries.get(row.normalized) ?? {
      query: row.query.trim(),
      count: 0,
      providers: new Set<string>(),
    };
    entry.count += 1;
    entry.providers.add(row.provider);
    queries.set(row.normalized, entry);
    const total = top.get(row.normalized) ?? {
      query: row.query.trim(),
      count: 0,
    };
    total.count += 1;
    top.set(row.normalized, total);
  }
  return {
    perPrompt: [...perPrompt].map(([promptId, queries]) => ({
      promptId,
      queries: sortBy(
        [...queries.values()].map((q) => ({
          ...q,
          providers: [...q.providers],
        })),
        [(q) => q.count, "desc"],
      ),
    })),
    top: sortBy([...top.values()], [(q) => q.count, "desc"]).slice(
      0,
      TOP_QUERIES,
    ),
  };
}

export const ByokViewService = {
  async getPage(scope: Scope) {
    const trackerId = await repo.getProjectTracker(
      scope.projectId,
      scope.organizationId,
    );
    if (!trackerId) return { tracker: false as const };
    const keyOf = async (provider: ByokProviderId) =>
      toKeyStatus(await getByokKey(scope.organizationId, provider));
    const [openai, anthropic, gemini, perplexity] = await Promise.all([
      keyOf("openai"),
      keyOf("anthropic"),
      keyOf("gemini"),
      keyOf("perplexity"),
    ]);
    const keys = { openai, anthropic, gemini, perplexity };
    const [providers, schedule, runs, prompts, compare, fanout] =
      await Promise.all([
        repo.listTrackerProviders(trackerId),
        repo.getSchedule(trackerId),
        repo.listRuns(trackerId, RUN_HISTORY),
        repo.listActivePrompts(trackerId),
        comparison(trackerId),
        fanoutViews(trackerId),
      ]);
    const defaultModels = {
      openai: byokProviders.openai.defaultModel,
      anthropic: byokProviders.anthropic.defaultModel,
      gemini: byokProviders.gemini.defaultModel,
      perplexity: byokProviders.perplexity.defaultModel,
    };
    return {
      tracker: true as const,
      keys,
      defaultModels,
      providers,
      schedule,
      runs,
      prompts,
      comparison: compare,
      fanout,
    };
  },

  getComparison: async (scope: Scope) => comparison(await trackerFor(scope)),

  async setKey(scope: Scope, provider: ByokProviderId, key: string | null) {
    await trackerFor(scope);
    if (key === null) await deleteByokKey(scope.organizationId, provider);
    else await setByokKey(scope.organizationId, provider, key);
  },

  async setProvider(
    scope: Scope,
    provider: ByokProviderId,
    model: string | null,
  ) {
    await repo.setTrackerProvider(await trackerFor(scope), provider, model);
  },

  async setSchedule(
    scope: Scope,
    intervalDays: number | null,
    now = new Date(),
  ) {
    await repo.setSchedule(
      await trackerFor(scope),
      intervalDays === null
        ? null
        : { intervalDays, nextRunAt: now.toISOString() },
    );
  },

  async runNow(scope: Scope) {
    return runByokTracker({
      trackerId: await trackerFor(scope),
      organizationId: scope.organizationId,
    });
  },
};
