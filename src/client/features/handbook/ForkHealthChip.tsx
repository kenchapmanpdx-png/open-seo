import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { applyForkLook } from "./forkTheme";
import { chipView, RESTART_FIX, type ChipView } from "./forkHealthView";
import { forkHealthQuery } from "./queries";

const DOT = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
} as const;

const UNREACHABLE: ChipView = {
  tone: "red",
  label: "App not answering health checks",
  fix: RESTART_FIX,
  testMode: false,
};

/**
 * App-wide fork status (B13 WO-B13-014, A2): green / amber / red with the
 * first failing check in plain words and a one-line fix. Hidden in hosted
 * mode (health is null) and while the first check loads.
 */

export function ForkHealthChip() {
  // The chip is in every app-shell page, so it also mounts the fork look
  // (B16 WO-B16-005, ADR-030) without an upstream edit.
  useEffect(applyForkLook, []);
  const { data: health, isError } = useQuery(forkHealthQuery());
  if (!health) return null;
  // A later health call failing (app or database down) is red too; the
  // last snapshot stays in the cache, so hosted mode (null) never gets here.
  const view = isError ? UNREACHABLE : chipView(health);
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-4 py-1 text-xs",
        view.tone === "red" && "bg-red-50 dark:bg-red-950/40",
        view.tone === "amber" && "bg-amber-50 dark:bg-amber-950/40",
      )}
    >
      {view.testMode ? (
        <span className="rounded border px-1.5 py-0.5 font-medium">
          Test mode
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", DOT[view.tone])} />
        <span className="font-medium">{view.label}</span>
      </span>
      {view.fix ? (
        <span className="text-muted-foreground">{view.fix}</span>
      ) : null}
    </div>
  );
}
