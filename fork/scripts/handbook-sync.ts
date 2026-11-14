// Diff a handbook file's §41 checklist against the registry.
// Usage: pnpm tsx fork/scripts/handbook-sync.ts [handbook.md]
// Exit 0 = no diffs, 1 = diffs (missing · extra · text changed · tags/refs changed,
// or a golden expectation in fork/fixtures/expected/ naming an unknown registry id).
import { readdirSync, readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { REGISTRY } from "../../src/server/features/handbook/registry";
import {
  parseHandbookVersion,
  parseSection41,
} from "../../src/server/features/handbook/handbook-parse";

const file =
  process.argv[2] ?? "fork/handbook/on-site-seo-geo-reference-unified-v4.6.md";
const markdown = readFileSync(file, "utf8");
const parsed = parseSection41(markdown);

const diffs: string[] = [];
const ids = new Set<string>();
for (const entry of REGISTRY) {
  if (ids.has(entry.id)) diffs.push(`duplicate id ${entry.id}`);
  ids.add(entry.id);
}

// Match by text first, so a reordered or inserted line shows as a move, not
// as a cascade of text changes.
const byText = new Map(REGISTRY.map((entry) => [entry.text, entry]));
const byId = new Map(REGISTRY.map((entry) => [entry.id, entry]));
const seen = new Set<string>();
for (const item of parsed) {
  const exact = byText.get(item.text);
  if (exact) {
    seen.add(exact.id);
    if (exact.id !== item.id) diffs.push(`moved ${exact.id} → ${item.id}`);
    if (JSON.stringify(exact.refs) !== JSON.stringify(item.refs))
      diffs.push(`refs changed ${item.id}`);
    if (JSON.stringify(exact.tags) !== JSON.stringify(item.tags))
      diffs.push(`tags changed ${item.id}`);
    continue;
  }
  const sameId = byId.get(item.id);
  if (sameId && !parsed.some((p) => p.text === sameId.text)) {
    seen.add(sameId.id);
    diffs.push(`text changed ${item.id}\n  - ${sameId.text}\n  + ${item.text}`);
  } else {
    diffs.push(`missing ${item.id}: ${item.text}`);
  }
}
for (const entry of REGISTRY) {
  if (!seen.has(entry.id)) diffs.push(`extra ${entry.id}: ${entry.text}`);
}

const EXPECTED_DIR = "fork/fixtures/expected";
for (const name of readdirSync(EXPECTED_DIR).filter((f) =>
  f.endsWith(".yaml"),
)) {
  const doc = parseYaml(readFileSync(`${EXPECTED_DIR}/${name}`, "utf8")) as {
    findings?: { id: string; items: string[] }[];
    passes?: { id: string; items: string[] }[];
  };
  for (const row of [...(doc.findings ?? []), ...(doc.passes ?? [])]) {
    for (const item of row.items)
      if (!byId.has(item))
        diffs.push(`${name} ${row.id}: unknown item ${item}`);
  }
}

const version = parseHandbookVersion(file) ?? parseHandbookVersion(markdown);
const registryVersions = new Set(REGISTRY.map((e) => e.handbookVersion));
if (version && (registryVersions.size !== 1 || !registryVersions.has(version)))
  diffs.push(
    `handbook version ${version} ≠ registry ${[...registryVersions].join(",")}`,
  );

console.log(
  `handbook ${file} (v${version ?? "?"}): ${parsed.length} items · registry ${REGISTRY.length} · ${diffs.length} diffs`,
);
for (const diff of diffs) console.log(diff);
process.exit(diffs.length === 0 ? 0 : 1);
