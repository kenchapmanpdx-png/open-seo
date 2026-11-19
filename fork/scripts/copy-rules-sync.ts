// Bundle the copy rules pack (fork/skills/copy-rules/SKILL.md) for the app
// (ADR-024, SCALED-COPY §5): writes src/server/features/handbook/copy-rules.json
// `{version, sha256, text}`; text = SKILL.md body after the frontmatter,
// version = the `v…` token in its H1. workerd has no filesystem, so the app
// imports the JSON the way it imports registry.json.
// Usage: pnpm tsx fork/scripts/copy-rules-sync.ts [--check]
// --check: exit 1 when the JSON is missing or differs from SKILL.md.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const SKILL = "fork/skills/copy-rules/SKILL.md";
const OUT = "src/server/features/handbook/copy-rules.json";

const markdown = readFileSync(SKILL, "utf8");
const body = /^---\n[\s\S]*?\n---\n/.exec(markdown);
if (!body) throw new Error(`${SKILL}: no frontmatter`);
const text = markdown.slice(body[0].length).trim() + "\n";
const version = /^# .*?\b(v\d+(?:\.\d+)*)\b/m.exec(text)?.[1];
if (!version) throw new Error(`${SKILL}: no v… token in the H1`);
const sha256 = createHash("sha256").update(text).digest("hex");
const json = JSON.stringify({ version, sha256, text }, null, 2) + "\n";

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    // missing → drift
  }
  if (current !== json) {
    console.log(`${OUT} is out of date; run pnpm tsx ${process.argv[1]}`);
    process.exit(1);
  }
  console.log(`${OUT} matches ${SKILL} (${version}, ${sha256.slice(0, 12)})`);
} else {
  writeFileSync(OUT, json);
  console.log(`wrote ${OUT} (${version}, ${sha256.slice(0, 12)})`);
}
