/**
 * PageProfile extraction eval (WO-B9-025, spec fork/evals/extract/README.md).
 *
 * For each golden site's quote cases, checks that the map stage put the quote
 * into the right PageProfile field. Input is a run dir (`page-profiles.json`
 * from a CLI `--llm` run) or `--live` (fetch each case URL, build the map
 * input like the engine does, one map call per URL).
 *
 *   pnpm exec tsx fork/scripts/extract-eval.ts <run-dir|--live> [--site why|ryan|blue] [--model slug]
 *
 * found = an entry in `field` whose quote (or text) contains the case quote
 * after normalising (lower-case, NFKC, whitespace collapsed, ™ ® © stripped)
 * and whose `expect` keys match. A template-scope profile counts too (the
 * page's boilerplate is profiled once per template). site-changed = the URL
 * no longer returns 200 or the quote is not in its map input text (live GET
 * in both modes); excluded from the rate. Exit 1 under 90 %.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { z } from "zod";
import {
  LLM_EXTRACT_DEFAULT_MODEL,
  LLM_EXTRACT_MODEL_ENV,
  pageProfileSchema,
  type PageProfile,
} from "@/server/features/handbook/contracts/page-profile";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { HANDBOOK_USER_AGENT } from "@/server/features/handbook/engine/safe-fetch";
import { buildMapJobs } from "@/server/features/handbook/llm/map-input";
import { createHandbookMapper } from "@/server/features/handbook/llm/model";
import { writeFormatted } from "./lib/write-formatted";

const THRESHOLD = 0.9;
const CASES_DIR = "fork/evals/extract";
const SITE_ALIASES: Record<string, string> = {
  why: "whyracingevents.com",
  ryan: "ryanmscottsdale.com",
  blue: "bluetreefunding.com",
};

const FIELDS = [
  "names",
  "stats",
  "prices",
  "superlatives",
  "awards",
  "placeholders",
  "undefinedAcronyms",
  "faqQuestions",
  "freshness",
] as const;

const caseSchema = z.object({
  golden: z.string(),
  url: z.string(),
  field: z.enum(FIELDS),
  quote: z.string().min(1),
  expect: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
});
const siteSchema = z.object({
  site: z.string(),
  origin: z.string().url(),
  cases: z.array(caseSchema),
});
type Case = z.infer<typeof caseSchema>;
type Site = z.infer<typeof siteSchema>;

const runFileSchema = z.object({
  profiles: z.array(z.unknown()),
});

const norm = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[™®©]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Same URL key on both sides: origin + path without trailing slash, no query/hash. */
function urlKey(url: string): string {
  const u = new URL(url);
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "/";
  return `${u.host.replace(/^www\./, "")}${path}`;
}

// ---------------------------------------------------------------------------
// Live page → map job text (the engine's own input builder)
// ---------------------------------------------------------------------------

type LivePage = { status: number; text: string | null; url: string };

