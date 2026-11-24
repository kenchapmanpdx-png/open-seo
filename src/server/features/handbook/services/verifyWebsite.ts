import {
  createSafeFetch,
  SafeFetchBlockedError,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";
import { AppError } from "@/server/lib/errors";

/**
 * WO-B20-010: before "Check a site" writes a project or a run, the website
 * must answer. `host` already passed `domainField` (public hostname, not an
 * IP); this adds DNS (SafeFetch's policy check) and one home-page fetch, so
 * two hosts glued together (`a.comb.ca`) or a typo fail as a form error.
 */
export async function verifyWebsite(host: string): Promise<{ domain: string }> {
  const fetcher = createSafeFetch({
    allowedHosts: siblingHosts(host),
    timeoutMs: 15_000,
    maxBytes: 64 * 1024,
  });
  try {
    await fetcher(`https://${host}/`, { method: "GET" });
    return { domain: host };
  } catch (error) {
    const reason =
      error instanceof SafeFetchBlockedError && error.reason === "dns"
        ? `${host} does not exist (no DNS record). Check the spelling.`
        : error instanceof SafeFetchBlockedError
          ? `${host} cannot be checked (${error.reason}).`
          : `${host} did not answer (${error instanceof Error ? error.message.slice(0, 120) : "no response"}).`;
    throw new AppError("VALIDATION_ERROR", reason);
  }
}
