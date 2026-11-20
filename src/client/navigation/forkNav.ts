import { ClipboardList, ListChecks, Play } from "lucide-react";
import { linkOptions } from "@tanstack/react-router";

/**
 * Fork sidebar (B14 WO-B14-005, ADR-029 §7–8, NOVICE-UI §2 / §5).
 * Called from upstream `getProjectNavGroups` (A12). Upstream items are placed
 * by path; any upstream item this map does not know lands in "More", so pages
 * added upstream after a rebase stay reachable.
 *
 * AI Search: all three upstream pages navigate to their own routes (tab
 * switches, searches, history links), so the §5 tab page falls back to the
 * three upstream routes listed under plain names.
 */

type NavItem = { to: string; label: string };

declare global {
  interface ImportMetaEnv {
    readonly VITE_FORK_NAV?: string;
  }
}

const GROUPS: { label: string; paths: string[] }[] = [
  { label: "Overview", paths: ["/p/$projectId"] },
  {
    label: "Check & Fix",
    paths: [
      "/p/$projectId/handbook/check",
      "/p/$projectId/handbook",
      "/p/$projectId/audit",
    ],
  },
  {
    label: "My Search Data",
    paths: [
      "/p/$projectId/search-performance",
      "/p/$projectId/rank-tracking",
      "/p/$projectId/local-seo",
    ],
  },
  {
    label: "Keywords & Competitors",
    paths: [
      "/p/$projectId/keywords",
      "/p/$projectId/saved",
      "/p/$projectId/domain",
      "/p/$projectId/backlinks",
    ],
  },
  {
    label: "AI Search",
    paths: [
      "/p/$projectId/ai-visibility",
      "/p/$projectId/ai-visibility/research",
      "/p/$projectId/prompt-explorer",
    ],
  },
  {
    label: "More",
    paths: [
      "/p/$projectId/handbook/overview",
      "/p/$projectId/reports",
      "/p/$projectId/context",
      "/ai",
    ],
  },
];

// Plain names (NOVICE-UI §2 table); Fix list gets its own icon, as upstream
// Site Audit already uses ClipboardCheck.
const PLAIN: Record<string, { label: string; icon?: typeof ListChecks }> = {
  "/p/$projectId/handbook": { label: "Fix list", icon: ListChecks },
  "/p/$projectId/audit": { label: "Site Audit (basic crawl)" },
  "/p/$projectId/search-performance": { label: "Google Search Console" },
  "/p/$projectId/ai-visibility": { label: "Track AI answers" },
  "/p/$projectId/ai-visibility/research": { label: "Find AI questions" },
  "/p/$projectId/prompt-explorer": { label: "Ask AI engines" },
};

function forkItems(projectId: string) {
  return linkOptions([
    {
      to: "/p/$projectId/handbook/check" as const,
      label: "Check a site",
      icon: Play,
      params: { projectId },
      search: {},
    },
    {
      to: "/p/$projectId/handbook/overview" as const,
      label: "Handbook extras",
      icon: ClipboardList,
      params: { projectId },
      search: {},
    },
  ]);
}

/** `null` = upstream sidebar (escape hatch: build with `VITE_FORK_NAV=0`). */
export function getForkNavGroups<T extends NavItem, A extends NavItem>(
  projectId: string,
  all: readonly T[],
  aiNavItem: A,
) {
  if (import.meta.env.VITE_FORK_NAV === "0") return null;
  const pool = [...all, aiNavItem, ...forkItems(projectId)].map((item) => {
    const plain = PLAIN[item.to];
    if (!plain) return item;
    return {
      ...item,
      label: plain.label,
      ...(plain.icon ? { icon: plain.icon } : {}),
      // The index page only; run pages and extras have their own rows.
      ...(item.to === "/p/$projectId/handbook"
        ? { activeOptions: { exact: true, includeSearch: false } }
        : {}),
    };
  });
  const placed = new Set(GROUPS.flatMap((g) => g.paths));
  const groups = GROUPS.map((group) => ({
    label: group.label,
    items: group.paths.flatMap((path) => pool.filter((i) => i.to === path)),
  }));
  groups[groups.length - 1].items.push(
    ...pool.filter((i) => !placed.has(i.to)),
  );
  return groups.filter((g) => g.items.length > 0);
}
