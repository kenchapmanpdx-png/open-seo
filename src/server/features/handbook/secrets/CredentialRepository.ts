import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bingCredentials, byokAiCredentials } from "@/db/integrations-tables";
import { getAuthMode } from "@/lib/auth-mode";
import type { ByokProviderId } from "@/server/features/ai-visibility/providers/byok/contracts";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { decryptKey, encryptKey } from "./keyCrypto";

// Org-scoped third-party API keys (ADR-014 §1, ADR-015 §2). Keys stay on the
// server: client-facing callers get `KeyStatus` only.

type KeySource = "org" | "env";
type ResolvedKey = { key: string; source: KeySource };
export type KeyStatus = { configured: boolean; source: KeySource | null };

const BYOK_ENV: Record<ByokProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

// Env keys belong to the operator, so only the single-tenant local mode may
// fall back to them; hosted modes would share one key across organizations.
async function envFallback(name: string): Promise<ResolvedKey | null> {
  const mode = getAuthMode(await getOptionalEnvValue("AUTH_MODE"));
  if (mode !== "local_noauth") return null;
  const key = await getOptionalEnvValue(name);
  return key ? { key, source: "env" } : null;
}

async function resolve(
  encrypted: string | undefined,
  envName: string,
): Promise<ResolvedKey | null> {
  if (encrypted) return { key: await decryptKey(encrypted), source: "org" };
  return envFallback(envName);
}

export function toKeyStatus(resolved: ResolvedKey | null): KeyStatus {
  return { configured: resolved !== null, source: resolved?.source ?? null };
}

export async function getBingKey(
  organizationId: string,
): Promise<ResolvedKey | null> {
  const [row] = await db
    .select({ encryptedApiKey: bingCredentials.encryptedApiKey })
    .from(bingCredentials)
    .where(eq(bingCredentials.organizationId, organizationId))
    .limit(1);
  return resolve(row?.encryptedApiKey, "BING_WEBMASTER_API_KEY");
}

export async function setBingKey(organizationId: string, key: string) {
  const encryptedApiKey = await encryptKey(key);
  const updatedAt = new Date().toISOString();
  await db
    .insert(bingCredentials)
    .values({ organizationId, encryptedApiKey, updatedAt })
    .onConflictDoUpdate({
      target: bingCredentials.organizationId,
      set: { encryptedApiKey, updatedAt },
    });
}

export async function deleteBingKey(organizationId: string) {
  await db
    .delete(bingCredentials)
    .where(eq(bingCredentials.organizationId, organizationId));
}

export async function getByokKey(
  organizationId: string,
  provider: ByokProviderId,
): Promise<ResolvedKey | null> {
  const [row] = await db
    .select({ encryptedApiKey: byokAiCredentials.encryptedApiKey })
    .from(byokAiCredentials)
    .where(
      and(
        eq(byokAiCredentials.organizationId, organizationId),
        eq(byokAiCredentials.provider, provider),
      ),
    )
    .limit(1);
  return resolve(row?.encryptedApiKey, BYOK_ENV[provider]);
}

export async function setByokKey(
  organizationId: string,
  provider: ByokProviderId,
  key: string,
) {
  const encryptedApiKey = await encryptKey(key);
  const updatedAt = new Date().toISOString();
  await db
    .insert(byokAiCredentials)
    .values({ organizationId, provider, encryptedApiKey, updatedAt })
    .onConflictDoUpdate({
      target: [byokAiCredentials.organizationId, byokAiCredentials.provider],
      set: { encryptedApiKey, updatedAt },
    });
}

export async function deleteByokKey(
  organizationId: string,
  provider: ByokProviderId,
) {
  await db
    .delete(byokAiCredentials)
    .where(
      and(
        eq(byokAiCredentials.organizationId, organizationId),
        eq(byokAiCredentials.provider, provider),
      ),
    );
}
