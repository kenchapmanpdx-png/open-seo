import { writeFileSync } from "node:fs";
import { format } from "prettier";

/**
 * Write a run artifact already prettier-formatted, so local outputs under
 * fork/runs/ (gitignored, but still scanned by `pnpm format:check`) stay clean.
 */
export async function writeFormatted(path: string, content: string) {
  writeFileSync(path, await format(content, { filepath: path }));
}
