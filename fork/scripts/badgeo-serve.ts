/**
 * BadGEO static server (B1 R4): serves fork/fixtures/badgeo on 127.0.0.1,
 * applies per-path headers from `_headers.json`, answers 403 to the user-agent
 * tokens `_bots.json` lists for a path (bot-parity fixtures), substitutes
 * `{{ORIGIN}}` in text files, 404 for anything missing.
 *
 *   pnpm exec tsx fork/scripts/badgeo-serve.ts [--port 4455]
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { parseArgs } from "node:util";
import { z } from "zod";

export const BADGEO_ROOT = resolve("fork/fixtures/badgeo");

const headersSchema = z.record(z.string(), z.record(z.string(), z.string()));
const botsSchema = z.record(z.string(), z.array(z.string()));

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
};

function resolveFile(pathname: string): string | null {
  const safe = normalize(decodeURIComponent(pathname)).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  // Underscore files are harness config, not site content.
  if (safe.split("/").some((part) => part.startsWith("_"))) return null;
  const candidate = join(BADGEO_ROOT, safe);
  if (!candidate.startsWith(BADGEO_ROOT)) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = join(candidate, "index.html");
    return existsSync(index) ? index : null;
  }
  return existsSync(candidate) ? candidate : null;
}

/**
 * `originHost` names the origin the site advertises (robots/sitemap URLs).
 * The default `127.0.0.1.nip.io` resolves to 127.0.0.1 via public wildcard
 * DNS: the engine's safeFetch rejects IP-literal loopback targets
 * (`isCrawlableUrl`), so the harness crawls through this name instead.
 */
export async function startBadgeo(
  options: { port?: number; originHost?: string } = {},
): Promise<{ origin: string; close: () => Promise<void> }> {
  const headerMap = headersSchema.parse(
    JSON.parse(readFileSync(join(BADGEO_ROOT, "_headers.json"), "utf8")),
  );
  const botMap = botsSchema.parse(
    JSON.parse(readFileSync(join(BADGEO_ROOT, "_bots.json"), "utf8")),
  );
  let origin = "";
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", origin).pathname;
    const ua = req.headers["user-agent"] ?? "";
    if ((botMap[pathname] ?? []).some((token) => ua.includes(token))) {
      res.writeHead(403, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><title>Forbidden</title><h1>Forbidden</h1>");
      return;
    }
    const file = resolveFile(pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><title>Not found</title><h1>Not found</h1>");
      return;
    }
    const ext = extname(file);
    const extra = headerMap[pathname] ?? headerMap["*"] ?? {};
    const raw = readFileSync(file);
    const body =
      ext in TYPES
        ? raw.toString("utf8").replaceAll("{{ORIGIN}}", origin)
        : raw;
    res.writeHead(200, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      ...extra,
    });
    res.end(req.method === "HEAD" ? undefined : body);
  });
  await new Promise<void>((done) =>
    server.listen(options.port ?? 0, "127.0.0.1", done),
  );
  const address: AddressInfo | string | null = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  origin = `http://${options.originHost ?? "127.0.0.1.nip.io"}:${address.port}`;
  return {
    origin,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: { port: { type: "string", default: "4455" } },
  });
  startBadgeo({ port: Number(values.port) })
    .then(({ origin }) => console.log(`BadGEO on ${origin}`))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
