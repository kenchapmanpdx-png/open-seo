import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import {
  createResult,
  formatHeaders,
  headerValue,
  parseUrl,
  pathOf,
} from "./support";
import { hostedBuilder } from "./platform";

/**
 * HEADERS (handbook §14): hashed (fingerprinted) assets are cached for a year
 * with `immutable`; HTML revalidates (no-cache / must-revalidate / max-age=0)
 * and never carries a long max-age (P7-07). Input: headers probes (pages +
 * up to 4 home assets).
 */
const ITEMS = ["P7-07"];

const HASHED = /[.-][0-9a-f]{6,}\.(js|css|woff2?|png|jpe?g|webp|avif|svg)$/i;
const YEAR = 31_536_000;
const STATIC =
  /\.(js|mjs|css|woff2?|ttf|otf|png|jpe?g|gif|webp|avif|svg|ico)$/i;

/**
 * Any caching header at all: a Cache-Control directive (`no-cache` is a
 * policy too) or an Expires date. Only a file with neither is reported.
 */
const hasCachingHeader = (headers: readonly (readonly [string, string])[]) =>
  !!headerValue(headers, "cache-control")?.trim() ||
  headerValue(headers, "expires") !== null;

const sameOrigin = (url: string, origin: string) =>
  parseUrl(url)?.origin === parseUrl(origin)?.origin;

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
        `HTTP ${r.status}\n${formatHeaders(r.headers.filter(([k]) => k === "cache-control" || k === "expires" || k === "content-type" || k === "age" || k === "etag"))}`,
      );
    const ok = headers.responses.filter((r) => r.status === 200);
    const assets = ok.filter((r) => HASHED.test(pathOf(r.url)));
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
    // WO-B21-002: a probed same-origin static file that is not fingerprinted
    // and carries no freshness policy at all (aweandorderorganizing.com,
    // `/files/main_style.css?1672701721`). Fork reading of P7-07, S4.
    const uncached = ok.filter(
      (r) =>
        sameOrigin(r.url, ctx.origin) &&
        !HASHED.test(pathOf(r.url)) &&
        STATIC.test(pathOf(r.url)) &&
        !hasCachingHeader(r.headers),
    );
    if (uncached.length > 0) {
      const builder = hostedBuilder(ctx.collected);
      out.finding({
        itemIds: ["P7-07"],
        severity: "S4",
        severityReason:
          "static file with no caching header; repeat-visit speed only",
        title: "Static files sent with no caching header",
        detail: uncached
          .map((r) => `${r.url} — no Cache-Control and no Expires header`)
          .join("\n"),
        fix: "Send a caching header on CSS, JavaScript, font and image files (for example `Cache-Control: public, max-age=86400`), so a returning visitor's browser reuses them.",
        fixability: builder ? "LIMITED" : "FIXABLE",
        ...(builder
          ? {
              limitedReason: `caching headers are set by the platform (${builder})`,
            }
          : {}),
        effort: "S",
        urls: uncached.map((r) => r.url),
        evidenceRefs: uncached.slice(0, 20).map(ref),
      });
    }
    if (assets.length === 0 && html.length === 0) {
      if (uncached.length === 0)
        out.na(
          "P7-07",
          "no fingerprinted asset or HTML response probed; static files carry a caching header",
        );
      return out.build();
    }
    out.pass(
      "P7-07",
      `${assets.length > 0 ? `${assets.length} hashed asset(s) immutable for a year; ` : ""}${html.length} HTML response(s) revalidate`,
      [...assets, ...html].slice(0, 5).map(ref),
    );
    return out.build();
  },
};
