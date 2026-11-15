// Ported from Canonry/canonry@4b91e077 packages/integration-traffic/src/agent-trust.ts — MIT, © 2026 Arber X and contributors
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software, subject to the MIT License (https://opensource.org/license/mit).
// Fork: trust levels/reasons and `pathWithoutQuery` inlined from
// packages/contracts/src/{traffic,traffic-path}.ts.
import type { IpVerificationDecision } from "./ip-verify";
import type { AiCrawlerRule } from "./rules";

const AgentTrustLevels = {
  verified: "verified",
  likely_real: "likely_real",
  unknown: "unknown",
  likely_fake: "likely_fake",
} as const;
type AgentTrust = (typeof AgentTrustLevels)[keyof typeof AgentTrustLevels];

const AgentTrustReasons = {
  "ip-in-published-list": "ip-in-published-list",
  "ip-outside-published-list": "ip-outside-published-list",
  "no-ip": "no-ip",
  "no-published-list": "no-published-list",
  "documented-user-agent": "documented-user-agent",
  "unusual-user-agent": "unusual-user-agent",
  "scanner-path": "scanner-path",
  "scanner-burst": "scanner-burst",
} as const;
type AgentTrustReason =
  (typeof AgentTrustReasons)[keyof typeof AgentTrustReasons];

/** A request path without its query string or fragment: `/?utm_source=x` reads `/`. */
export function pathWithoutQuery(path: string): string {
  return path.split(/[?#]/)[0] || "/";
}

/**
 * Path segments a user-triggered fetch has no reason to request. `cgi-bin` is
 * left out on purpose: older sites still serve real pages from it.
 */
const SCANNER_SEGMENTS = new Set([
  "wp-login.php",
  "xmlrpc.php",
  "phpmyadmin",
  "phpunit",
  "eval-stdin.php",
  "phpinfo.php",
  // Debug consoles of web frameworks, and the Vite dev server's file access.
  "_profiler",
  "_debugbar",
  "_ignition",
  "__debug__",
  "elmah.axd",
  "trace.axd",
  "@fs",
]);
// Encoded parent-directory steps. Checked on the raw path because a failed
// decode must not hide them.
const ENCODED_TRAVERSAL =
  /(?:%2e%2e|%2e\.|\.%2e)(?:\/|\\|%2f|%5c|$)|\.\.(?:%2f|%5c)|%252e%252e/i;
// Netlify serves functions and images from its hidden folder.
const NETLIFY_PUBLIC = new Set(["functions", "edge-functions", "images"]);
// Files that hold keys, credentials or server settings. They count only at
// the site root or inside folders like these, so a product page whose name
// mentions a secret is not one.
const CONFIG_FOLDERS = new Set([
  "config",
  "configs",
  "conf",
  "keys",
  "secrets",
  "credentials",
  "private",
  "certs",
  "ssl",
  "backup",
  "backups",
]);
const SECRET_EXTENSIONS = new Set([
  "pem",
  "key",
  "p12",
  "pfx",
  "jks",
  "keystore",
  "ppk",
  "kdbx",
  "ovpn",
  "tfstate",
  "tfvars",
  "sql",
  "bak",
  "swp",
]);
const CREDENTIAL_FILE =
  /(?:^|[-_.])(?:credentials?|secrets?|service[-_]?account(?:[-_]?key)?|private[-_]?key|access[-_]?keys?|adminsdk(?:[-_][\w-]+)?)\.(?:json|ya?ml|toml|ini|conf|cfg|xml|txt|js|env|properties)$/;
const SSH_KEY_FILE = /^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$/;
const SECRET_FILES = new Set([
  "key.json",
  "keyfile.json",
  "sa.json",
  "gcp-key.json",
  "gcp-service.json",
  "gc-service.json",
  "firebase-admin.json",
  "docker-compose.yml",
  "docker-compose.yaml",
  "serverless.yml",
  "serverless.yaml",
  "rclone.conf",
  "appsettings.json",
  "local.settings.json",
  "application.properties",
  "application.yml",
  "application.yaml",
  "values.yaml",
  "web.config",
  "configuration.php",
  "settings.py",
  "database.yml",
  "parameters.yml",
  "env.json",
  "env.js",
]);
// The Node `config` package layout, such as `config/production.json`.
const ENVIRONMENT_CONFIG =
  /^(?:production|prod|development|dev|staging|default|local|test)\.(?:json|ya?ml|js|toml)$/;
// Files a web app's pages load by themselves from the site root: Blazor
// WebAssembly's settings (`appsettings.json`, `appsettings.Production.json`)
// and single-page apps' runtime settings (`env.js`, `env.json`). A browser
// agent's page asks for them, so they are not probes from one.
const BROWSER_APP_ROOT_FILE =
  /^(?:appsettings(?:\.[\w-]+)?\.json|env\.js|env\.json)$/;
// Hidden-folder endpoints a web app's pages call or link to, matched on the
// decoded path's segments: Azure App Service and Static Web Apps sign-in
// (`/.auth/me`, `/.auth/refresh`, `/.auth/login/<provider>` and its
// `/callback`, `/.auth/logout` and its default landing page
// `/.auth/logout/complete`, `/.auth/purge/<provider>`), and anything under
// Netlify Identity and Git Gateway (the Decap CMS editor).
const BROWSER_APP_ENDPOINT =
  /^(?:\.auth\/(?:me|refresh|logout(?:\/complete)?|login\/[^/]+(?:\/callback)?|purge\/[^/]+)|\.netlify\/(?:identity|git)(?:\/.*)?)$/;

/** Reasons in display order. The first reason of a likely fake request keys its hourly bucket. */
const REASON_ORDER: readonly AgentTrustReason[] = [
  AgentTrustReasons["scanner-path"],
  AgentTrustReasons["scanner-burst"],
  AgentTrustReasons["unusual-user-agent"],
  AgentTrustReasons["ip-in-published-list"],
  AgentTrustReasons["ip-outside-published-list"],
  AgentTrustReasons["no-ip"],
  AgentTrustReasons["no-published-list"],
  AgentTrustReasons["documented-user-agent"],
];
// An IP missing from a published list is never on its own evidence of a fake:
// some operators publish rotating snapshots of single addresses, and every
// vendored list lags the operator's real egress.
const FAKE_REASONS: ReadonlySet<AgentTrustReason> = new Set([
  AgentTrustReasons["scanner-path"],
  AgentTrustReasons["scanner-burst"],
  AgentTrustReasons["unusual-user-agent"],
]);

interface AgentTrustAssessment {
  trust: AgentTrust;
  trustReasons: AgentTrustReason[];
}

interface AgentTrustInput {
  rule: Pick<AiCrawlerRule, "documentedUserAgents" | "browser">;
  userAgent: string;
  /** Raw request path; the query string is ignored. */
  path: string;
  /** `manifest` is set only when a published list was consulted for this request. */
  verification: IpVerificationDecision;
  /** Whether the operator publishes an IP list for this agent at all. */
  listPublished: boolean;
}

function isHiddenSegment(segment: string, next: string | undefined): boolean {
  if (!segment.startsWith(".") || segment === "." || segment === ".well-known")
    return false;
  return !(
    segment === ".netlify" &&
    next !== undefined &&
    NETLIFY_PUBLIC.has(next)
  );
}

function isSecretFile(folders: readonly string[], file: string): boolean {
  if (!folders.every((folder) => CONFIG_FOLDERS.has(folder))) return false;
  if (folders.length > 0 && ENVIRONMENT_CONFIG.test(file)) return true;
  const dot = file.lastIndexOf(".");
  const extension = dot > 0 ? file.slice(dot + 1) : "";
  return (
    SECRET_EXTENSIONS.has(extension) ||
    SECRET_FILES.has(file) ||
    SSH_KEY_FILE.test(file) ||
    CREDENTIAL_FILE.test(file) ||
    /^appsettings\.[\w-]+\.json$/.test(file)
  );
}

interface ScannerPathOptions {
  /**
   * The request claims a hosted browser agent (`AiCrawlerRule.browser`). Its
   * pages load app files a link fetcher never asks for, so the files in
   * `BROWSER_APP_ROOT_FILE` and the endpoints in `BROWSER_APP_ENDPOINT` are
   * not probes. Every other check applies, `wp-login.php` included, and the
   * key, credential and secret-file checks apply inside those endpoints too.
   */
  browser?: boolean;
}

/**
 * True when the path asks for secrets, keys, server settings, version-control
 * data, hidden files, debug consoles or admin logins, or steps out of the web
 * root. Real user-triggered fetches follow links a person asked about;
 * scanners wearing an agent user agent request these.
 */
function isScannerPath(
  rawPath: string,
  options: ScannerPathOptions = {},
): boolean {
  const browser = options.browser === true;
  const pathOnly = pathWithoutQuery(rawPath).toLowerCase();
  if (ENCODED_TRAVERSAL.test(pathOnly)) return true;
  let decoded = pathOnly;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    // Keep the raw form; the encoded check above already ran on it.
  }
  const segments = decoded.split(/[\\/]+/).filter(Boolean);
  const appEndpoint = browser && BROWSER_APP_ENDPOINT.test(segments.join("/"));
  for (const [index, segment] of segments.entries()) {
    if (segment === ".." || segment.endsWith("..")) return true;
    if (
      SCANNER_SEGMENTS.has(segment) ||
      segment.startsWith("wp-config") ||
      segment.endsWith(".env")
    )
      return true;
    if (
      !(appEndpoint && index === 0) &&
      isHiddenSegment(segment, segments[index + 1])
    )
      return true;
    // Process environment and mounted cluster secrets.
    if (segment === "proc" && segments[index + 1] === "self") return true;
    if (
      segment === "var" &&
      segments[index + 1] === "run" &&
      segments[index + 2] === "secrets"
    )
      return true;
  }
  const file = segments.at(-1);
  if (file === undefined) return false;
  // The upload folder of old rich-text editors, asked for as a folder.
  if (segments[0] === "userfiles" && !file.includes(".")) return true;
  if (browser && segments.length === 1 && BROWSER_APP_ROOT_FILE.test(file))
    return false;
  // Inside an app endpoint the file is checked as if it sat at the site root,
  // so a key or credential file there (`/.auth/login/id_rsa`) is still a probe.
  return isSecretFile(appEndpoint ? [] : segments.slice(0, -1), file);
}

function sortAgentTrustReasons(
  reasons: Iterable<AgentTrustReason>,
): AgentTrustReason[] {
  const present = new Set(reasons);
  return REASON_ORDER.filter((reason) => present.has(reason));
}

function ipReason(input: AgentTrustInput): AgentTrustReason {
  if (input.verification.verified)
    return AgentTrustReasons["ip-in-published-list"];
  // A manifest is returned only when a list was actually consulted.
  if (input.verification.manifest)
    return AgentTrustReasons["ip-outside-published-list"];
  return input.listPublished
    ? AgentTrustReasons["no-ip"]
    : AgentTrustReasons["no-published-list"];
}

/**
 * Per-request trust, independent of how requests were batched, so every
 * source and transport reaches the same verdict for the same request. An IP
 * in the published list wins. Otherwise any fake signal makes the request
 * likely fake. A request that could not be checked
 * but carries the operator's exact published user agent is likely real.
 * Everything else is unknown.
 */
export function assessAgentTrust(input: AgentTrustInput): AgentTrustAssessment {
  const reasons = new Set<AgentTrustReason>([ipReason(input)]);
  const documented = input.rule.documentedUserAgents;
  if (documented && documented.length > 0) {
    reasons.add(
      documented.some((pattern) => pattern.test(input.userAgent.trim()))
        ? AgentTrustReasons["documented-user-agent"]
        : AgentTrustReasons["unusual-user-agent"],
    );
  }
  if (isScannerPath(input.path, { browser: input.rule.browser === true }))
    reasons.add(AgentTrustReasons["scanner-path"]);
  return {
    trust: trustFor(reasons),
    trustReasons: sortAgentTrustReasons(reasons),
  };
}

function trustFor(reasons: ReadonlySet<AgentTrustReason>): AgentTrust {
  if (reasons.has(AgentTrustReasons["ip-in-published-list"]))
    return AgentTrustLevels.verified;
  for (const reason of reasons)
    if (FAKE_REASONS.has(reason)) return AgentTrustLevels.likely_fake;
  const unchecked =
    reasons.has(AgentTrustReasons["no-ip"]) ||
    reasons.has(AgentTrustReasons["no-published-list"]);
  return unchecked && reasons.has(AgentTrustReasons["documented-user-agent"])
    ? AgentTrustLevels.likely_real
    : AgentTrustLevels.unknown;
}
