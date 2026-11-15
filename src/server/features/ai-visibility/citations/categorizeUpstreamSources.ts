import { eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import { aiSourceCategories } from "@/db/integrations-tables";
import { runBatch } from "@/db/runBatch";
import { aiMatches, aiSources } from "@/db/schema";
import { CATEGORIES_VERSION, categorizeSource } from "./categorize";

// 5-minute job (ADR-015 §4): categorize upstream `ai_sources` rows that have
// no `ai_source_category` row or one from an older CATEGORIES_VERSION. Brand
// and competitor domains are the brands matched on the same observation
// (`ai_matches.own`). Reads upstream tables; writes only the fork table.

const BATCH = 2_000;
const ROWS_PER_STATEMENT = 25; // 4 columns × 25 = 100 D1 parameters
const STATEMENTS_PER_BATCH = 20;
const excluded = (column: string) => sql.raw(`excluded.${column}`);

export async function categorizeUpstreamSources() {
  const sources = await db
    .select({
      id: aiSources.id,
      observationId: aiSources.observationId,
      url: aiSources.url,
      domain: aiSources.domain,
      title: aiSources.title,
    })
    .from(aiSources)
    .leftJoin(aiSourceCategories, eq(aiSourceCategories.sourceId, aiSources.id))
    .where(
      or(
        isNull(aiSourceCategories.sourceId),
        ne(aiSourceCategories.categoriesVersion, CATEGORIES_VERSION),
      ),
    )
    .limit(BATCH);
  if (sources.length === 0) return { categorized: 0 };

  const brands = new Map<string, { own: string[]; competitor: string[] }>();
  const observationIds = [...new Set(sources.map((s) => s.observationId))];
  for (const ids of chunk(observationIds, 90)) {
    const matches = await db
      .select({
        observationId: aiMatches.observationId,
        domain: aiMatches.domain,
        own: aiMatches.own,
      })
      .from(aiMatches)
      .where(inArray(aiMatches.observationId, ids));
    for (const match of matches) {
      const entry = brands.get(match.observationId) ?? {
        own: [],
        competitor: [],
      };
      (match.own ? entry.own : entry.competitor).push(match.domain);
      brands.set(match.observationId, entry);
    }
  }

  const rows = sources.map((source) => {
    const entry = brands.get(source.observationId);
    const { category, pageType } = categorizeSource({
      url: source.url,
      domain: source.domain,
      title: source.title,
      ownDomains: entry?.own ?? [],
      competitorDomains: entry?.competitor ?? [],
    });
    return {
      sourceId: source.id,
      category,
      pageType,
      categoriesVersion: CATEGORIES_VERSION,
    };
  });
  for (const part of chunk(
    chunk(rows, ROWS_PER_STATEMENT),
    STATEMENTS_PER_BATCH,
  )) {
    await runBatch((tx) =>
      part.map((group) =>
        tx
          .insert(aiSourceCategories)
          .values(group)
          .onConflictDoUpdate({
            target: aiSourceCategories.sourceId,
            set: {
              category: excluded("category"),
              pageType: excluded("page_type"),
              categoriesVersion: excluded("categories_version"),
            },
          }),
      ),
    );
  }
  return { categorized: rows.length };
}

export const categorizeSourcesJob = {
  name: "ai-visibility:categorize-sources",
  run: () => categorizeUpstreamSources(),
};
