/**
 * Headless handbook audit (B1 WP06–WP10, ADR-001 CLI adapter).
 *
 * Runs intake + collectors + checks against a public origin with the same
 * engine the workflow hook uses, and writes to fork/runs/<domain>/<date>/:
 * report.json (K7), review-report.md (REVIEW, EP-7) or seo-geo-status.md +
 * seo-audit-baseline.md (other modes, EP-5), collected.json (collector
 * summary) and evidence/ (stored bodies). No DB writes.
 *
 *   pnpm exec tsx fork/scripts/handbook-audit.ts <origin> [--mode REVIEW|AUDIT] [--tier T1..T4] [--depth full|quick] [--lighthouse templates|all] [--max-pages 1000] [--out dir] [--llm] [--copy-quality]
 *
 * --copy-quality (or HANDBOOK_COPY_QUALITY=on) adds the not-scored copy
 * quality section (SCALED-COPY §4, ADR-023): deterministic, no LLM, no fetch.
 *
 * --llm runs the LLM-class checks through the K5 judge (OpenRouter key from
 * the environment or .env.local; model HANDBOOK_LLM_MODEL; cap
 * HANDBOOK_LLM_BUDGET_USD) and writes llm-calls.json. Without it those items
 * are BLOCKED `no llm key`. --llm also runs the map stage (ADR-019; model
 * HANDBOOK_LLM_EXTRACT_MODEL, default Haiku) and writes page-profiles.json;
 * profiles are cached as files under fork/runs/.profile-cache/ so an
 * unchanged rerun makes no map calls.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  normalizeAndValidateStartUrl,
  resolveStartUrlRedirects,
} from "@/server/lib/audit/url-policy";
import {
  HANDBOOK_VERSION,
  REGISTRY,
} from "@/server/features/handbook/registry";
import { createDefaultCollectors } from "@/server/features/handbook/collectors";
import { SIDECAR_TOKEN_ENV } from "@/server/features/handbook/contracts/sidecar";
import { HANDBOOK_CHECKS } from "@/server/features/handbook/checks";
import { runHandbook } from "@/server/features/handbook/engine/runner";
import { planBatches } from "@/server/features/handbook/engine/stages";
import { livePageUrls } from "@/server/features/handbook/collectors/sidecar-targets";
import {
  createSafeFetch,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import { buildReportJson } from "@/server/features/handbook/engine/report";
import {
  COPY_QUALITY_ENV,
  copyQualityEnvOn,
} from "@/server/features/handbook/engine/copy-quality";
import {
  DEPTH_ENV,
  estimateRunMinutes,
  lighthouseCapMinutes,
  LIGHTHOUSE_ENV,
  MAX_PAGES_ENV,
  resolveDepth,
  resolveLighthouseScope,
  resolveMaxPages,
} from "@/server/features/handbook/engine/depth";
import {
  renderAuditBaselineMd,
  renderOwnerTodoMd,
  renderReviewMd,
  renderStatusMd,
} from "@/server/features/handbook/export/markdown";
import {
  handbookModeSchema,
  siteTierSchema,
} from "@/server/features/handbook/contracts/status";
import {
  LLM_BUDGET_ENV,
  llmVerdictSchema,
  type Judge,
  type JudgeInput,
} from "@/server/features/handbook/contracts/llm";
import type {
  LlmCallLog,
  VerdictCache,
} from "@/server/features/handbook/llm/judge";
import {
  createHandbookJudge,
  createHandbookMapper,
  HANDBOOK_LLM_MODEL_ENV,
} from "@/server/features/handbook/llm/model";
import {
  createRunBudget,
  type RunBudget,
} from "@/server/features/handbook/llm/budget";
import {
  LLM_EXTRACT_MODEL_ENV,
  pageProfileSchema,
  type PageProfile,
} from "@/server/features/handbook/contracts/page-profile";
import type {
  MapOutcome,
  PageMapper,
  ProfileCache,
  ProfileCacheKey,
} from "@/server/features/handbook/llm/map";
import { createFsEvidenceStore } from "./lib/fs-evidence-store";
import { writeFormatted } from "./lib/write-formatted";
import { summarizeCollected } from "./lib/summarize-collected";

const USAGE =
  "usage: handbook-audit.ts <origin> [--mode REVIEW|AUDIT] [--tier T3] [--depth full|quick] [--lighthouse templates|all] [--max-pages 1000] [--out dir] [--sidecar http://127.0.0.1:4777] [--llm] [--copy-quality]";

export async function runCliAudit(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      mode: { type: "string", default: "REVIEW" },
      tier: { type: "string" },
      "max-pages": { type: "string" },
      depth: { type: "string" },
      lighthouse: { type: "string" },
      out: { type: "string" },
      "allow-private": { type: "boolean", default: false },
      sidecar: { type: "string" },
      llm: { type: "boolean", default: false },
      "copy-quality": { type: "boolean", default: false },
    },
  });
  const input = positionals[0];
  if (!input) {
    throw new Error(USAGE);
  }
  const mode = handbookModeSchema.parse(values.mode);
  const tierOverride = values.tier ? siteTierSchema.parse(values.tier) : null;
  // --depth wins over HANDBOOK_DEPTH (default full); quick keeps the pre-B9 60-page cap.
  const depth = resolveDepth(process.env[DEPTH_ENV], values.depth);
  const maxPages = resolveMaxPages({
    depth,
    env: process.env[MAX_PAGES_ENV],
    cli: values["max-pages"],
    quickDefault: 60,
  });
  // --lighthouse wins over HANDBOOK_LIGHTHOUSE (default templates; `all` needs --depth full + --sidecar).
  const lighthouse = resolveLighthouseScope(
    process.env[LIGHTHOUSE_ENV],
    values.lighthouse,
  );
  const lighthouseAll =
    lighthouse === "all" && depth === "full" && Boolean(values.sidecar);
  if (lighthouseAll) {
    console.log(
      `Lighthouse all: estimate ≤ ${estimateRunMinutes(maxPages, "all")} min for up to ${maxPages} pages (0.6 min per page + base); exact after the crawl`,
    );
  }
  // --allow-private: local fixtures only (BadGEO on 127.0.0.1); skips SSRF DNS policy.
  const origin = values["allow-private"]
    ? new URL(input).origin
    : new URL(
        (
          await resolveStartUrlRedirects(
            await normalizeAndValidateStartUrl(input),
          )
        ).url,
      ).origin;
  const host = new URL(origin).host;
  const date = new Date().toISOString().slice(0, 10);
  const outDir =
    values.out ?? join("fork/runs", host.replace(/^www\./, ""), date);
  mkdirSync(outDir, { recursive: true });
  const runId = `cli-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();

  const fetch = createSafeFetch({
    allowedHosts: values["allow-private"] ? [host] : siblingHosts(host),
    ...(values["allow-private"]
      ? {
          checkHost: async () => {},
          fetchImpl: (url: string, init: RequestInit) =>
            globalThis.fetch(url, init),
        }
      : {}),
    minIntervalMs: values["allow-private"] ? 0 : 300,
  });
  // --allow-private also lets off-site probes reach the BadGEO off-site stub (WO-B9-012).
  const fetchOffsite = createSafeFetch({
    allowedHosts: "any",
    maxBytes: 256 * 1024,
    ...(values["allow-private"]
      ? {
          checkHost: async () => {},
          fetchImpl: (url: string, init: RequestInit) =>
            globalThis.fetch(url, init),
        }
      : {}),
  });
  // Per-collector timing (WO-B2-001): wrap collect() here; the runner stays unchanged.
  const timing: Record<string, number> = {};
  const log = (event: string, fields: Record<string, unknown>) =>
    console.error(event, JSON.stringify(fields));
  // --sidecar: K3 render sidecar URL; token from HANDBOOK_SIDECAR_TOKEN,
  // else loaded from .env.local (never printed), like cliJudge.
  if (values.sidecar && !process.env[SIDECAR_TOKEN_ENV]) {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // handled below
    }
  }
  const sidecarToken = process.env[SIDECAR_TOKEN_ENV];
  if (values.sidecar && !sidecarToken)
    throw new Error(`--sidecar needs ${SIDECAR_TOKEN_ENV} in the environment`);
  const sidecar =
    values.sidecar && sidecarToken
      ? {
          url: values.sidecar,
          token: sidecarToken,
          depth,
          lighthouse,
          concurrency:
            Number(process.env.HANDBOOK_RENDER_CONCURRENCY) || undefined,
        }
      : null;
  const collectors = createDefaultCollectors(
    {
      followLinks: true,
      maxPages,
    },
    sidecar,
  ).map((collector) => ({
    ...collector,
    collect: async (...args: Parameters<typeof collector.collect>) => {
      const t0 = performance.now();
      log("handbook.collector.start", { key: collector.key });
      if (
        lighthouseAll &&
        collector.key === "lighthouse" &&
        timing.lighthouse === undefined
      ) {
        const pages = livePageUrls(args[1])?.length ?? 0;
        console.log(
          `Lighthouse all: ${pages} pages in ${planBatches(args[1], "all").lighthouse} batches, estimate ${Math.ceil(lighthouseCapMinutes("all", pages))} min`,
        );
      }
      try {
        return await collector.collect(...args);
      } finally {
        // Lighthouse `all` runs one collect per batch: sum them.
        timing[collector.key] =
          (timing[collector.key] ?? 0) + Math.round(performance.now() - t0);
        log("handbook.collector.end", {
          key: collector.key,
          ms: timing[collector.key],
        });
      }
    },
  }));
  const llmCalls: LlmCallLog[] = [];
  // Judge inputs are kept even when a call fails: fork/scripts/llm-eval.ts
  // builds its eval cases from them.
  const llmInputs: JudgeInput[] = [];
  const budget = values.llm ? cliBudget() : null;
  const realJudge = budget ? cliJudge(llmCalls, budget.judgeUsd) : null;
  const judge: Judge | null = realJudge
    ? (judgeInput) => {
        llmInputs.push(judgeInput);
        return realJudge(judgeInput);
      }
    : null;
  const mapOutcomes: MapOutcome[] = [];
  const mapper = budget ? cliMapper(mapOutcomes, log, budget.mapUsd) : null;
  const t0 = performance.now();
  const result = await runHandbook(
    {
      runId,
      origin,
      mode,
      tierOverride,
      registry: REGISTRY,
      collectors,
      checks: HANDBOOK_CHECKS,
      maxPages,
      judge,
      mapper,
      budget,
      options: {
        copyQuality:
          values["copy-quality"] ||
          copyQualityEnvOn(process.env[COPY_QUALITY_ENV]),
      },
    },
    {
      projectId: "cli",
      fetch,
      fetchOffsite,
      store: createFsEvidenceStore(join(outDir, "evidence")),
      log,
    },
    { lighthouse: lighthouseAll ? "all" : "templates" },
  );
  const totalMs = Math.round(performance.now() - t0);
  const report = buildReportJson({
    depth,
    result,
    registry: REGISTRY,
    handbookVersion: HANDBOOK_VERSION,
    runId,
    origin,
    mode,
    startedAt,
    finishedAt: new Date().toISOString(),
  });
  await writeFormatted(
    join(outDir, "report.json"),
    JSON.stringify(report, null, 2),
  );
  // EP-7: REVIEW writes one report and no status files.
  if (mode === "REVIEW") {
    await writeFormatted(
      join(outDir, "review-report.md"),
      renderReviewMd(report, REGISTRY),
    );
  } else {
    await writeFormatted(
      join(outDir, "seo-geo-status.md"),
      renderStatusMd(report, REGISTRY),
    );
    await writeFormatted(
      join(outDir, "seo-audit-baseline.md"),
      renderAuditBaselineMd(report),
    );
    await writeFormatted(
      join(outDir, "seo-owner-todo.md"),
      renderOwnerTodoMd(report, REGISTRY),
    );
  }
  await writeFormatted(
    join(outDir, "collected.json"),
    JSON.stringify(
      {
        // report.json (K7) has no timing slot; timing lives here.
        meta: { timing: { collectorsMs: timing, totalMs } },
        ...summarizeCollected(result.collected),
      },
      null,
      2,
    ),
  );
  if (values.llm)
    await writeFormatted(
      join(outDir, "llm-calls.json"),
      JSON.stringify(
        {
          totalUsd: llmCalls.reduce((sum, c) => sum + c.costUsd, 0),
          calls: llmCalls,
          inputs: llmInputs,
        },
        null,
        2,
      ),
    );
  if (mapper) {
    const profiles = mapOutcomes.flatMap((o) => (o.profile ? [o.profile] : []));
    const map = {
      model: mapper.modelId,
      jobs: mapOutcomes.length,
      profiled: profiles.length,
      cached: mapOutcomes.filter((o) => o.profile && o.cached).length,
      unprofiled: mapOutcomes.filter((o) => !o.profile).length,
      droppedQuotes: profiles.reduce((n, p) => n + p.droppedQuotes, 0),
      costUsd: mapper.spentUsd(),
    };
    console.log(
      `map: ${map.profiled}/${map.jobs} profiles (${map.cached} cached, ${map.unprofiled} unprofiled, ${map.droppedQuotes} quotes dropped) · ${map.model} · $${map.costUsd.toFixed(4)}`,
    );
    await writeFormatted(
      join(outDir, "page-profiles.json"),
      JSON.stringify({ ...map, profiles }, null, 2),
    );
  }
  return { outDir, report, result, timing: { collectorsMs: timing, totalMs } };
}

/** Loads keys from .env.local into the environment (never printed) unless already set. */
function loadCliEnv() {
  if (process.env.OPENROUTER_API_KEY) return;
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // a missing key is reported by the caller
  }
}

