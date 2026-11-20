// Draft the SEO / GEO / AEO tag of every registry and SUPP item (B14
// WO-B14-001, fork/NOVICE-UI.md §4, ADR-029) and write registry-tags.json.
// Usage: pnpm tsx fork/scripts/registry-tags-draft.ts [--check] [--table]
//   --check  exit 1 when the JSON on disk differs from the draft (no write)
//   --table  print the markdown tag table (id, phase, text, tags, rule)
// To change a tag: edit OVERRIDES below (one-line reason each), run, commit.
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { REGISTRY } from "../../src/server/features/handbook/registry";
import { SUPP_REGISTRY } from "../../src/server/features/handbook/registry-supp";

type Tag = "SEO" | "GEO" | "AEO";
const ORDER: Tag[] = ["SEO", "GEO", "AEO"];
const OUT = "src/server/features/handbook/registry-tags.json";

const PHASE_TAGS: Record<string, Tag[]> = {
  P2: ["SEO"],
  P3: ["SEO"],
  P4: ["SEO"],
  P5: ["SEO", "AEO"],
  P6: ["SEO", "GEO", "AEO"],
  P7: ["SEO"],
  P8: ["SEO"],
  P9: ["GEO"],
  P10: ["SEO"],
};
/** Process phases: listed under "General", outside the three scores; text rules skipped. */
const PROCESS_PHASES = new Set(["P0", "P1", "P11", "REVIEW"]);
const AEO_TEXT =
  /\b(answers?|FAQ|questions?|snippets?|first answer|speakable|HowTo)\b/i;
const GEO_TEXT =
  /\b(AI|LLMs?|GPTBot|ClaudeBot|PerplexityBot|llms\.txt|citations?|entity|sameAs|knowledge graph)\b/i;
/** SUPP base tag from its `effect` (spec §4 "class decides when silent", ADR-029 §3). */
const SUPP_EFFECT: Record<string, Tag[]> = {
  SEO: ["SEO"],
  ranking: ["SEO"],
  GEO: ["GEO"],
};

/** id → [tags, reason]. Kept short; every entry needs a reason. */
const OVERRIDES: Record<string, [Tag[], string]> = {
  "P5-06": [
    ["SEO", "AEO"],
    '"citation lists" names article furniture, not AI citation',
  ],
  "SUPP-13": [
    ["SEO", "GEO", "AEO"],
    "snippet blockers also hide the page from search snippets",
  ],
};

type Row = {
  id: string;
  phase: string;
  text: string;
  tags: Tag[];
  rule: string;
};

const sorted = (tags: Iterable<Tag>) =>
  ORDER.filter((t) => new Set(tags).has(t));

function textRules(text: string, base: Tag[], why: string[]): Tag[] {
  const tags = new Set(base);
  if (AEO_TEXT.test(text) && !tags.has("AEO")) {
    tags.add("AEO");
    why.push("text → AEO");
  }
  if (GEO_TEXT.test(text) && !tags.has("GEO")) {
    tags.add("GEO");
    why.push("text → GEO");
  }
  return sorted(tags);
}

function draft(): Row[] {
  const rows: Row[] = [];
  for (const e of REGISTRY) {
    const why: string[] = [];
    let tags: Tag[];
    if (PROCESS_PHASES.has(e.phase)) {
      tags = [];
      why.push(`phase ${e.phase} (process)`);
    } else {
      why.push(`phase ${e.phase}`);
      tags = textRules(e.text, PHASE_TAGS[e.phase] ?? [], why);
    }
    rows.push({
      id: e.id,
      phase: e.phase,
      text: e.text,
      tags,
      rule: why.join(", "),
    });
  }
  for (const s of SUPP_REGISTRY) {
    const why = [`SUPP effect ${s.effect}`];
    const tags = textRules(s.title, SUPP_EFFECT[s.effect] ?? ["SEO"], why);
    rows.push({
      id: s.id,
      phase: "SUPP",
      text: s.title,
      tags,
      rule: why.join(", "),
    });
  }
  for (const row of rows) {
    const o = OVERRIDES[row.id];
    if (o) {
      row.tags = sorted(o[0]);
      row.rule = `override: ${o[1]}`;
    }
  }
  const unknown = Object.keys(OVERRIDES).filter(
    (id) => !rows.some((r) => r.id === id),
  );
  if (unknown.length) throw new Error(`override for unknown id: ${unknown}`);
  return rows;
}

const rows = draft();
// Prettier-formatted so `pnpm format:check` and `--check` agree.
const json = await format(
  JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, r.tags]))),
  { parser: "json" },
);

if (process.argv.includes("--table")) {
  console.log(
    "| Item | Phase | Text | Tags | Rule |\n| --- | --- | --- | --- | --- |",
  );
  for (const r of rows) {
    const text = r.text.replace(/\|/g, "\\|").slice(0, 80);
    console.log(
      `| ${r.id} | ${r.phase} | ${text} | ${r.tags.join(", ") || "General"} | ${r.rule} |`,
    );
  }
} else if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    // missing file = drift
  }
  if (current !== json) {
    console.error(`${OUT} differs from the draft; run without --check`);
    process.exit(1);
  }
  console.log(`${OUT} up to date (${rows.length} items)`);
} else {
  writeFileSync(OUT, json);
  console.log(`wrote ${OUT} (${rows.length} items)`);
}
