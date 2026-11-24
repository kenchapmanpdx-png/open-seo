import {
  createSafeFetch,
  SafeFetchBlockedError,
  siblingHosts,
} from "@/server/features/handbook/engine/safe-fetch";

/**
 * WO-B20-010: before "Check a site" writes a project or a run, the website
 * must answer. `host` already passed `domainField` (public hostname, not an
 * IP); this adds DNS (SafeFetch's policy check) and one home-page fetch, so
 * two hosts glued together (`a.comb.ca`) or a typo fail as a form error.
 * On workerd a host with no DNS record passes the DNS policy (it fails open)
 * and the fetch itself throws, so "did not answer" also names the spelling.
 * The reason is returned, not thrown: a thrown AppError reaches the client as
 * its bare code. Every reason is built here from the host and a fixed reason
 * word, so it carries no server internals.
 */
export async function verifyWebsite(
  host: string,
): Promise<{ ok: true; domain: string } | { ok: false; reason: string }> {
  const fetcher = createSafeFetch({
    allowedHosts: siblingHosts(host),
    timeoutMs: 15_000,
    maxBytes: 64 * 1024,
  });
  try {
    await fetcher(`https://${host}/`, { method: "GET" });
    return { ok: true, domain: host };
  } catch (error) {
    console.warn("handbook.verifyWebsite", host, error);
    const reason: string =
      error instanceof SafeFetchBlockedError && error.reason === "dns"
        ? `${host} does not exist (no DNS record). Check the spelling.`
        : error instanceof SafeFetchBlockedError
          ? `${host} cannot be checked (${error.reason}).`
          : `${host} did not answer. Check the spelling and that the site is online.`;
    return { ok: false, reason };
  }
}
