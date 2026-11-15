// Bundles the AI-traffic drain receiver (ADR-013) into one file Vercel can run:
// fork/vercel/receiver/src/drain.ts (+ ai-traffic rules/contracts, zod,
// postgres) → fork/vercel/receiver/api/drain.js. Run before deploying.
// esbuild comes from tsx's own dependency (no extra root dependency).
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

type EsbuildBuild = (options: Record<string, unknown>) => Promise<unknown>;

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const receiver = path.join(root, "fork/vercel/receiver");
const requireFromTsx = createRequire(
  createRequire(import.meta.url).resolve("tsx"),
);
const esbuild: { build: EsbuildBuild } = requireFromTsx("esbuild");

await esbuild.build({
  entryPoints: [path.join(receiver, "src/drain.ts")],
  outfile: path.join(receiver, "api/drain.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // postgres uses CommonJS-only builtins in a few paths.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: "info",
});
