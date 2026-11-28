import { lookup } from "node:dns/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";
import type { z } from "zod";
import {
  axeRequestSchema,
  axeResponseSchema,
  contextScrapeResponseSchema,
  healthResponseSchema,
  lighthouseRequestSchema,
  lighthouseResponseSchema,
  renderRequestSchema,
  renderResponseSchema,
  SIDECAR_TOKEN_ENV,
  type AxeResponse,
  type LighthouseResponse,
  type RenderResponse,
} from "../../src/server/features/handbook/contracts/sidecar";
import { CONTRACTS_VERSION } from "../../src/server/features/handbook/contracts/version";
import { maxRendersFromEnv } from "./classify";

/**
 * K3 render sidecar (ADR-004, ADR-009): bearer-token HTTP API on
 * 127.0.0.1:4777. Engines (Playwright render, axe, Lighthouse) are injected
 * so the HTTP layer is testable without a browser; `main()` wires the real
 * ones. Requests and responses are validated with the K3 Zod schemas.
 */
export const SIDECAR_VERSION = "1.3.1";
const MAX_BODY = 64 * 1024;

export type Engines = {
  chromium: () => Promise<string>;
  render: (
    req: z.output<typeof renderRequestSchema>,
  ) => Promise<RenderResponse>;
  axe: (req: z.output<typeof axeRequestSchema>) => Promise<AxeResponse>;
  lighthouse: (
    req: z.output<typeof lighthouseRequestSchema>,
  ) => Promise<LighthouseResponse>;
  /** Close and relaunch the browser (WO-B12-003); called with no task in flight. */
  recycle?: () => Promise<void>;
};

type TaskKind = "render" | "axe" | "lighthouse";

export type SidecarOptions = {
  token: string;
  allowPrivate: boolean;
  engines: Engines;
  resolve?: (host: string) => Promise<string[]>;
  /** Concurrent browser tasks; default `HANDBOOK_SIDECAR_MAX_RENDERS` or 3 (ADR-018). */
  maxRenders?: number;
  /** Browser recycle after this many tasks; default `HANDBOOK_SIDECAR_RECYCLE_AFTER` or 500. */
  recycleAfter?: number;
  /** Called once on a stall (WO-B12-003); default `process.exit(1)`, Docker restarts. */
  exit?: () => void;
  log?: (line: string) => void;
};

/** Hard task deadlines (WO-B12-003): render / axe = request timeout + 60 s, Lighthouse 240 s. */
const DEADLINE_SLACK_MS = 60_000;
const AXE_TIMEOUT_MS = 60_000;
const LIGHTHOUSE_DEADLINE_MS = 240_000;
/** Stall: 2 deadline misses within 10 min, or one task running at 2× its deadline. */
const MISS_WINDOW_MS = 10 * 60_000;
const STALL_CHECK_MS = 15_000;
const EXIT_GRACE_MS = 5_000;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb")
  );
}

const defaultResolve = async (host: string) =>
  (await lookup(host, { all: true })).map((r) => r.address);

/** http(s) only; no private/loopback/link-local targets unless allowed. */
async function guardTarget(raw: string, options: SidecarOptions) {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new HttpError(422, `refused scheme ${url.protocol}`);
  if (options.allowPrivate) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : await (options.resolve ?? defaultResolve)(host).catch(() => {
        throw new HttpError(422, `cannot resolve ${host}`);
      });
  if (addresses.length === 0 || addresses.some(isPrivateAddress))
    throw new HttpError(422, `refused private address for ${host}`);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, "body too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
}

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues.map((i) => i.message).join("; "),
    );
  return result.data as z.output<T>;
}

/** Caps concurrent browser work (render + axe + Lighthouse share it). */
function limiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}

