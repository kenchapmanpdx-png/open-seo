const HEADER_VALUE_MAX = 2048;

/** Crawl response headers as stored on the snapshot (ADR-021): no cookies, values ≤ 2 kB. */
export function keptHeaders(
  headers: ReadonlyArray<readonly [string, string]>,
): [string, string][] {
  return headers.flatMap(([name, value]): [string, string][] => {
    const key = name.toLowerCase();
    return key === "set-cookie"
      ? []
      : [[key, value.slice(0, HEADER_VALUE_MAX)]];
  });
}