async function fetchLive(url: string): Promise<LivePage> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": HANDBOOK_USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.text();
    if (res.status !== 200) return { status: res.status, text: null, url };
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      // llms.txt: the engine sends the file in full.
      return { status: 200, text: `[llms.txt]\n${body}`, url };
    }
    const facts = extractHtmlFacts(body, res.url || url);
    const snapshot: PageSnapshot = {
      url,
      finalUrl: res.url || url,
      status: 200,
      contentType: type,
      rawKey: "raw",
      wordsRaw: facts.words,
      bytesRaw: body.length,
      head: facts.head,
      h1: facts.h1,
      links: facts.links,
      images: facts.images,
      xRobotsTag: null,
      markup: facts.markup,
    };
    const raw = new TextEncoder().encode(body);
    const [job] = await buildMapJobs(
      { pages: { status: "ok", snapshots: [snapshot] } },
      async (key) => (key === "raw" ? raw : null),
    );
    return { status: 200, text: job?.text ?? null, url };
  } catch (error) {
    console.error(`fetch ${url}: ${String(error).slice(0, 200)}`);
    return { status: 0, text: null, url };
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

type Verdict = "found" | "missed" | "site-changed";
type Scored = { c: Case; verdict: Verdict; seen: string };

type Entry = Record<string, unknown> & { quote?: unknown; text?: unknown };

function entryMatches(entry: Entry, c: Case): boolean {
  const needle = norm(c.quote);
  const hay = [entry.quote, entry.text]
    .filter((v): v is string => typeof v === "string")
    .map(norm);
  if (!hay.some((h) => h.includes(needle))) return false;
  for (const [key, want] of Object.entries(c.expect ?? {})) {
    const got = entry[key];
    if (typeof want === "boolean") {
      if (got !== want) return false;
    } else if (typeof got !== "string" || norm(got) !== norm(want)) {
      return false;
    }
  }
  return true;
}

function scoreCase(
  c: Case,
  profiles: readonly PageProfile[],
  live: LivePage,
): Scored {
  const changed =
    live.status !== 200 ||
    live.text === null ||
    !norm(live.text).includes(norm(c.quote));
  const pageProfile = profiles.find(
    (p) => p.scope === "page" && urlKey(p.url) === urlKey(live.url),
  );
  const candidates = [
    ...(pageProfile ? [pageProfile] : []),
    ...profiles.filter((p) => p.scope === "template"),
  ];
  for (const p of candidates) {
    const hit = (p[c.field] as readonly Entry[]).find((e) =>
      entryMatches(e, c),
    );
    if (hit) {
      const where = p.scope === "template" ? " (template)" : "";
      return { c, verdict: "found", seen: `${JSON.stringify(hit)}${where}` };
    }
  }
  // Closest miss: same quote anywhere in the page profile (wrong field or expect).
  let seen = pageProfile ? "" : "no profile for url";
  if (pageProfile) {
    for (const field of FIELDS) {
      const near = (pageProfile[field] as readonly Entry[]).find((e) =>
        entryMatches(e, { ...c, expect: undefined }),
      );
      if (near) {
        seen = `${field}: ${JSON.stringify(near)}`;
        break;
      }
    }
  }
  if (changed) {
    const why =
      live.status !== 200
        ? `HTTP ${live.status}`
        : "quote not in raw page text (rendered text not checked)";
    return { c, verdict: "site-changed", seen: why };
  }
  return { c, verdict: "missed", seen };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function loadSites(only: string | undefined): Site[] {
  const wanted = only ? (SITE_ALIASES[only] ?? only) : null;
  return readdirSync(CASES_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) =>
      siteSchema.parse(parse(readFileSync(join(CASES_DIR, f), "utf8"))),
    )
    .filter((s) => !wanted || s.site === wanted);
}

function loadRunProfiles(dir: string): PageProfile[] {
  const file = runFileSchema.parse(
    JSON.parse(readFileSync(join(dir, "page-profiles.json"), "utf8")),
  );
  return file.profiles.flatMap((p) => {
    const parsed = pageProfileSchema.safeParse(p);
    return parsed.success ? [parsed.data] : [];
  });
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      live: { type: "boolean", default: false },
      site: { type: "string" },
      model: { type: "string" },
    },
  });
  const runDir = positionals[0];
  if (!values.live && !runDir) {
    console.error(
      "usage: extract-eval.ts <run-dir|--live> [--site why|ryan|blue] [--model slug]",
    );
    process.exit(2);
  }

  let runProfiles: PageProfile[] = [];
  let sites = loadSites(values.site);
  if (!values.live && runDir) {
    runProfiles = loadRunProfiles(runDir);
    if (!values.site) {
      const hosts = new Set(
        runProfiles.map((p) => urlKey(p.url).split("/")[0]),
      );
      sites = sites.filter((s) =>
        hosts.has(new URL(s.origin).host.replace(/^www\./, "")),
      );
    }
  }
  if (sites.length === 0) {
    console.error("no case file matches the run / --site");
    process.exit(2);
  }

  // One live GET per case URL: site-changed check in both modes, map input in --live.
  const livePages = new Map<string, LivePage>();
  for (const site of sites) {
    for (const c of site.cases) {
      const url = new URL(c.url, site.origin).toString();
      if (!livePages.has(url)) livePages.set(url, await fetchLive(url));
    }
  }

  let modelId =
    values.model ?? runProfiles[0]?.model ?? LLM_EXTRACT_DEFAULT_MODEL;
  const liveProfiles: PageProfile[] = [];
  let spent = 0;
  if (values.live) {
    try {
      process.loadEnvFile(".env.local");
    } catch {
      // a missing key is reported below
    }
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("--live needs OPENROUTER_API_KEY");
    modelId =
      values.model ??
      process.env[LLM_EXTRACT_MODEL_ENV] ??
      LLM_EXTRACT_DEFAULT_MODEL;
    const jobs = [...livePages.values()].filter((p) => p.text !== null);
    const chars = jobs.reduce((n, p) => n + (p.text?.length ?? 0), 0);
    // Run 43: why full map $0.038 for 36 Haiku pages ≈ $0.001/page.
    console.log(
      `--live: ${jobs.length} map calls (${chars} chars) with ${modelId}; ≈ $${(jobs.length * 0.002).toFixed(3)} at Haiku rates`,
    );
    const mapper = createHandbookMapper({
      access: { apiKey, baseURL: process.env.OPENROUTER_BASE_URL },
      modelId,
      budgetUsd: () => 2,
      cache: { get: async () => null, put: async () => {} },
      log: (event, fields) => console.error(event, JSON.stringify(fields)),
    });
    for (const page of jobs) {
      const outcome = await mapper.profile({
        url: page.url,
        scope: "page",
        templateKey: null,
        text: page.text ?? "",
      });
      if (outcome.profile) liveProfiles.push(outcome.profile);
      else console.error(`map ${page.url}: ${outcome.reason}`);
    }
    spent = mapper.spentUsd();
  }
  const profiles = values.live ? liveProfiles : runProfiles;

  const lines: string[] = [];
  const date = new Date().toISOString().slice(0, 10);
  lines.push(
    `# Extraction eval — ${date} — ${modelId}`,
    "",
    `Input: ${values.live ? "--live" : runDir} · spec fork/evals/extract/README.md · threshold ${THRESHOLD * 100} %`,
    "",
  );
  let found = 0;
  let scoredTotal = 0;
  for (const site of sites) {
    const scored = site.cases.map((c) =>
      scoreCase(
        c,
        profiles,
        livePages.get(new URL(c.url, site.origin).toString()) ?? {
          status: 0,
          text: null,
          url: c.url,
        },
      ),
    );
    const siteFound = scored.filter((s) => s.verdict === "found").length;
    const siteBase = scored.filter((s) => s.verdict !== "site-changed").length;
    found += siteFound;
    scoredTotal += siteBase;
    lines.push(
      `## ${site.site} — ${siteFound}/${siteBase} found`,
      "",
      "| golden | url | field | quote | verdict | entry seen |",
      "| --- | --- | --- | --- | --- | --- |",
      ...scored.map(
        (s) =>
          `| ${s.c.golden} | ${cell(s.c.url)} | ${s.c.field} | ${cell(s.c.quote)} | ${s.verdict} | ${cell(s.seen.slice(0, 160))} |`,
      ),
      "",
    );
    const dropped = profiles
      .filter((p) =>
        urlKey(p.url).startsWith(urlKey(site.origin).split("/")[0]),
      )
      .filter((p) => p.droppedQuotes > 0)
      .map((p) => `${new URL(p.url).pathname} ${p.droppedQuotes}`);
    lines.push(
      `Dropped quotes per page: ${dropped.length ? dropped.join(" · ") : "none"}`,
      "",
    );
  }
  const rate = scoredTotal ? found / scoredTotal : 0;
  const headline = `**Found ${found}/${scoredTotal} (${(rate * 100).toFixed(1)} %)** — ${rate >= THRESHOLD ? "PASS" : "FAIL (< 90 %: Sonnet fallback per ADR-019)"}${values.live ? ` · spent $${spent.toFixed(4)}` : ""}`;
  lines.splice(4, 0, headline, "");

  const slug = modelId.replace(/[^a-z0-9.-]+/gi, "-");
  const out = `fork/evals/results/${date}-extract-${slug}.md`;
  await writeFormatted(out, lines.join("\n"));
  console.log(headline.replace(/\*/g, ""));
  console.log(`wrote ${out}`);
  if (rate < THRESHOLD) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
