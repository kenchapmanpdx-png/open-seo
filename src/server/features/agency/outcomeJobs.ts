import { createDefaultCollectors } from "@/server/features/handbook/collectors";
import { HANDBOOK_CHECKS } from "@/server/features/handbook/checks";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import { runHandbook } from "@/server/features/handbook/engine/runner";
import {
  createSafeFetch,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import {
  HANDBOOK_VERSION,
  REGISTRY,
} from "@/server/features/handbook/registry";
import { HandbookRepository } from "@/server/features/handbook/repositories/HandbookRepository";
import { GscService } from "@/server/features/gsc/services/GscService";
import { GscNotConnectedError } from "@/server/lib/gscErrors";
import { evidenceStore } from "./agencyService";
import {
  countAiTrafficByPath,
  hasAiAnswerRuns,
  hasAiTrafficSite,
  listAiAnswerCitations,
  hasBingSite,
  sumBingPageClicks,
} from "./OutcomeRepository";
import {
  OutcomeService,
  type OutcomeDeps,
  type OutcomeSource,
  type SourceContext,
} from "./outcomeService";

// Production wiring for the outcome record (ADR-017 §3): URL-limited handbook
// rerun + GSC / Bing / AI-traffic sources. The 5-minute fork cron calls the job.

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 28;
const AI_EVENT_RETENTION_DAYS = 90;

const pathOf = (url: string) => new URL(url).pathname;
const day = (d: Date) => d.toISOString().slice(0, 10);
const minus = (d: Date, days: number) => new Date(d.getTime() - days * DAY_MS);
/** [start, end) of the 28 days before `end`. */
const windowBefore = (end: Date) => ({
  from: minus(end, WINDOW_DAYS),
  to: end,
});

const pairs = (
  urls: string[],
  before: Map<string, number> | null,
  after: Map<string, number>,
) =>
  new Map(
    urls.map((url) => [
      url,
      {
        before: before ? String(before.get(url) ?? 0) : null,
        after: String(after.get(url) ?? 0),
      },
    ]),
  );

/** Deterministic checks only (no judge), limited to the batch URLs. */
async function rerun(input: {
  projectId: string;
  organizationId: string;
  origin: string;
  urls: string[];
}) {
  const runId = crypto.randomUUID();
  await HandbookRepository.createRun({
    id: runId,
    projectId: input.projectId,
    organizationId: input.organizationId,
    auditId: null,
    origin: input.origin,
    handbookVersion: HANDBOOK_VERSION,
    contractsVersion: CONTRACTS_VERSION,
    mode: "MAINTAIN",
  });
  try {
    const result = await runHandbook(
      {
        runId,
        origin: input.origin,
        mode: "MAINTAIN",
        registry: REGISTRY,
        collectors: createDefaultCollectors({
          seedUrls: input.urls,
          followLinks: false,
          maxPages: input.urls.length,
        }),
        checks: HANDBOOK_CHECKS,
        maxPages: input.urls.length,
        judge: null,
      },
      {
        projectId: input.projectId,
        fetch: createSafeFetch({
          allowedHosts: siblingHosts(new URL(input.origin).host),
        }),
        fetchOffsite: createSafeFetch({
          allowedHosts: "any",
          maxBytes: 256 * 1024,
        }),
        store: await evidenceStore(),
        log: (event, fields) => console.log(event, fields),
      },
    );
    await HandbookRepository.saveRunResult(runId, result);
    await HandbookRepository.finishRun({
      projectId: input.projectId,
      runId,
      status: "completed",
      tier: result.intake.tier,
    });
    return runId;
  } catch (error) {
    await HandbookRepository.finishRun({
      projectId: input.projectId,
      runId,
      status: "failed",
      errorCode:
        error instanceof Error ? error.message.slice(0, 120) : "unknown",
    });
    throw error;
  }
}

async function gscPageTotals(projectId: string, from: Date, to: Date) {
  const result = await GscService.getPerformance({
    projectId,
    dimensions: ["page"],
    startDate: day(from),
    endDate: day(minus(to, 1)),
    rowLimit: 25_000,
  });
  return {
    rows: result.rows,
    impressions: new Map(
      result.rows.map((r) => [r.keys?.[0] ?? "", r.impressions]),
    ),
    clicks: new Map(result.rows.map((r) => [r.keys?.[0] ?? "", r.clicks])),
  };
}

const gscPerformance: OutcomeSource = {
  metrics: ["gsc_impressions_28d", "gsc_clicks_28d"],
  async collect(ctx: SourceContext) {
    try {
      const b = windowBefore(ctx.fixedAt);
      const a = windowBefore(ctx.checkAt);
      const before = await gscPageTotals(ctx.projectId, b.from, b.to);
      const after = await gscPageTotals(ctx.projectId, a.from, a.to);
      return {
        source: "Google Search Console (page, 28 days)",
        payload: {
          before: { ...b, rows: before.rows },
          after: { ...a, rows: after.rows },
        },
        values: {
          gsc_impressions_28d: pairs(
            ctx.urls,
            before.impressions,
            after.impressions,
          ),
          gsc_clicks_28d: pairs(ctx.urls, before.clicks, after.clicks),
        },
      };
    } catch (error) {
      if (error instanceof GscNotConnectedError) return null;
      throw error;
    }
  },
};

const gscIndexState: OutcomeSource = {
  metrics: ["index_state"],
  async collect(ctx) {
    try {
      const result = await GscService.inspectUrls({
        projectId: ctx.projectId,
        urls: ctx.urls,
      });
      const state = new Map(
        result.results.map((r) => [
          r.url,
          r.result?.indexStatusResult?.coverageState ?? r.error ?? null,
        ]),
      );
      return {
        source: "GSC URL inspection (no stored state before the fix)",
        payload: result.results,
        values: {
          index_state: new Map(
            ctx.urls.map((url) => [
              url,
              { before: null, after: state.get(url) ?? null },
            ]),
          ),
        },
      };
    } catch (error) {
      if (error instanceof GscNotConnectedError) return null;
      throw error;
    }
  },
};

const bingClicks: OutcomeSource = {
  metrics: ["bing_clicks_28d"],
  async collect(ctx) {
    if (!(await hasBingSite(ctx.projectId, ctx.organizationId))) return null;
    const totals = async (w: { from: Date; to: Date }) => {
      const rows = await sumBingPageClicks(
        ctx.projectId,
        ctx.organizationId,
        ctx.urls,
        day(w.from),
        day(w.to),
      );
      return { rows, byUrl: new Map(rows.map((r) => [r.page, r.clicks])) };
    };
    const before = await totals(windowBefore(ctx.fixedAt));
    const after = await totals(windowBefore(ctx.checkAt));
    return {
      source: "Bing Webmaster Tools (page weeks)",
      payload: { before: before.rows, after: after.rows },
      values: { bing_clicks_28d: pairs(ctx.urls, before.byUrl, after.byUrl) },
    };
  },
};

const aiTraffic: OutcomeSource = {
  metrics: ["ai_referrals_28d", "ai_crawler_hits_verified_28d"],
  async collect(ctx) {
    if (!(await hasAiTrafficSite(ctx.projectId, ctx.organizationId)))
      return null;
    const count = async (w: { from: Date; to: Date }) => {
      const rows = await countAiTrafficByPath(
        ctx.projectId,
        ctx.organizationId,
        [...new Set(ctx.urls.map(pathOf))],
        w.from.toISOString(),
        w.to.toISOString(),
      );
      const sum = (keep: (r: (typeof rows)[number]) => boolean) =>
        new Map(
          ctx.urls.map((url) => [
            url,
            rows
              .filter((r) => r.path === pathOf(url) && keep(r))
              .reduce((n, r) => n + r.hits, 0),
          ]),
        );
      return {
        rows,
        referrals: sum((r) => r.kind === "referral"),
        crawlers: sum(
          (r) => r.kind === "crawler" && r.verification === "verified",
        ),
      };
    };
    const b = windowBefore(ctx.fixedAt);
    // Raw events are purged after 90 days: an older window cannot be counted.
    const beforeKept = b.from >= minus(ctx.checkAt, AI_EVENT_RETENTION_DAYS);
    const before = beforeKept ? await count(b) : null;
    const after = await count(windowBefore(ctx.checkAt));
    return {
      source: beforeKept
        ? "AI traffic drain (Vercel)"
        : "AI traffic drain (Vercel); before window past 90-day retention",
      payload: { before: before?.rows ?? null, after: after.rows },
      values: {
        ai_referrals_28d: pairs(
          ctx.urls,
          before?.referrals ?? null,
          after.referrals,
        ),
        ai_crawler_hits_verified_28d: pairs(
          ctx.urls,
          before?.crawlers ?? null,
          after.crawlers,
        ),
      },
    };
  },
};

/** Host-insensitive URL key: no www, query, hash or trailing slash. */
function citationKey(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

const aiAnswers: OutcomeSource = {
  metrics: ["ai_answer_mentions"],
  async collect(ctx) {
    if (!(await hasAiAnswerRuns(ctx.projectId, ctx.organizationId)))
      return null;
    const domains = [
      ...new Set(
        ctx.urls.flatMap((url) => {
          const bare = new URL(url).hostname.replace(/^www\./, "");
          return [bare, `www.${bare}`];
        }),
      ),
    ];
    const count = async (w: { from: Date; to: Date }) => {
      const rows = await listAiAnswerCitations(
        ctx.projectId,
        ctx.organizationId,
        domains,
        w.from.toISOString(),
        w.to.toISOString(),
      );
      const answers = new Map<string, Set<string>>();
      for (const row of rows) {
        const key = citationKey(row.url);
        if (!key) continue;
        answers.set(key, (answers.get(key) ?? new Set()).add(row.answerId));
      }
      const byUrl = new Map(
        ctx.urls.map((url) => [
          url,
          answers.get(citationKey(url) ?? "")?.size ?? 0,
        ]),
      );
      return { rows, byUrl };
    };
    const before = await count(windowBefore(ctx.fixedAt));
    const after = await count(windowBefore(ctx.checkAt));
    return {
      source: "AI answers citing the URL, 28 days (AI visibility + BYOK runs)",
      payload: { before: before.rows, after: after.rows },
      values: {
        ai_answer_mentions: pairs(ctx.urls, before.byUrl, after.byUrl),
      },
    };
  },
};

async function productionDeps(): Promise<OutcomeDeps> {
  return {
    rerun,
    sources: [gscPerformance, gscIndexState, bingClicks, aiTraffic, aiAnswers],
    store: await evidenceStore(),
  };
}

export const outcomeDueCheckJob = {
  name: "agency:outcome-due-checks",
  run: async () => OutcomeService.runDueChecks(await productionDeps()),
};
