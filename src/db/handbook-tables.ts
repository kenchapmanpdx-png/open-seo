import { getDatabaseProvider } from "./provider";
import * as sqliteHandbook from "./handbook.schema";
import * as pgHandbook from "./pg/handbook.schema";

// Provider-aware handbook tables, same pattern as the upstream `@/db/schema`
// barrel (kept fork-local so upstream's barrel stays untouched). Typed as the
// SQLite definitions; ./handbook-schema-parity.test.ts guards the cast.
const runtime =
  getDatabaseProvider() === "postgres" ? pgHandbook : sqliteHandbook;

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- guarded by handbook-schema-parity.test.ts
const schema = runtime as unknown as typeof sqliteHandbook;

export const {
  handbookProjectSettings,
  handbookRuns,
  handbookSiteProfiles,
  handbookTemplates,
  handbookTemplateSamples,
  handbookPageSnapshots,
  handbookItemStatuses,
  handbookFindings,
  handbookFindingItems,
  handbookFindingUrls,
  handbookEvidence,
  handbookBotFetches,
  handbookLlmCalls,
  handbookRunStages,
  handbookRunLeases,
  handbookPageProfiles,
} = schema;
