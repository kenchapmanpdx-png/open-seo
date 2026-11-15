import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agencyBrands, agencyClients } from "@/db/integrations-tables";
import { projects } from "@/db/schema";

// Agency brand (per organization) and client record (per project), ADR-017
// §1–2. Brand rows are keyed by organization; client rows by project and
// always filtered by organization too.

const nowIso = () => new Date().toISOString();

export async function projectExists(projectId: string, organizationId: string) {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function getBrand(organizationId: string) {
  const [row] = await db
    .select()
    .from(agencyBrands)
    .where(eq(agencyBrands.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

export async function upsertBrand(
  row: Omit<typeof agencyBrands.$inferInsert, "updatedAt">,
) {
  const values = { ...row, updatedAt: nowIso() };
  await db
    .insert(agencyBrands)
    .values(values)
    .onConflictDoUpdate({ target: agencyBrands.organizationId, set: values });
}

export async function getClient(projectId: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(agencyClients)
    .where(
      and(
        eq(agencyClients.projectId, projectId),
        eq(agencyClients.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function upsertClient(
  row: Omit<typeof agencyClients.$inferInsert, "updatedAt">,
) {
  const values = { ...row, updatedAt: nowIso() };
  await db
    .insert(agencyClients)
    .values(values)
    .onConflictDoUpdate({
      target: agencyClients.projectId,
      set: values,
      // Never move a project's client row across organizations.
      setWhere: eq(agencyClients.organizationId, row.organizationId),
    });
}
