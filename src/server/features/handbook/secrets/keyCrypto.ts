import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { getAuth } from "@/lib/auth";

// Third-party API keys (Bing, BYOK) are always encrypted at rest, unlike
// upstream's OAuth tokens, which follow `encryptOAuthTokens` (ADR-014 §1).
export async function encryptKey(value: string): Promise<string> {
  const ctx = await getAuth().$context;
  return symmetricEncrypt({ key: ctx.secretConfig, data: value });
}

export async function decryptKey(value: string): Promise<string> {
  const ctx = await getAuth().$context;
  return symmetricDecrypt({ key: ctx.secretConfig, data: value });
}