/** Run budget from HANDBOOK_LLM_BUDGET_USD or the page-count formula. */
function cliBudget(): RunBudget {
  loadCliEnv();
  return createRunBudget(process.env[LLM_BUDGET_ENV]);
}

/** `cache: false` for evals, which must ask the model every time. */
export function cliJudge(
  calls: LlmCallLog[],
  budgetUsd: () => number,
  { cache = true }: { cache?: boolean } = {},
) {
  loadCliEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("--llm needs OPENROUTER_API_KEY");
  return createHandbookJudge({
    access: { apiKey, baseURL: process.env.OPENROUTER_BASE_URL },
    modelId: process.env[HANDBOOK_LLM_MODEL_ENV],
    budgetUsd,
    log: async (call) => {
      calls.push(call);
    },
    cache: cache ? fsVerdictCache() : undefined,
  });
}

/** Judge verdict cache as JSON files (unchanged reruns skip the judge calls). */
const VERDICT_CACHE_DIR = "fork/runs/.judge-cache";

function fsVerdictCache(): VerdictCache {
  mkdirSync(VERDICT_CACHE_DIR, { recursive: true });
  const path = (key: string) =>
    join(
      VERDICT_CACHE_DIR,
      `${createHash("sha256").update(key).digest("hex")}.json`,
    );
  return {
    async get(key) {
      const file = path(key);
      if (!existsSync(file)) return null;
      const parsed = llmVerdictSchema.safeParse(
        JSON.parse(readFileSync(file, "utf8")),
      );
      return parsed.success ? parsed.data : null;
    },
    async put(key, verdict) {
      await writeFormatted(path(key), JSON.stringify(verdict));
    },
  };
}

