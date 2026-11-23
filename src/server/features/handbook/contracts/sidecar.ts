import { z } from "zod";

/**
 * K3 — Render sidecar client contract (ADR-004). Mirrors
 * `fork/sidecar/openapi.yaml`; responses are validated with these schemas
 * because the sidecar returns page-derived data.
 */

export const renderRequestSchema = z.object({
  url: z.string().url(),
  javascript: z.boolean(),
  viewport: z.enum(["mobile", "desktop"]),
  screenshot: z.enum(["none", "firstScreen", "fullPage"]),
  scrollToEnd: z.boolean(),
  timeoutMs: z.number().int().min(1_000).max(60_000).default(30_000),
  /**
   * Record then abort analytics / ad / pixel requests (fixed in-repo host
   * list) so the audit never fires the client's tags (ADR-021). K3 1.2.0.
   */
  blockBeacons: z.boolean().default(true),
  /**
   * Exact request URLs to abort (reason `robots`): the robots-blocked
   * same-host requests of a normal render, re-rendered without them to see
   * whether they change the page (P3-20, WO-B19-004). K3 1.3.0.
   */
  abortUrls: z.array(z.string().url()).max(200).optional(),
});
export type RenderRequest = z.input<typeof renderRequestSchema>;

export const renderResponseSchema = z.object({
  finalUrl: z.string().url(),
  status: z.number().int().nullable(),
  html: z.string(),
  /** Base64 PNG; present when a screenshot was requested. */
  screenshotPng: z.string().nullable(),
  consoleErrors: z.array(z.string()),
  /** Every network request the page made (P3-20 guard, P7-04 pre-consent). */
  requests: z.array(
    z.object({
      url: z.string(),
      resourceType: z.string(),
      status: z.number().int().nullable(),
      /** Request started before the load event (Resource Timing). Added in 1.1.0. */
      beforeLoad: z.boolean().optional(),
      /** Bytes over the wire; null when unknown (cross-origin without TAO, aborted). 1.2.0 */
      transferBytes: z.number().int().nonnegative().nullable().optional(),
      /** Recorded then aborted by the sidecar: beacon host or media body. 1.2.0 */
      aborted: z.enum(["beacon", "media", "robots"]).nullable().optional(),
      /** Resource Timing `nextHopProtocol` (h2, h3, http/1.1). 1.2.0 */
      protocol: z.string().nullable().optional(),
    }),
  ),
  /** Every `<video>` and video `<iframe>` after load (FULL-READ §3.12). 1.2.0 */
  mediaElements: z
    .array(
      z.object({
        kind: z.enum(["video", "iframe"]),
        src: z.string().nullable(),
        firstScreen: z.boolean(),
        reservedSize: z.boolean(),
      }),
    )
    .optional(),
  /** Visible-text words inside opacity:0 elements after load, before scroll (P2-07). */
  opacityZeroWords: z.number().int().nonnegative(),
  /**
   * Visible words in the main content root, counted by the same walker as
   * `opacityZeroWords` (its denominator; WO-B19-006). K3 1.3.0.
   */
  mainWords: z.number().int().nonnegative().optional(),
  /** Buttons/links intersecting the first viewport (P5-14). */
  firstScreenActions: z.array(
    z.object({
      tag: z.string(),
      text: z.string(),
      href: z.string().nullable(),
    }),
  ),
  timingMs: z.number().nonnegative(),
});
export type RenderResponse = z.infer<typeof renderResponseSchema>;

export const axeRequestSchema = z.object({
  url: z.string().url(),
  viewport: z.enum(["mobile", "desktop"]).default("mobile"),
  scrollToEnd: z.literal(true).default(true),
});
export type AxeRequest = z.input<typeof axeRequestSchema>;

export const axeResponseSchema = z.object({
  url: z.string().url(),
  axeVersion: z.string(),
  violations: z.array(
    z.object({
      id: z.string(),
      impact: z.enum(["minor", "moderate", "serious", "critical"]).nullable(),
      help: z.string(),
      helpUrl: z.string(),
      nodes: z.array(
        z.object({ target: z.array(z.string()), html: z.string() }),
      ),
    }),
  ),
});
export type AxeResponse = z.infer<typeof axeResponseSchema>;

export const lighthouseRequestSchema = z.object({
  url: z.string().url(),
  formFactor: z.enum(["mobile", "desktop"]),
});
export type LighthouseRequest = z.infer<typeof lighthouseRequestSchema>;

export const lighthouseResponseSchema = z.object({
  url: z.string().url(),
  lighthouseVersion: z.string(),
  /** Host description; lab TBT is host-CPU dependent (handbook Verification rules). */
  environment: z.string(),
  categories: z.object({
    performance: z.number().min(0).max(1).nullable(),
    accessibility: z.number().min(0).max(1).nullable(),
    bestPractices: z.number().min(0).max(1).nullable(),
    seo: z.number().min(0).max(1).nullable(),
  }),
  metrics: z.object({
    lcpMs: z.number().nullable(),
    cls: z.number().nullable(),
    tbtMs: z.number().nullable(),
    fcpMs: z.number().nullable(),
  }),
  lcpElement: z.string().nullable(),
  /** Full Lighthouse JSON report; stored as evidence, not parsed further here. */
  report: z.unknown(),
});
export type LighthouseResponse = z.infer<typeof lighthouseResponseSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  chromium: z.string(),
  contractsVersion: z.string(),
});

/** Context.dev-compatible scrape shape (upstream `rendered-page.ts`). */
export const contextScrapeResponseSchema = z.object({
  success: z.literal(true),
  type: z.literal("html"),
  html: z.string(),
  metadata: z.object({ finalUrl: z.string().url() }),
  finalDOMState: z.literal("loaded"),
  key_metadata: z.object({ credits_consumed: z.number() }).optional(),
});

export const SIDECAR_DEFAULT_URL = "http://127.0.0.1:4777";
export const SIDECAR_TOKEN_ENV = "HANDBOOK_SIDECAR_TOKEN";
export const SIDECAR_URL_ENV = "HANDBOOK_SIDECAR_URL";
