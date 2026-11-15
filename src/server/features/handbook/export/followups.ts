import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";

/**
 * `seo-followups.md` (handbook EP-5 / P11 outcome record, ADR-017 §3):
 * per fix batch and check → finding class → URL → before/after per metric,
 * then the classes with no measurable change. Never a ranking promise.
 */

type FollowupMetric = {
  itemId: string;
  url: string;
  metric: string;
  beforeValue: string | null;
  afterValue: string | null;
  source: string;
};

type FollowupBatch = {
  batchId: string;
  baselineRunId: string;
  fixedAt: string;
  checks: {
    offsetWeeks: number;
    dueAt: string;
    status: string;
    completedAt: string | null;
    metrics: FollowupMetric[];
  }[];
};

const cell = (text: string | null) =>
  text === null ? "BLOCKED" : text.replace(/\|/g, "\\|").replace(/\s+/g, " ");

/** A class changed when any connected metric moved. */
const changed = (rows: FollowupMetric[]) =>
  rows.some((r) => r.beforeValue !== null && r.beforeValue !== r.afterValue);

function renderCheck(
  check: FollowupBatch["checks"][number],
  titleOf: Map<string, string>,
) {
  const lines = [
    `### +${check.offsetWeeks} weeks — ${check.status}${
      check.completedAt
        ? ` ${check.completedAt.slice(0, 10)}`
        : ` (due ${check.dueAt.slice(0, 10)})`
    }`,
    "",
  ];
  if (check.metrics.length === 0) return lines;
  const groups = new Map<string, FollowupMetric[]>();
  for (const m of check.metrics) {
    const key = `${m.itemId}\n${m.url}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const unchanged: string[] = [];
  for (const [key, rows] of groups) {
    const [itemId, url] = key.split("\n");
    lines.push(
      `#### ${itemId} ${titleOf.get(itemId) ?? ""} — ${url}`.trimEnd(),
      "",
      "| Metric | Before | After | Source |",
      "| --- | --- | --- | --- |",
      ...rows.map(
        (r) =>
          `| ${r.metric} | ${cell(r.beforeValue)} | ${cell(r.afterValue)} | ${cell(r.source)} |`,
      ),
      "",
    );
    if (!changed(rows)) unchanged.push(`- ${itemId} — ${url}`);
  }
  if (unchanged.length > 0)
    lines.push("No measurable change:", "", ...unchanged, "");
  return lines;
}

export function renderFollowupsMd(
  batches: readonly FollowupBatch[],
  registry: readonly RegistryEntry[],
  handbookVersion: string,
): string {
  const titleOf = new Map(registry.map((e) => [e.id, e.text.slice(0, 80)]));
  const lines = [
    "# SEO follow-ups (outcome record)",
    "",
    `Not a ranking promise; handbook v${handbookVersion}. BLOCKED = source not connected; values are never estimated.`,
    "",
  ];
  if (batches.length === 0) lines.push("No fix batches recorded yet.", "");
  for (const batch of batches) {
    lines.push(
      `## Fix batch ${batch.fixedAt.slice(0, 10)} (baseline run ${batch.baselineRunId.slice(0, 8)})`,
      "",
    );
    for (const check of batch.checks)
      lines.push(...renderCheck(check, titleOf));
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