/** Profile cache as JSON files (CLI runs have no DB). */
const PROFILE_CACHE_DIR = "fork/runs/.profile-cache";

function fsProfileCache(): ProfileCache {
  mkdirSync(PROFILE_CACHE_DIR, { recursive: true });
  const path = (key: ProfileCacheKey) => {
    const id = [key.url, key.textSha256, key.promptVersion, key.model].join(
      " ",
    );
    const name = createHash("sha256").update(id).digest("hex");
    return join(PROFILE_CACHE_DIR, `${name}.json`);
  };
  return {
    async get(key) {
      const file = path(key);
      if (!existsSync(file)) return null;
      const parsed = pageProfileSchema.safeParse(
        JSON.parse(readFileSync(file, "utf8")),
      );
      return parsed.success ? parsed.data : null;
    },
    async put(profile: PageProfile) {
      await writeFormatted(path(profile), JSON.stringify(profile));
    },
  };
}

function cliMapper(
  outcomes: MapOutcome[],
  log: (event: string, fields: Record<string, unknown>) => void,
  budgetUsd: () => number,
): PageMapper {
  // cliJudge already loaded .env.local when --llm is set.
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("--llm needs OPENROUTER_API_KEY");
  const mapper = createHandbookMapper({
    access: { apiKey, baseURL: process.env.OPENROUTER_BASE_URL },
    modelId: process.env[LLM_EXTRACT_MODEL_ENV],
    budgetUsd,
    cache: fsProfileCache(),
    log,
  });
  return {
    ...mapper,
    profile: async (job) => {
      const outcome = await mapper.profile(job);
      outcomes.push(outcome);
      return outcome;
    },
  };
}

if (
  import.meta.url === `file://${process.argv[1]}` &&
  process.argv.includes("--help")
) {
  console.log(USAGE);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  runCliAudit(process.argv.slice(2))
    .then(({ outDir, report, timing }) => {
      const counts = new Map<string, number>();
      for (const item of report.items)
        counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
      console.log(
        `${report.site.origin} · tier ${report.run.tier} · ${report.findings.length} findings`,
      );
      console.log([...counts].map(([s, n]) => `${s} ${n}`).join(" · "));
      console.log(
        `timing ${timing.totalMs}ms · ${Object.entries(timing.collectorsMs)
          .map(([k, ms]) => `${k} ${ms}`)
          .join(" · ")}`,
      );
      console.log(`→ ${outDir}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
