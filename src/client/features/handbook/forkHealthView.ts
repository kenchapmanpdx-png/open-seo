// Plain-words view of the fork health snapshot (B13 WO-B13-014, ADR-028):
// the app-wide status chip and the warnings on the "Run full audit" button.
import type { ForkHealth } from "@/server/features/handbook/ops/health";

export type ChipView = {
  tone: "green" | "amber" | "red";
  label: string;
  fix: string | null;
  testMode: boolean;
};

export const RESTART_FIX =
  "Run `bash fork/scripts/run-local.sh ops restart app`.";

/** First failing check, most serious first; green when nothing fails. */
export function chipView(health: ForkHealth): ChipView {
  const view = (tone: ChipView["tone"], label: string, fix: string | null) => ({
    tone,
    label,
    fix,
    testMode: health.testMode,
  });
  const { db, sidecar, llm, cron } = health.checks;
  if (!db.ok) return view("red", "Database not reachable", RESTART_FIX);
  if (health.watchdog?.buildFailed)
    return view(
      "amber",
      "Last build failed; the previous build is running",
      "Check `bash fork/scripts/run-local.sh ops status`, then restart the app.",
    );
  if (!sidecar.ok)
    return view(
      "amber",
      "Browser helper is off",
      "Start it: `bash fork/scripts/run-local.sh ops sidecar start`.",
    );
  if (!llm.configured)
    return view(
      "amber",
      "No AI key",
      "Add OPENROUTER_API_KEY to .env.local, then restart the app.",
    );
  if (cron.state === "stale")
    return view("amber", "Scheduled jobs stopped", RESTART_FIX);
  if (health.watchdog?.selftest && !health.watchdog.selftest.ok)
    return view(
      "amber",
      "Weekly self-test failed",
      "See fork/runs/_ops/selftest.json.",
    );
  return view("green", "All systems working", null);
}

type RunButtonView = {
  disabledReason: string | null;
  warnings: string[];
};

/** What the "Run full audit" button may do, given the current health. */
export function runButtonView(health: ForkHealth | null): RunButtonView {
  if (!health) return { disabledReason: null, warnings: [] };
  const { db, sidecar, llm } = health.checks;
  if (!db.ok)
    return {
      disabledReason: `Database not reachable${db.error ? `: ${db.error}` : ""}.`,
      warnings: [],
    };
  const warnings: string[] = [];
  if (!sidecar.ok)
    warnings.push(
      "Browser helper is off: browser render, accessibility and Lighthouse checks will be skipped.",
    );
  if (!llm.configured)
    warnings.push("No AI key: AI-judged items will be skipped.");
  if (health.testMode)
    warnings.push(
      "Test mode is on: Handbook reads fewer pages and spends less on AI.",
    );
  return { disabledReason: null, warnings };
}
