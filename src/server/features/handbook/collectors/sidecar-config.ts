import type { HandbookDepth } from "@/server/features/handbook/contracts/exports";
import {
  healthResponseSchema,
  SIDECAR_DEFAULT_URL,
} from "@/server/features/handbook/contracts/sidecar";
import { CONTRACTS_VERSION } from "@/server/features/handbook/contracts/version";
import { resolveLighthouseScope } from "@/server/features/handbook/engine/depth";
import type { SidecarConfig } from "./sidecar-collectors";

/**
 * In-app sidecar wiring (WO-B13-007, ADR-028). Pure: null when the token is
 * unset, so the run keeps the raw-fetch collectors only. The URL is operator
 * config and defaults to the local sidecar.
 */
export function sidecarConfigFromEnv(
  env: {
    token: string | undefined; // HANDBOOK_SIDECAR_TOKEN
    url: string | undefined; // HANDBOOK_SIDECAR_URL
    lighthouse: string | undefined; // HANDBOOK_LIGHTHOUSE
    concurrency: string | undefined; // HANDBOOK_RENDER_CONCURRENCY
  },
  depth: HandbookDepth,
): SidecarConfig | null {
  if (!env.token) return null;
  return {
    url: env.url || SIDECAR_DEFAULT_URL,
    token: env.token,
    depth,
    lighthouse: resolveLighthouseScope(env.lighthouse),
    concurrency: Number(env.concurrency) || undefined,
  };
}

const HEALTH_TIMEOUT_MS = 3_000;

/**
 * null = usable. Otherwise the reason the browser stages are skipped:
 * "sidecar token not set" | "sidecar unreachable: <cause>"
 * | "sidecar contracts <got> ≠ app <want>" | "sidecar token rejected".
 * The token is sent only as a Bearer header and never logged.
 */
export async function probeSidecar(
  config: SidecarConfig | null,
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<string | null> {
  if (!config) return "sidecar token not set";
  const base = config.url.replace(/\/$/, "");
  try {
    const res = await fetchImpl(`${base}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    const health = healthResponseSchema.safeParse(
      await res.json().catch(() => null),
    );
    if (!res.ok || !health.success)
      return `sidecar unreachable: /health ${res.status}`;
    if (health.data.contractsVersion !== CONTRACTS_VERSION)
      return `sidecar contracts ${health.data.contractsVersion} ≠ app ${CONTRACTS_VERSION}`;
    const check = await fetchImpl(`${base}/token-check`, {
      headers: { authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return check.status === 401 ? "sidecar token rejected" : null;
  } catch (error) {
    const cause =
      error instanceof Error
        ? error.name === "TimeoutError"
          ? "timeout after 3 s"
          : error.message
        : String(error);
    return `sidecar unreachable: ${cause.slice(0, 200)}`;
  }
}
