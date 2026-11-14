// Parses the handbook's §41 checklist into items in document order.
import {
  phaseSchema,
  tierSchema,
  type RegistryEntry,
} from "./contracts/registry-types";

type ParsedItem = Pick<
  RegistryEntry,
  "id" | "phase" | "text" | "refs" | "tags"
>;

const TAG_RE = /^\[(T1\+|T2\+|T3\+|T4|AUDIT|REVIEW|gate: [^\]]+)\]\s*/;
const BUILD_RE = /^\(BUILD: at (P\d+)\)\s*/;

export function parseHandbookVersion(markdown: string): string | null {
  const match = /unified-v(\d+\.\d+)|\bv(\d+\.\d+)\b/.exec(markdown);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

export function parseSection41(markdown: string): ParsedItem[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith("## 41."));
  if (start === -1) throw new Error("§41 not found");

  const items: ParsedItem[] = [];
  let phase: ParsedItem["phase"] | null = null;
  let count = 0;

  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    const header = /^### (P\d+|REVIEW)\b/.exec(line);
    if (header) {
      phase = phaseSchema.parse(header[1]);
      count = 0;
      continue;
    }
    if (!line.startsWith("- [ ] ")) continue;
    if (!phase) throw new Error(`item before any phase header: ${line}`);

    count += 1;
    const text = line.slice("- [ ] ".length);
    items.push({
      id: `${phase === "REVIEW" ? "RV" : phase}-${String(count).padStart(2, "0")}`,
      phase,
      text,
      refs: parseRefs(text),
      tags: parseTags(text),
    });
  }
  return items;
}

function parseTags(text: string): ParsedItem["tags"] {
  const tags: ParsedItem["tags"] = {
    tier: null,
    audit: false,
    review: false,
    gate: null,
    buildPhase: null,
  };
  let rest = text;
  for (;;) {
    const tag = TAG_RE.exec(rest);
    if (tag) {
      const value = tag[1];
      if (value === "AUDIT") tags.audit = true;
      else if (value === "REVIEW") tags.review = true;
      else if (value.startsWith("gate: ")) tags.gate = value.slice(6);
      else tags.tier = tierSchema.parse(value);
      rest = rest.slice(tag[0].length);
      continue;
    }
    const build = BUILD_RE.exec(rest);
    if (build) {
      tags.buildPhase = build[1];
      rest = rest.slice(build[0].length);
      continue;
    }
    return tags;
  }
}

function parseRefs(text: string): number[] {
  const refs: number[] = [];
  for (const match of text.matchAll(/§(\d+)(?:[–-](\d+))?/g)) {
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    for (let n = from; n <= to; n += 1) if (!refs.includes(n)) refs.push(n);
  }
  return refs;
}
