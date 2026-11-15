import { getByokKey } from "@/server/features/handbook/secrets/CredentialRepository";
import { anthropicProvider } from "./anthropic";
import type { ByokProviderId } from "./contracts";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";
import { perplexityProvider } from "./perplexity";
import type { ByokProvider } from "./types";

export const byokProviders: Record<ByokProviderId, ByokProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  perplexity: perplexityProvider,
};

/** A provider is usable when the organization (or local env) has its key. */
export async function isByokProviderConfigured(
  organizationId: string,
  provider: ByokProviderId,
): Promise<boolean> {
  return (await getByokKey(organizationId, provider)) !== null;
}
