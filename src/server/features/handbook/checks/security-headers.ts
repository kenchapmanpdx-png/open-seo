import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { createResult, formatHeaders, headerValue, pathOf } from "./support";

/**
 * HEADERS exemplar (handbook §14): security headers on HTML responses checked
 * by value, not presence. HSTS `max-age` > 0 and host-only unless decided;
 * CSP enforcing / report-only / absent recorded, allow-all = finding;
 * `frame-ancestors` (or legacy X-Frame-Options), nosniff, Referrer-Policy,
 * Permissions-Policy present. URLs with the same problem share one finding.
 */
const ITEMS = ["P8-01", "P8-05"];

type Problem = {
  key: string;
  title: string;
  fix: string;
  items: string[];
};

function cspState(headers: ReadonlyArray<readonly [string, string]>) {
  const enforcing = headerValue(headers, "content-security-policy");
  if (enforcing) return { state: "enforcing", policy: enforcing };
  const reportOnly = headerValue(
    headers,
    "content-security-policy-report-only",
  );
  if (reportOnly) return { state: "report-only", policy: reportOnly };
  return { state: "absent", policy: null };
}

const ALLOW_ALL = /(^|;)\s*default-src\s+(\*|https?:)(\s|;|$)/i;

function problemsFor(headers: ReadonlyArray<readonly [string, string]>) {
  const out: Problem[] = [];
  const missing: string[] = [];
  const hsts = headerValue(headers, "strict-transport-security");
  if (!hsts) missing.push("Strict-Transport-Security");
  else {
    const maxAge = Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts)?.[1] ?? "0");
    if (maxAge <= 0) {
      out.push({
        key: "hsts-zero",
        title: "HSTS max-age is 0 (HSTS disabled)",
        fix: "Serve `Strict-Transport-Security: max-age=31536000` (host-only) from the platform's HTTPS setting.",
        items: ["P8-05", "P8-01"],
      });
    }
    if (/includesubdomains|preload/i.test(hsts)) {
      out.push({
        key: "hsts-scope",
        title:
          "HSTS includeSubDomains/preload without a recorded subdomain check or owner decision",
        fix: "Keep HSTS host-only until every subdomain serves HTTPS; add `preload` only with owner approval recorded in the status file.",
        items: ["P8-01"],
      });
    }
  }
  const csp = cspState(headers);
  if (csp.state === "absent") missing.push("Content-Security-Policy");
  else if (csp.policy && ALLOW_ALL.test(csp.policy)) {
    out.push({
      key: "csp-allow-all",
      title: "CSP allows every source (default-src *)",
      fix: "Replace the allow-all policy with an allowlist; start report-only, then enforce.",
      items: ["P8-05", "P8-01"],
    });
  }
  const frameAncestors = csp.policy && /frame-ancestors/i.test(csp.policy);
  const xfo = headerValue(headers, "x-frame-options");
  if (!frameAncestors && !xfo)
    missing.push("CSP frame-ancestors / X-Frame-Options");
  if (xfo && xfo.includes(",")) {
    out.push({
      key: "xfo-duplicate",
      title: "X-Frame-Options sent more than once",
      fix: "Send one X-Frame-Options value (or rely on CSP `frame-ancestors`).",
      items: ["P8-01"],
    });
  }
  if (
    headerValue(headers, "x-content-type-options")?.toLowerCase() !== "nosniff"
  )
    missing.push("X-Content-Type-Options: nosniff");
  const referrer = headerValue(headers, "referrer-policy");
  if (!referrer || /unsafe-url/i.test(referrer))
    missing.push("Referrer-Policy");
  if (!headerValue(headers, "permissions-policy"))
    missing.push("Permissions-Policy");
  if (missing.length > 0) {
    out.push({
      key: `missing:${missing.join("|")}`,
      title: `Security headers missing: ${missing.join(", ")}`,
      fix: `Add ${missing.join(", ")} to HTML responses (platform header config or edge rules).`,
      items: ["P8-01", "P8-05"],
    });
  }
  return { problems: out, csp: csp.state };
}

const isHtml = (headers: ReadonlyArray<readonly [string, string]>) =>
  /text\/html/i.test(headerValue(headers, "content-type") ?? "");

export const securityHeadersCheck: HandbookCheck = {
  id: "headers.security-by-value",
  itemIds: ITEMS,
  class: "HEADERS",
  requires: ["headers"],
  run(ctx) {
    const out = createResult(ITEMS);
    const data = ctx.collected.headers;
    if (data.status !== "ok") return out.build();
    const html = data.responses.filter(
      (r) => r.status === 200 && isHtml(r.headers),
    );
    if (html.length === 0) {
      for (const id of ITEMS) out.na(id, "no HTML 200 response probed");
      return out.build();
    }
    const grouped = new Map<
      string,
      { problem: Problem; refs: string[]; urls: string[] }
    >();
    const states: string[] = [];
    let firstRef: string | null = null;
    for (const response of html) {
      const { problems, csp } = problemsFor(response.headers);
      const ref = out.evidence(
        "header",
        response.url,
        formatHeaders(response.headers),
      );
      firstRef ??= ref;
      states.push(`${pathOf(response.url)}: CSP ${csp}`);
      for (const problem of problems) {
        const entry = grouped.get(problem.key) ?? {
          problem,
          refs: [],
          urls: [],
        };
        entry.refs.push(ref);
        entry.urls.push(response.url);
        grouped.set(problem.key, entry);
      }
    }
    for (const { problem, refs, urls } of grouped.values()) {
      out.finding({
        itemIds: problem.items,
        severity: "S4",
        title: problem.title,
        detail: `${urls.length} of ${html.length} probed HTML responses. CSP state: ${states.join("; ")}.`,
        fix: problem.fix,
        fixability: "FIXABLE",
        effort: "S",
        urls,
        evidenceRefs: refs,
      });
    }
    if (firstRef) {
      out.pass(
        "P8-01",
        "security headers present on every probed HTML response",
        [firstRef],
      );
      out.pass("P8-05", `headers checked by value; ${states.join("; ")}`, [
        firstRef,
      ]);
    }
    return out.build();
  },
};