export function createSidecar(options: SidecarOptions): Server {
  const limit = limiter(
    options.maxRenders ??
      maxRendersFromEnv(process.env.HANDBOOK_SIDECAR_MAX_RENDERS),
  );
  const { engines } = options;
  const log = options.log ?? ((line: string) => console.log(line));
  const recycleAfter =
    options.recycleAfter ??
    (Number(process.env.HANDBOOK_SIDECAR_RECYCLE_AFTER) || 500);
  const running = new Set<{ kind: TaskKind; deadline: number; at: number }>();
  let misses: number[] = [];
  let done = 0;
  let recycling: Promise<void> | null = null;
  let stalled = false;
  let pendingResponses = 0;

  let exited = false;
  function exitWhenFlushed() {
    if (exited || pendingResponses > 0) return;
    exited = true;
    (options.exit ?? (() => process.exit(1)))();
  }
  function stall(reason: string) {
    if (stalled) return;
    stalled = true;
    log(`${new Date().toISOString()} sidecar stall: ${reason}; exiting`);
    clearInterval(watch);
    exitWhenFlushed();
    // A response that never finishes writing must not keep a stalled process alive.
    setTimeout(() => {
      pendingResponses = 0;
      exitWhenFlushed();
    }, EXIT_GRACE_MS).unref();
  }
  const watch = setInterval(() => {
    for (const t of running)
      if (Date.now() - t.at >= 2 * t.deadline)
        stall(`${t.kind} still running at 2× its ${t.deadline} ms deadline`);
  }, STALL_CHECK_MS);
  watch.unref();

  async function maybeRecycle() {
    if (!engines.recycle || done < recycleAfter || running.size > 0) return;
    done = 0;
    log(`${new Date().toISOString()} sidecar browser recycle`);
    recycling = engines.recycle().finally(() => {
      recycling = null;
    });
    await recycling;
  }

  /** Runs one browser task in a limiter slot with a hard deadline (504 past it). */
  function task<T>(
    kind: TaskKind,
    deadline: number,
    run: () => Promise<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      void limit(async () => {
        await recycling;
        const entry = { kind, deadline, at: Date.now() };
        running.add(entry);
        const timer = setTimeout(() => {
          const now = Date.now();
          misses = [...misses.filter((t) => now - t < MISS_WINDOW_MS), now];
          log(
            `${new Date(now).toISOString()} sidecar deadline: ${kind} ${deadline} ms`,
          );
          reject(new HttpError(504, "deadline"));
          if (misses.length >= 2)
            stall(`2 deadline misses within ${MISS_WINDOW_MS / 60_000} min`);
        }, deadline);
        try {
          resolve(await run());
        } catch (error) {
          reject(error);
        } finally {
          clearTimeout(timer);
          running.delete(entry);
          done += 1;
        }
        // The slot stays held until the engine settles, even after a 504.
      }).then(maybeRecycle);
    });
  }
  const renderDeadline = (timeoutMs: number) => timeoutMs + DEADLINE_SLACK_MS;

  async function route(req: IncomingMessage): Promise<unknown> {
    const url = new URL(req.url ?? "/", "http://sidecar");
    if (req.method === "GET" && url.pathname === "/health") {
      return healthResponseSchema.parse({
        ok: true,
        version: SIDECAR_VERSION,
        chromium: await engines.chromium(),
        contractsVersion: CONTRACTS_VERSION,
      });
    }
    if (req.headers.authorization !== `Bearer ${options.token}`)
      throw new HttpError(401, "unauthorized");

    if (req.method === "GET" && url.pathname === "/v1/web/scrape/html") {
      const timeout = Number(url.searchParams.get("timeoutOpts[milliseconds]"));
      const request = parse(renderRequestSchema, {
        url: url.searchParams.get("url"),
        javascript: true,
        viewport: "desktop",
        screenshot: "none",
        scrollToEnd: false,
        ...(timeout
          ? { timeoutMs: Math.min(Math.max(timeout, 1000), 60_000) }
          : {}),
      });
      await guardTarget(request.url, options);
      const page = await task("render", renderDeadline(request.timeoutMs), () =>
        engines.render(request),
      );
      return contextScrapeResponseSchema.parse({
        success: true,
        type: "html",
        html: page.html,
        metadata: { finalUrl: page.finalUrl },
        finalDOMState: "loaded",
        key_metadata: { credits_consumed: 0 },
      });
    }
    if (req.method !== "POST") throw new HttpError(404, "not found");
    const body = await readJson(req);
    switch (url.pathname) {
      case "/render": {
        const request = parse(renderRequestSchema, body);
        await guardTarget(request.url, options);
        return renderResponseSchema.parse(
          await task("render", renderDeadline(request.timeoutMs), () =>
            engines.render(request),
          ),
        );
      }
      case "/axe": {
        const request = parse(axeRequestSchema, body);
        await guardTarget(request.url, options);
        return axeResponseSchema.parse(
          await task("axe", AXE_TIMEOUT_MS + DEADLINE_SLACK_MS, () =>
            engines.axe(request),
          ),
        );
      }
      case "/lighthouse": {
        const request = parse(lighthouseRequestSchema, body);
        await guardTarget(request.url, options);
        return lighthouseResponseSchema.parse(
          await task("lighthouse", LIGHTHOUSE_DEADLINE_MS, () =>
            engines.lighthouse(request),
          ),
        );
      }
      default:
        throw new HttpError(404, "not found");
    }
  }

  const server = createServer((req, res) => {
    pendingResponses += 1;
    res.on("close", () => {
      pendingResponses -= 1;
      if (stalled) exitWhenFlushed();
    });
    route(req)
      .then((payload) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      })
      .catch((error: unknown) => {
        const status =
          error instanceof HttpError
            ? error.status
            : error instanceof Error && error.name === "TimeoutError"
              ? 504
              : 500;
        const message =
          error instanceof Error ? error.message : "internal error";
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      });
  });
  server.on("close", () => clearInterval(watch));
  return server;
}

async function main() {
  const token = process.env[SIDECAR_TOKEN_ENV];
  if (!token) throw new Error(`${SIDECAR_TOKEN_ENV} is required`);
  const [{ chromium }, { render }, { runAxe }, { runLighthouse }] =
    await Promise.all([
      import("@playwright/test"),
      import("./render"),
      import("./axe"),
      import("./lighthouse"),
    ]);
  let browser = await chromium.launch();
  const engines: Engines = {
    chromium: async () => browser.version(),
    render: (req) => render(browser, req),
    axe: (req) => runAxe(browser, req),
    lighthouse: (req) => runLighthouse(req),
    recycle: async () => {
      await browser.close().catch(() => {});
      browser = await chromium.launch();
    },
  };
  const host = process.env.HANDBOOK_SIDECAR_HOST ?? "127.0.0.1";
  createSidecar({
    token,
    allowPrivate: process.env.HANDBOOK_SIDECAR_ALLOW_PRIVATE === "1",
    engines,
  }).listen(4777, host, () => {
    console.log(`handbook sidecar on http://${host}:4777`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main();
