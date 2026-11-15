import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { createResult, formatHeaders, headerValue } from "./support";

/**
 * HEADERS (handbook §14): hashed (fingerprinted) assets are cached for a year
 * with `immutable`; HTML revalidates (no-cache / must-revalidate / max-age=0)
 * and never carries a long max-age (P7-07). Input: headers probes (pages +
 * up to 4 home assets).
 */
const ITEMS = ["P7-07"];

const HASHED = /[.-][0-9a-f]{6,}\.(js|css|woff2?|png|jpe?g|webp|avif|svg)$/i;
const YEAR = 31_536_000;

const maxAge = (cc: string) => {
  const m = /(?:^|,)\s*max-age=(\d+)/i.exec(cc);
  return m ? Number(m[1]) : null;
};

export const cachePolicyCheck: HandbookCheck = {
  id: "headers.cache-policy",
  itemIds: ITEMS,
  class: "HEADERS",
  requires: ["headers"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { headers } = ctx.collected;
    if (headers.status !== "ok") return out.build();
    const ref = (r: (typeof headers.responses)[number]) =>
      out.evidence(
        "header",
        r.url,
        `HTTP ${r.status}\n${formatHeaders(r.headers.filter(([k]) => k === "cache-control" || k === "content-type" || k === "age" || k === "etag"))}`,
      );
    const ok = headers.responses.filter((r) => r.status === 200);
    const assets = ok.filter((r) => HASHED.test(new URL(r.url).pathname));
    const html = ok.filter((r) =>
      /text\/html/i.test(headerValue(r.headers, "content-type") ?? ""),
    );
    const issues = [
      ...assets.flatMap((r) => {
        const cc = headerValue(r.headers, "cache-control") ?? "";
        const age = maxAge(cc);
        const why = [
          ...(age !== null && age >= YEAR
            ? []
            : [`max-age ${age ?? "missing"} (< 1 year)`]),
          ...(/\bimmutable\b/i.test(cc) ? [] : ["no immutable"]),
        ];
        return why.length > 0
          ? [
              {
                r,
                why: `hashed asset: cache-control "${cc}" — ${why.join(", ")}`,
              },
            ]
          : [];
      }),
      ...html.flatMap((r) => {
        const cc = headerValue(r.headers, "cache-control") ?? "";
        const age = maxAge(cc);
        const revalidates =
          /\bno-cache\b|\bno-store\b|\bmust-revalidate\b/i.test(cc) ||
          age === 0;
        if (age !== null && age > 600)
          return [{ r, why: `HTML cache-control "${cc}" (long max-age)` }];
        if (!revalidates)
          return [
            {
              r,
              why: `HTML cache-control "${cc || "(none)"}" (no revalidation)`,
            },
          ];
        return [];
      }),
    ];
    if (issues.length > 0) {
      out.finding({
        itemIds: ["P7-07"],
        severity: "S3",
        title:
          "Cache policy: hashed assets not immutable / HTML not revalidated",
        detail: issues.map((i) => `${i.r.url} — ${i.why}`).join("\n"),
        fix: "Serve fingerprinted assets with `Cache-Control: public, max-age=31536000, immutable`; serve HTML with `no-cache` (or `max-age=0, must-revalidate`).",
        fixability: "FIXABLE",
        effort: "S",
        urls: issues.map((i) => i.r.url),
        evidenceRefs: issues.slice(0, 20).map((i) => ref(i.r)),
      });
    }
    if (assets.length === 0 && html.length === 0) {
      out.na("P7-07", "no hashed asset or HTML response probed");
      return out.build();
    }
    out.pass(
      "P7-07",
      `${assets.length} hashed asset(s) immutable for a year; ${html.length} HTML response(s) revalidate${assets.length === 0 ? " (no hashed asset found)" : ""}`,
      [...assets, ...html].slice(0, 5).map(ref),
    );
    return out.build();
  },
};
