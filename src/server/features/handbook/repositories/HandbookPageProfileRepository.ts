import { and, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import { handbookPageProfiles } from "@/db/handbook-tables";
import { pageProfileSchema } from "@/server/features/handbook/contracts/page-profile";
import type { ProfileCache } from "@/server/features/handbook/llm/map";

/**
 * `handbook_page_profile` (ADR-019): the map stage's PageProfile cache,
 * project-scoped and keyed by (url, text sha256, prompt version, model).
 * `profile_json` is the verified K14 document, parsed with
 * `pageProfileSchema` on read; a row that no longer parses is a miss.
 */
function forProject(projectId: string, runId: string): ProfileCache {
  return {
    async get(key) {
      const rows = await db
        .select({
          id: handbookPageProfiles.id,
          profileJson: handbookPageProfiles.profileJson,
        })
        .from(handbookPageProfiles)
        .where(
          and(
            eq(handbookPageProfiles.projectId, projectId),
            eq(handbookPageProfiles.url, key.url),
            eq(handbookPageProfiles.textSha256, key.textSha256),
            eq(handbookPageProfiles.promptVersion, key.promptVersion),
            eq(handbookPageProfiles.model, key.model),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      let json: unknown;
      try {
        json = JSON.parse(row.profileJson);
      } catch {
        return null;
      }
      const parsed = pageProfileSchema.safeParse(json);
      if (!parsed.success) return null;
      await db
        .update(handbookPageProfiles)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(handbookPageProfiles.id, row.id));
      return parsed.data;
    },
    async put(profile) {
      await db
        .insert(handbookPageProfiles)
        .values({
          id: crypto.randomUUID(),
          projectId,
          runId,
          url: profile.url,
          textSha256: profile.textSha256,
          promptVersion: profile.promptVersion,
          model: profile.model,
          scope: profile.scope,
          templateKey: profile.templateKey,
          pageType: profile.pageType,
          profileJson: JSON.stringify(profile),
          droppedQuotes: profile.droppedQuotes,
          tokensIn: profile.tokensIn,
          tokensOut: profile.tokensOut,
          costUsd: profile.costUsd,
        })
        .onConflictDoNothing();
    },
  };
}

/** Map-stage spend of one run: the profiles it created (WO-B27-005). */
async function runCostUsd(projectId: string, runId: string): Promise<number> {
  const [row] = await db
    .select({ usd: sum(handbookPageProfiles.costUsd).mapWith(Number) })
    .from(handbookPageProfiles)
    .where(
      and(
        eq(handbookPageProfiles.projectId, projectId),
        eq(handbookPageProfiles.runId, runId),
      ),
    );
  return row?.usd ?? 0;
}

export const HandbookPageProfileRepository = { forProject, runCostUsd };
