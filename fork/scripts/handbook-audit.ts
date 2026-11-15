/**
 * Headless handbook audit (B1 WP06–WP10, ADR-001 CLI adapter).
 *
 * Runs intake + collectors + checks against a public origin with the same
 * engine the workflow hook uses, and writes to fork/runs/<domain>/<date>/:
 * report.json (K7), seo-geo-status.md (EP-5 draft), collected.json (collector
 * summary) and evidence/ (stored bodies). No DB writes.
 *
 *   pnpm exec tsx fork/scripts/handbook-audit.ts <origin> [--mode REVIEW|AUDIT] [--tier T1..T4] [--max-pages 60] [--out dir]
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
import { HANDBOOK_CHECKS } from "@/server/features/handbook/checks";
import { runHandbook } from "@/server/features/handbook/engine/runner";
import {
  createSafeFetch,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import {
  buildReportJson,
  renderStatusMd,
} from "@/server/features/handbook/engine/report";
import {
  handbookModeSchema,
  siteTierSchema,
} from "@/server/features/handbook/contracts/status";
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
      "max-pages": { type: "string", default: "60" },
      out: { type: "string" },
      "allow-private": { type: "boolean", default: false },
    },
  });
  const input = positionals[0];
  if (!input) {
    throw new Error(
      "usage: handbook-audit.ts <origin> [--mode REVIEW|AUDIT] [--tier T3] [--max-pages 60] [--out dir]",
    );
  }
  const mode = handbookModeSchema.parse(values.mode);
  const tierOverride = values.tier ? siteTierSchema.parse(values.tier) : null;
  const maxPages = Number(values["max-pages"]);
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
  const collectors = createDefaultCollectors({
    followLinks: true,
    maxPages,
  }).map((collector) => ({
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
  await writeFormatted(
    join(outDir, "seo-geo-status.md"),
    renderStatusMd(report, REGISTRY),
  );
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
  return { outDir, report, result, timing: { collectorsMs: timing, totalMs } };
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
