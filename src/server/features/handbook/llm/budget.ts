import type { CollectedData } from "@/server/features/handbook/contracts/collectors";

/**
 * Run LLM budget (ADR-019, FULL-READ §5.6): auto = $0.50 + $0.01 × pages
 * read, cap $5; `HANDBOOK_LLM_BUDGET_USD` (a positive number) overrides.
 * The map stage gets 60 %, the judge the other 40 %; each counts its own
 * spend against its share only.
 */

const AUTO_BASE_USD = 0.5;
const AUTO_PER_PAGE_USD = 0.01;
const AUTO_CAP_USD = 5;
const MAP_SHARE = 0.6;

function autoBudgetUsd(pages: number): number {
  return Math.min(AUTO_CAP_USD, AUTO_BASE_USD + AUTO_PER_PAGE_USD * pages);
}

/** The override in `HANDBOOK_LLM_BUDGET_USD`, or null when unset / not a positive number. */
function envBudgetUsd(raw: string | undefined): number | null {
  const value = Number(raw);
  return raw && Number.isFinite(value) && value > 0 ? value : null;
}

export type RunBudget = {
  /** Pages read by the crawl; set by the engine before the map stage and the checks. */
  setPages: (pages: number) => void;
  totalUsd: () => number;
  mapUsd: () => number;
  judgeUsd: () => number;
};

/** Budget resolved at call time, so it follows the page count the engine sets after the crawl. */
export function createRunBudget(raw: string | undefined): RunBudget {
  const override = envBudgetUsd(raw);
  let pages = 0;
  const totalUsd = () => override ?? autoBudgetUsd(pages);
  return {
    setPages: (n) => {
      pages = n;
    },
    totalUsd,
    mapUsd: () => totalUsd() * MAP_SHARE,
    judgeUsd: () => totalUsd() * (1 - MAP_SHARE),
  };
}

/** Pages the crawl read (page snapshots), 0 before the crawl stage. */
export function pagesRead(collected: Partial<CollectedData>): number {
  const pages = collected.pages;
  return pages?.status === "ok" ? pages.snapshots.length : 0;
}
