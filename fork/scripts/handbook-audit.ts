/**
 * Headless handbook audit (B1 WP06–WP10, ADR-001 CLI adapter).
 *
 * Runs intake + collectors + checks against a public origin with the same
 * engine the workflow hook uses, and writes to fork/runs/<domain>/<date>/:
 * report.json (K7), review-report.md (REVIEW, EP-7) or seo-geo-status.md +
 * seo-audit-baseline.md (other modes, EP-5), collected.json (collector
 * summary) and evidence/ (stored bodies). No DB writes.
 *
 *   pnpm exec tsx fork/scripts/handbook-audit.ts <origin> [--mode REVIEW|AUDIT] [--tier T1..T4] [--depth full|quick] [--max-pages 1000] [--out dir] [--llm]
 *
 * --llm runs the LLM-class checks through the K5 judge (OpenRouter key from
 * the environment or .env.local; model HANDBOOK_LLM_MODEL; cap
 * HANDBOOK_LLM_BUDGET_USD) and writes llm-calls.json. Without it those items
 * are BLOCKED `no llm key`.
 */
import { mkdirSync } from "node:fs";
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
import {
  createSafeFetch,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import { buildReportJson } from "@/server/features/handbook/engine/report";
import {
  DEPTH_ENV,
  MAX_PAGES_ENV,
  resolveDepth,
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
  type Judge,
  type JudgeInput,
} from "@/server/features/handbook/contracts/llm";
import type { LlmCallLog } from "@/server/features/handbook/llm/judge";
import {
  createHandbookJudge,
  HANDBOOK_LLM_MODEL_ENV,
  parseBudgetUsd,
} from "@/server/features/handbook/llm/model";
import { createFsEvidenceStore } from "./lib/fs-evidence-store";
import { writeFormatted } from "./lib/write-formatted";
import { summarizeCollected } from "./lib/summarize-collected";

export async function runCliAudit(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      mode: { type: "string", default: "REVIEW" },
      tier: { type: "string" },
      "max-pages": { type: "string" },
      depth: { type: "string" },
      out: { type: "string" },
      "allow-private": { type: "boolean", default: false },
      sidecar: { type: "string" },
      llm: { type: "boolean", default: false },
    },
  });
  const input = positionals[0];
  if (!input) {
    throw new Error(
      "usage: handbook-audit.ts <origin> [--mode REVIEW|AUDIT] [--tier T3] [--depth full|quick] [--max-pages 1000] [--out dir] [--sidecar http://127.0.0.1:4777] [--llm]",
    );
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
  const fetchOffsite = createSafeFetch({
    allowedHosts: "any",
    maxBytes: 256 * 1024,
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
      ? { url: values.sidecar, token: sidecarToken }
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
      try {
        return await collector.collect(...args);
      } finally {
        timing[collector.key] = Math.round(performance.now() - t0);
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
  const realJudge = values.llm ? cliJudge(llmCalls) : null;
  const judge: Judge | null = realJudge
    ? (judgeInput) => {
        llmInputs.push(judgeInput);
        return realJudge(judgeInput);
      }
    : null;
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
    },
    {
      projectId: "cli",
      fetch,
      fetchOffsite,
      store: createFsEvidenceStore(join(outDir, "evidence")),
      log,
    },
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
  return { outDir, report, result, timing: { collectorsMs: timing, totalMs } };
}

export function cliJudge(calls: LlmCallLog[]) {
  if (!process.env.OPENROUTER_API_KEY) {
    // Loads keys into the environment without printing them.
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // handled below
    }
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("--llm needs OPENROUTER_API_KEY");
  return createHandbookJudge({
    access: { apiKey, baseURL: process.env.OPENROUTER_BASE_URL },
    modelId: process.env[HANDBOOK_LLM_MODEL_ENV],
    budgetUsd: parseBudgetUsd(process.env[LLM_BUDGET_ENV]),
    log: async (call) => {
      calls.push(call);
    },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
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
