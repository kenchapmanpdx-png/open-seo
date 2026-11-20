// Node loader hook for fork ops scripts that reuse app repositories
// (B13 WO-B13-008): resolves `cloudflare:workers` to an `env` with the
// Postgres provider and a HYPERDRIVE binding built from SUPABASE_DB_URL
// (already loaded by run-local.sh). Usage: tsx --import ./fork/scripts/ops/cf-env-shim.mjs …
import { register } from "node:module";

const shim =
  "data:text/javascript," +
  encodeURIComponent(
    'export const env = { DATABASE_PROVIDER: "postgres", HYPERDRIVE: { connectionString: process.env.SUPABASE_DB_URL } };',
  );

register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function resolve(specifier, context, next) {
        if (specifier === "cloudflare:workers") return { url: ${JSON.stringify(shim)}, shortCircuit: true };
        return next(specifier, context);
      }`,
    ),
);
