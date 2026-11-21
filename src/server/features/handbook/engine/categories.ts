import {
  HANDBOOK_CATEGORIES,
  type HandbookCategory,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import {
  ITEM_SCORE,
  S1_CAP,
} from "@/server/features/handbook/contracts/scoring";
import registryTags from "../registry-tags.json";
import { SUPP_BY_ID } from "../registry-supp";

const TAGS: Readonly<Record<string, readonly string[]>> = registryTags;

/** SEO / GEO / AEO tags of one registry or SUPP item (ADR-029); [] = process item. */
const itemCategories = (itemId: string): HandbookCategory[] =>
  HANDBOOK_CATEGORIES.filter((c) => TAGS[itemId]?.includes(c));

const unionOf = (itemIds: readonly string[]): HandbookCategory[] => {
  const all = new Set(itemIds.flatMap(itemCategories));
  return HANDBOOK_CATEGORIES.filter((c) => all.has(c));
};

/**
 * ADR-029: finding `categories` (union of its items' tags) and report
 * `categoryScores` — pass share of the scored §41 items carrying the tag
 * (ITEM_SCORE, SUPP excluded like the overall score), capped at S1_CAP when
 * an OPEN / PARTIAL tagged item links a non-LLM S1 finding; null with no
 * applicable item. The overall score is untouched.
 */
export function withCategories(report: ReportJson): ReportJson {
  const s1Codes = new Set(
    report.findings
      .filter((f) => f.severity === "S1" && f.source !== "llm")
      .map((f) => f.code),
  );
  const scoreOf = (category: HandbookCategory): number | null => {
    let applicable = 0;
    let points = 0;
    let capped = false;
    for (const item of report.items) {
      if (SUPP_BY_ID.has(item.itemId)) continue;
      if (!itemCategories(item.itemId).includes(category)) continue;
      const value = ITEM_SCORE[item.status];
      if (value === null) continue;
      applicable += 1;
      points += value;
      if (
        (item.status === "OPEN" || item.status === "PARTIAL") &&
        item.findingCodes.some((code) => s1Codes.has(code))
      )
        capped = true;
    }
    if (applicable === 0) return null;
    const score = Math.round((points / applicable) * 100);
    return capped ? Math.min(score, S1_CAP) : score;
  };
  const tag = <F extends { itemIds: string[] }>(f: F) => ({
    ...f,
    categories: unionOf(f.itemIds),
  });
  return {
    ...report,
    findings: report.findings.map(tag),
    ...(report.additionalFindings
      ? { additionalFindings: report.additionalFindings.map(tag) }
      : {}),
    categoryScores: {
      SEO: scoreOf("SEO"),
      GEO: scoreOf("GEO"),
      AEO: scoreOf("AEO"),
    },
  };
}
