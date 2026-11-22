import type { ItemStatus } from "@/server/features/handbook/contracts/status";
import type { Severity } from "@/server/features/handbook/contracts/registry-types";
import type { StageName } from "@/server/features/handbook/engine/stages";

/**
 * Plain words for build codes (B14 WO-B14-002, fork/NOVICE-UI.md §2).
 * One map for every Handbook view; codes appear only under "Details".
 */
type Label = { label: string; help: string };

export const STATUS_LABELS: Record<ItemStatus, Label> = {
  OPEN: {
    label: "Needs fixing",
    help: "The check found a problem on the site.",
  },
  PARTIAL: { label: "Partly done", help: "Some pages pass, some don't." },
  LIMITED: {
    label: "Limited fix",
    help: "Only partly fixable from the site itself (reason shown).",
  },
  BLOCKED: {
    label: "Couldn't check",
    help: "The app could not run this check; reason shown.",
  },
  NA: { label: "Doesn't apply", help: "Not relevant to this kind of site." },
  DEFERRED: { label: "Later", help: "Checked in a later step." },
  PASS: { label: "OK", help: "No problem found." },
};

export const SEVERITY_LABELS: Record<Severity, Label> = {
  S1: { label: "Must fix", help: "Hurts rankings or AI visibility now." },
  S2: {
    label: "Should fix",
    help: "Clear improvement; fix after the must-fixes.",
  },
  S3: { label: "Nice to have", help: "Small gain." },
  S4: { label: "Nice to have", help: "Small gain." },
};

export const AI_JUDGED: Label = {
  label: "AI-judged",
  help: "Found by the AI reviewer; never lowers the grade.",
};

export const TIER_LABEL = "Site size / type";
export const MODE_LABEL = "Check type";

const STAGE_LABELS: Record<StageName, string> = {
  crawl: "Reading pages",
  render: "Opening pages in a browser",
  axe: "Accessibility check",
  lighthouse: "Speed test",
  map: "AI review",
  reduce: "AI review",
  checks: "Running checks",
  report: "Writing the report",
};

/** Stage label for a stored stage name; unknown names pass through. */
export function stageLabel(stage: string): string {
  const labels: Record<string, string> = STAGE_LABELS;
  return Object.hasOwn(labels, stage) ? labels[stage] : stage;
}

/**
 * Handbook page "More tools" menu (B16 WO-B16-001): plain names for the
 * fork pages, named after what each page does. `to` is the route under
 * `/p/$projectId/handbook/`; null = the writing-rules dialog.
 */
export const MORE_TOOLS = [
  {
    to: "overview",
    label: "Everything at a glance",
    help: "Site check results, AI visitors and AI answers on one page.",
  },
  {
    to: "ai-traffic",
    label: "AI visitors",
    help: "Which AI bots read your site and which AI answers send people to it.",
  },
  {
    to: "bing",
    label: "Bing data",
    help: "Bing's view of your site: crawl problems, searches and Copilot mentions.",
  },
  {
    to: "ai-visibility-byok",
    label: "AI answers with your own keys",
    help: "Ask ChatGPT, Claude, Gemini and Perplexity directly, billed to your own accounts.",
  },
  {
    to: "backlinks-cc",
    label: "Who links to you (free)",
    help: "Sites that link to yours, from a free public web index.",
  },
  {
    to: "agency",
    label: "Your brand on reports",
    help: "Your logo and your client's name on the reports you share.",
  },
  {
    to: null,
    label: "Writing rules",
    help: "Rules to give whoever rewrites your page text, person or AI.",
  },
] as const;
