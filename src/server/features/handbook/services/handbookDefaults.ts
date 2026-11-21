// Handbook project defaults (B13 WO-B13-014). A project without a settings
// row runs Handbook with every site audit unless the install sets
// HANDBOOK_DEFAULT_ENABLED=0. A saved row always wins. Shared by the
// settings read (`HandbookService.getSettings`) and the audit hook.
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

const HANDBOOK_DEFAULT_ENABLED_ENV = "HANDBOOK_DEFAULT_ENABLED";

export async function handbookEnabled(
  row: { enabled: boolean } | null | undefined,
): Promise<boolean> {
  if (row) return row.enabled;
  return (await getOptionalEnvValue(HANDBOOK_DEFAULT_ENABLED_ENV)) !== "0";
}
