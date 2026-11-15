import type { FollowupBatch } from "./followups";

/**
 * Client report "Results since last report" (ADR-017 §3): the newest
 * completed +4/+12-week checks from the outcome record, up to the report
 * date. Per metric: before → after summed over the batch URLs; handbook
 * status as items now passing. A source that was not connected shows
 * "not connected", never an estimate.
 */

const MAX_CHECKS = 3;

const LABELS: Record<string, string> = {
  gsc_impressions_28d: "Google impressions (28 days)",
  gsc_clicks_28d: "Google clicks (28 days)",
  bing_clicks_28d: "Bing clicks (28 days)",
  ai_referrals_28d: "Visits from AI assistants (28 days)",
  ai_crawler_hits_verified_28d: "Verified AI crawler visits (28 days)",
  ai_answer_mentions: "AI answers citing these pages (28 days)",
  index_state: "Pages indexed by Google",
};

type Check = FollowupBatch["checks"][number] & { fixedAt: string };
type Metric = Check["metrics"][number];

function metricRow(metric: string, rows: Metric[]): [string, string, string] {
  const label = LABELS[metric] ?? metric;
  if (metric === "handbook_status") {
    const passing = (pick: (r: Metric) => string | null) =>
      rows.filter((r) => pick(r) === "PASS").length;
    return [
      "Fixed problems now passing the check",
      `${passing((r) => r.beforeValue)} of ${rows.length}`,
      `${passing((r) => r.afterValue)} of ${rows.length}`,
    ];
  }
  // URL metrics repeat once per finding class on the URL: count each URL once.
  const byUrl = new Map(rows.map((r) => [r.url, r]));
  const urlRows = [...byUrl.values()];
  if (metric === "index_state") {
    const indexed = urlRows.filter(
      (r) =>
        /indexed/i.test(r.afterValue ?? "") &&
        !/not indexed/i.test(r.afterValue ?? ""),
    ).length;
    return [label, "—", `${indexed} of ${urlRows.length}`];
  }
  const sum = (pick: (r: Metric) => string | null) => {
    const values = urlRows.map(pick);
    if (values.every((v) => v === null)) return "not connected";
    return String(values.reduce((n, v) => n + (Number(v) || 0), 0));
  };
  return [label, sum((r) => r.beforeValue), sum((r) => r.afterValue)];
}

export function renderResultsSection(
  batches: readonly FollowupBatch[],
  reportDate: string,
  esc: (text: string) => string,
): string {
  const checks: Check[] = batches
    .flatMap((b) => b.checks.map((c) => ({ ...c, fixedAt: b.fixedAt })))
    .filter(
      (c) =>
        c.status === "done" &&
        c.completedAt !== null &&
        c.completedAt <= reportDate,
    )
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, MAX_CHECKS);
  if (checks.length === 0) return "";
  const parts = ["<h2>Results since last report</h2>"];
  for (const check of checks) {
    const byMetric = new Map<string, Metric[]>();
    for (const m of check.metrics)
      byMetric.set(m.metric, [...(byMetric.get(m.metric) ?? []), m]);
    const urls = new Set(check.metrics.map((m) => m.url)).size;
    parts.push(
      `<h3>Fixes from ${esc(check.fixedAt.slice(0, 10))}, checked ${check.offsetWeeks} weeks later (${urls} page(s))</h3>`,
      `<table><tr><th>Measure</th><th>Before</th><th>After</th></tr>${[
        ...byMetric,
      ]
        .map(([metric, rows]) => metricRow(metric, rows))
        .map(
          ([label, before, after]) =>
            `<tr><td>${esc(label)}</td><td>${esc(before)}</td><td>${esc(after)}</td></tr>`,
        )
        .join("")}</table>`,
    );
  }
  parts.push(
    '<p class="muted">Before = the 28 days before the fix; after = the 28 days before the check. Search results move for many reasons; these numbers are a record, not a promise.</p>',
  );
  return parts.join("");
}
