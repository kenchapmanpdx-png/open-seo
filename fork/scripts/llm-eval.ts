/**
 * K5 judge eval (B3 R2.4, ADR-007 threshold).
 *
 *   pnpm exec tsx fork/scripts/llm-eval.ts build <site> <run-dir>   # cases from a CLI --llm run
 *   pnpm exec tsx fork/scripts/llm-eval.ts run [--model slug]       # judge every case, score
 *
 * `build` takes the judge inputs a `handbook-audit.ts --llm` run recorded in
 * llm-calls.json and writes fork/evals/cases/<id>.json for each golden case
 * below (page subset per case). `run` judges every case with the production
 * rubrics and writes fork/evals/results/<date>-<model>.md. Exit 1 when the
 * ADR-007 threshold is missed.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  LLM_BUDGET_ENV,
  LLM_DEFAULT_BUDGET_USD,
  type JudgeInput,
} from "@/server/features/handbook/contracts/llm";
import type { LlmCallLog } from "@/server/features/handbook/llm/judge";
import { RUBRICS } from "@/server/features/handbook/llm/rubrics";
import { cliJudge } from "./handbook-audit";

import { writeFormatted } from "./lib/write-formatted";

const EVALS = "fork/evals";

type CaseSpec = {
  id: string;
  site: string;
  golden: string;
  itemId: string;
  expected: "fail" | "pass";
  /** Keep only pages whose path matches. */
  path?: RegExp;
};

/**
 * Golden findings (fork/fixtures/expected/*.yaml) the judge must reproduce.
 * Hand-built cases (`note` in the JSON, e.g. why-F19) are not listed here, so
 * `build` never overwrites them.
 */
const SPECS: CaseSpec[] = [
  {
    id: "why-F09",
    site: "why",
    golden: "F09",
    itemId: "P5-05",
    expected: "fail",
  },
  {
    id: "why-F10",
    site: "why",
    golden: "F10",
    itemId: "P5-02",
    expected: "fail",
    path: /^(?!\/llms)/,
  },
  {
    id: "why-F14",
    site: "why",
    golden: "F14",
    itemId: "P4-02",
    expected: "fail",
  },
  {
    id: "why-F15",
    site: "why",
    golden: "F15",
    itemId: "P5-04",
    expected: "fail",
  },
  {
    id: "why-F18",
    site: "why",
    golden: "F18",
    itemId: "P5-07",
    expected: "fail",
  },
  {
    id: "why-PASS-02",
    site: "why",
    golden: "PASS-02",
    itemId: "P4-02",
    expected: "pass",
    path: /^\/events\/[^/]+$/,
  },
  {
    id: "ryan-F02",
    site: "ryan",
    golden: "F02",
    itemId: "P4-02",
    expected: "fail",
  },
  {
    id: "ryan-F11",
    site: "ryan",
    golden: "F11",
    itemId: "P5-04",
    expected: "fail",
  },
  {
    id: "ryan-A06",
    site: "ryan",
    golden: "A06",
    itemId: "P5-07",
    expected: "fail",
  },
  // B4 (WO-B4-001/002): content and template rubrics.
  {
    id: "why-F16",
    site: "why",
    golden: "F16",
    itemId: "P5-15",
    expected: "fail",
    path: /^\/events\/(?:ho-ho-5k|silver-falls-trail-challenge|white-river-snow-shoe|crown-stub-100)$/,
  },
  {
    id: "why-PASS-MATRIX",
    site: "why",
    golden: "home without article furniture",
    itemId: "P5-06",
    expected: "pass",
    path: /^\/$/,
  },
  {
    id: "why-F02",
    site: "why",
    golden: "F02 (P2-03 part)",
    itemId: "P2-03",
    expected: "fail",
    path: /^\/$/,
  },
  // WO-B9-017: the golden audit scores P4 "hub title 1" (pass) and the
  // expected yaml has no P4-07 finding; /events is titled "PNW Race
  // Calendar: Running, Trail & Triathlon | …". The B4 case said fail.
  {
    id: "why-HUB",
    site: "why",
    golden: "§2 hub title (/events): golden P4 'hub title 1'",
    itemId: "P4-07",
    expected: "pass",
  },
  {
    id: "ryan-F12",
    site: "ryan",
    golden: "F12",
    itemId: "P5-11",
    expected: "fail",
    path: /^\/$/,
  },
  {
    id: "ryan-F14",
    site: "ryan",
    golden: "F14",
    itemId: "P5-09",
    expected: "fail",
  },
  // B8 R3.3: bluetree F13–F15 content items; F12 (Section 179 currency) is
  // truth verification [Ken] and has no case.
  {
    id: "blue-F13",
    site: "blue",
    golden: "F13 conflicting / unsourced terms + approval times",
    itemId: "P5-02",
    expected: "fail",
  },
  {
    id: "blue-F14",
    site: "blue",
    golden: "F14 template leftovers ($ 99 Per Month, (555) 555-5555)",
    itemId: "P5-04",
    expected: "fail",
    path: /^\/(?:|rcm-connect\/|vilo\/)$/,
  },
  {
    id: "blue-F15",
    site: "blue",
    golden: "F15 superlatives + undefined acronyms",
    itemId: "P5-04",
    expected: "fail",
    path: /^\/(?!vilo\/|rcm-connect\/)/,
  },
  {
    id: "blue-F15-badge",
    site: "blue",
    golden: "F15 HIPAA badge as image only",
    itemId: "P5-11",
    expected: "fail",
  },
];

