import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { isHostedAuthMode } from "@/lib/auth-mode";

// Fork health (B13 WO-B13-011, A3): local installs only, like /api/health.
// GET reports `ForkHealth`; POST stores the external watchdog's last report.
// The custom header blocks plain cross-site form posts from a browser.
const MAX_BODY_BYTES = 1024;

async function handleGet(): Promise<Response> {
  if (isHostedAuthMode(env.AUTH_MODE))
    return new Response(null, { status: 404 });
  const { getForkHealth } =
    await import("@/server/features/handbook/ops/health");
  return Response.json(await getForkHealth());
}

async function handlePost(request: Request): Promise<Response> {
  if (isHostedAuthMode(env.AUTH_MODE))
    return new Response(null, { status: 404 });
  if (request.headers.get("x-openseo-watchdog") !== "1") {
    return new Response(null, { status: 403 });
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
  const { saveWatchdogReport, watchdogReportSchema } =
    await import("@/server/features/handbook/ops/health");
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = watchdogReportSchema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });
  await saveWatchdogReport(parsed.data);
  return new Response(null, { status: 204 });
}

export const Route = createFileRoute("/api/fork-health")({
  server: {
    handlers: {
      GET: () => handleGet(),
      POST: ({ request }) => handlePost(request),
    },
  },
});
