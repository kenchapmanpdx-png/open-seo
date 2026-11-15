import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { importAiPerformanceCsv } from "./aiPerformanceImport";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const csv = readFileSync(
  path.join(__dirname, "__fixtures__", "ai-performance.csv"),
  "utf8",
);

async function rows(sql: string) {
  return (await testDb.client.execute(sql)).rows.map((row) => ({ ...row }));
}

beforeEach(async () => {
  await testDb.seedProject();
  await testDb.client.execute(
    "INSERT INTO bing_site (id, project_id, organization_id, site_url, verified) VALUES ('site', 'project', 'organization', 'https://example.com/', 1)",
  );
});

describe("Bing AI Performance CSV import", () => {
  it("imports known columns, stores the file, and re-import is a no-op", async () => {
    const store = createMemoryEvidenceStore();
    const input = {
      projectId: "project",
      organizationId: "organization",
      importedBy: "user",
      fileName: "AI Performance.csv",
      csv,
      store,
    };

    expect(await importAiPerformanceCsv(input)).toMatchObject({
      duplicate: false,
      rowsRead: 6,
      rowsUpserted: 4,
      invalidRows: 1, // "n/a" citations
      unstoredRows: 1, // page-only row has no table
      unknownColumns: ["Region"],
    });
    expect(
      await rows(
        "SELECT day, citations, cited_pages FROM bing_ai_citation_day ORDER BY day",
      ),
    ).toEqual([
      { day: "2026-11-01", citations: 12, cited_pages: 4 },
      { day: "2026-11-02", citations: 9, cited_pages: 3 },
      { day: "2026-11-03", citations: 1204, cited_pages: 5 },
    ]);
    expect(
      await rows(
        "SELECT period_start, period_end, query, citations FROM bing_ai_grounding_query",
      ),
    ).toEqual([
      {
        period_start: "2026-11-03",
        period_end: "2026-11-03",
        query: "best seo audit tool",
        citations: 7,
      },
    ]);
    const [imported] = await rows(
      "SELECT evidence_path, rows_read, rows_upserted FROM bing_ai_import",
    );
    expect([...store.objects.keys()]).toEqual([imported.evidence_path]);

    expect(await importAiPerformanceCsv(input)).toMatchObject({
      duplicate: true,
    });
    expect(
      await rows(
        "SELECT (SELECT count(*) FROM bing_ai_import) AS imports, (SELECT count(*) FROM bing_ai_citation_day) AS days",
      ),
    ).toEqual([{ imports: 1, days: 3 }]);
  });

  it("refuses a project of another organization", async () => {
    await expect(
      importAiPerformanceCsv({
        projectId: "project",
        organizationId: "other",
        importedBy: "user",
        fileName: "a.csv",
        csv,
        store: createMemoryEvidenceStore(),
      }),
    ).rejects.toThrow("No Bing site");
  });
});