type EvalCase = Omit<CaseSpec, "path"> & { input: JudgeInput };

function build(site: string, runDir: string) {
  const { inputs } = JSON.parse(
    readFileSync(join(runDir, "llm-calls.json"), "utf8"),
  ) as { inputs: JudgeInput[] };
  mkdirSync(join(EVALS, "cases"), { recursive: true });
  for (const spec of SPECS.filter((s) => s.site === site)) {
    const input = inputs.find((i) => i.itemId === spec.itemId);
    if (!input) {
      console.warn(`${spec.id}: no ${spec.itemId} input in run (item NA?)`);
      continue;
    }
    const pages = input.pages.filter(
      (p) => !spec.path || spec.path.test(new URL(p.url).pathname),
    );
    if (pages.length === 0) {
      console.warn(`${spec.id}: no pages match`);
      continue;
    }
    const { path: _path, ...rest } = spec;
    const evalCase: EvalCase = { ...rest, input: { ...input, pages } };
    writeFileSync(
      join(EVALS, "cases", `${spec.id}.json`),
      `${JSON.stringify(evalCase, null, 2)}\n`,
    );
    console.log(`${spec.id}: ${pages.length} page(s)`);
  }
}

async function run(model?: string) {
  if (model) process.env.HANDBOOK_LLM_MODEL = model;
  const calls: LlmCallLog[] = [];
  // No crawl here: the override, else ADR-007's flat $1.
  // Read per call: cliJudge loads .env.local first.
  const judge = cliJudge(
    calls,
    () => Number(process.env[LLM_BUDGET_ENV]) || LLM_DEFAULT_BUDGET_USD,
  );
  const dir = join(EVALS, "cases");
  const rows: string[] = [];
  let failCorrect = 0;
  let failTotal = 0;
  let falseFails = 0;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const c = JSON.parse(readFileSync(join(dir, file), "utf8")) as EvalCase;
    if (!RUBRICS.has(c.input.rubricId))
      throw new Error(`${c.id}: unknown rubric ${c.input.rubricId}`);
    let verdict: string;
    let detail: string;
    try {
      const r = await judge(c.input);
      verdict = r.verdict;
      detail = `${r.confidence.toFixed(2)} · ${r.quotes.length} quote(s) · ${r.rationale.replace(/\s+/g, " ").slice(0, 160)}`;
    } catch (error) {
      verdict = "error";
      detail = String(error).slice(0, 160);
    }
    const ok = verdict === c.expected;
    if (c.expected === "fail") {
      failTotal += 1;
      if (ok) failCorrect += 1;
    } else if (verdict === "fail") falseFails += 1;
    rows.push(
      `| ${c.id} | ${c.itemId} | ${c.expected} | ${verdict} | ${ok ? "✓" : "✗"} | ${detail.replace(/\|/g, "/")} |`,
    );
  }
  const recall = failTotal ? failCorrect / failTotal : 0;
  const passed =
    recall >= THRESHOLD.recall && falseFails <= THRESHOLD.falseFails;
  const usedModel = calls[0]?.model ?? model ?? "default";
  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(join(EVALS, "results"), { recursive: true });
  const out = join(
    EVALS,
    "results",
    `${date}-${usedModel.replace(/\W+/g, "-")}.md`,
  );
  await writeFormatted(
    out,
    [
      `# K5 eval · ${date} · ${usedModel}`,
      "",
      `Recall on golden fails ${failCorrect}/${failTotal} (${(recall * 100).toFixed(0)}%) · false fails on golden passes ${falseFails} · cost $${calls.reduce((s, c) => s + c.costUsd, 0).toFixed(4)} · threshold (ADR-007) recall ≥ ${THRESHOLD.recall * 100}% and false fails ≤ ${THRESHOLD.falseFails}: **${passed ? "PASS" : "FAIL"}**`,
      "",
      "| Case | Item | Expected | Verdict | | Detail |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rows,
      "",
    ].join("\n"),
  );
  console.log(`→ ${out} · ${passed ? "PASS" : "FAIL"}`);
  if (!passed) process.exitCode = 1;
}

/** ADR-007: recall on golden fails, and no fail on a golden pass. */
const THRESHOLD = { recall: 0.8, falseFails: 0 };

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { model: { type: "string" } },
});
const [command, site, runDir] = positionals;
if (command === "build" && site && runDir) build(site, runDir);
else if (command === "run")
  run(values.model).catch((error) => {
    console.error(error);
    process.exit(1);
  });
else
  console.error(
    "usage: llm-eval.ts build <why|ryan|blue> <run-dir> | run [--model slug]",
  );
