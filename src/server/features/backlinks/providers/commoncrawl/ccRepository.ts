import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  ccBacklinkDomains,
  ccBacklinkSummaries,
  ccTargets,
} from "@/db/integrations-tables";
import { projects } from "@/db/schema";

// Common Crawl baseline reads for the card + MCP (ADR-016 §4). Rows are written
// by the local CLI (fork/scripts/commoncrawl-backlinks.ts). Every read is
// scoped by project + organization, or joins to a scoped target.

export async function getProjectDomain(
  projectId: string,
  organizationId: string,
) {
  const [row] = await db
    .select({ domain: projects.domain })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row;
}

export function listTargets(projectId: string, organizationId: string) {
  return db
    .select({
      id: ccTargets.id,
      domain: ccTargets.domain,
      enabled: ccTargets.enabled,
    })
    .from(ccTargets)
    .where(
      and(
        eq(ccTargets.projectId, projectId),
        eq(ccTargets.organizationId, organizationId),
      ),
    );
}

export async function upsertTarget(input: {
  projectId: string;
  organizationId: string;
  domain: string;
  enabled: boolean;
}) {
  await db
    .insert(ccTargets)
    .values({ id: crypto.randomUUID(), ...input })
    .onConflictDoUpdate({
      target: [ccTargets.projectId, ccTargets.domain],
      set: { enabled: input.enabled },
    });
}

/** Summaries of the given (already scoped) targets. */
export function listSummaries(targetIds: string[]) {
  if (targetIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      id: ccBacklinkSummaries.id,
      targetId: ccBacklinkSummaries.targetId,
      releaseId: ccBacklinkSummaries.releaseId,
      referringDomains: ccBacklinkSummaries.referringDomains,
    })
    .from(ccBacklinkSummaries)
    .where(inArray(ccBacklinkSummaries.targetId, targetIds));
}

/** Linking domains of the given (already scoped) summaries. */
export function listDomains(summaryIds: string[]) {
  if (summaryIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      summaryId: ccBacklinkDomains.summaryId,
      linkingDomain: ccBacklinkDomains.linkingDomain,
      numHosts: ccBacklinkDomains.numHosts,
    })
    .from(ccBacklinkDomains)
    .where(inArray(ccBacklinkDomains.summaryId, summaryIds));
}
