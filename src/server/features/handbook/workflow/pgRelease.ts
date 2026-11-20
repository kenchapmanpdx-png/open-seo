import { env } from "cloudflare:workers";
import { db } from "@/db";
import { getDatabaseProvider } from "@/db/provider";

/**
 * Ends the active scope's postgres.js client (ADR-025). Upstream leaves it
 * open; inside a workflow step nothing streams after the body returns, and an
 * open step client otherwise keeps its pooler socket for the life of the
 * process (B13 WO-B13-005 step b: 21 idle sockets 10 min after three audits).
 */
export async function releasePgConnection() {
  if (getDatabaseProvider() !== "postgres") return;
  const client: unknown = Reflect.get(db, "$client");
  if (isEndable(client)) await client.end({ timeout: 5 }).catch(() => {});
}

/**
 * Runs a workflow step body, then releases its Postgres client, even when the
 * body throws. `PG_STEP_RELEASE=0` turns the release off (rollback switch).
 */
export async function withStepRelease<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    if (Reflect.get(env, "PG_STEP_RELEASE") !== "0") {
      await releasePgConnection();
    }
  }
}

/** postgres.js `Sql.end`. */
function isEndable(
  value: unknown,
): value is { end: (options: { timeout: number }) => Promise<void> } {
  return (
    typeof value === "function" &&
    "end" in value &&
    typeof value.end === "function"
  );
}
