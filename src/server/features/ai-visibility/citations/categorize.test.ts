import { describe, expect, it, vi } from "vitest";
import { CATEGORIES_VERSION, categorizeSource } from "./categorize";
import { categorizeUpstreamSources } from "./categorizeUpstreamSources";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const categorize = (url: string, title: string | null = null) =>
  categorizeSource({
    url,
    domain: new URL(url).hostname,
    title,
    ownDomains: ["mybrand.com"],
    competitorDomains: ["rival.com"],
  });

// Trimmed from Elmo's domain-categories / page-classification tests.
describe("categorizeSource", () => {
  it.each([
    ["https://blog.mybrand.com/post", "brand"],
    ["https://rival.com/", "competitor"],
    ["https://forbes.com/x", "editorial"],
    ["https://g2.com/products/x", "reviews"],
    ["https://amazon.com/dp/B089", "ecommerce"],
    ["https://reddit.com/r/seo/comments/abc/title", "social"],
    ["https://github.com/a/b", "developer"],
    ["https://prnewswire.com/news/x", "pr"],
    ["https://en.wikipedia.org/wiki/SEO", "reference"],
    ["https://stanford.edu/x", "institutional"],
    ["https://some-random-saas.com/", "other"],
  ])("%s → %s", (url, category) => {
    expect(categorize(url).category).toBe(category);
  });

  it("infers page types and the long-tail fallbacks", () => {
    expect(categorize("https://example.com/").pageType).toBe("homepage");
    expect(
      categorize("https://example.com/x", "10 best CRMs for startups"),
    ).toEqual({ category: "editorial", pageType: "listicle" });
    expect(
      categorize("https://example.com/docs/getting-started").pageType,
    ).toBe("doc");
    expect(
      categorize("https://youtube.com/watch?v=abc", "5 products").pageType,
    ).toBe("video");
    // A Google surface has no publisher category.
    expect(
      categorize("https://www.google.com/search?q=product&prds=productid:1"),
    ).toEqual({ category: "other", pageType: "shopping" });
  });

  it("brand wins over a listed domain", () => {
    expect(
      categorizeSource({
        url: "https://github.com/mybrand/sdk",
        domain: "github.com",
        ownDomains: ["github.com"],
        competitorDomains: ["github.com"],
      }).category,
    ).toBe("brand");
  });
});

describe("categorizeUpstreamSources job", () => {
  it("categorizes uncategorized and stale rows once, using the observation's brands", async () => {
    await testDb.seedProject();
    await testDb.client.executeMultiple(`
      INSERT INTO ai_trackers (id, project_id, created_at) VALUES ('tracker', 'project', '');
      INSERT INTO ai_prompts (id, tracker_id, topic, text, created_at)
        VALUES ('prompt', 'tracker', 'seo', 'best seo tool', '');
      INSERT INTO ai_runs (id, tracker_id, project_id, trigger, location_code, language_code, created_at)
        VALUES ('run', 'tracker', 'project', 'manual', 2840, 'en', '');
      INSERT INTO ai_observations (id, run_id, prompt_id, engine, branded)
        VALUES ('obs', 'run', 'prompt', 'chatgpt', 0);
      INSERT INTO ai_matches (id, observation_id, name, domain, own, mentioned, cited) VALUES
        ('m1', 'obs', 'OpenSEO', 'openseo.so', 1, 1, 1),
        ('m2', 'obs', 'Rival', 'rival.com', 0, 1, 1);
      INSERT INTO ai_sources (id, observation_id, url, domain, position) VALUES
        ('s1', 'obs', 'https://openseo.so/pricing', 'openseo.so', 0),
        ('s2', 'obs', 'https://rival.com/', 'rival.com', 1),
        ('s3', 'obs', 'https://forbes.com/x', 'forbes.com', 2);
      INSERT INTO ai_source_category (source_id, category, page_type, categories_version)
        VALUES ('s3', 'other', 'other', 'old');
    `);

    expect(await categorizeUpstreamSources()).toEqual({ categorized: 3 });
    const rows = await testDb.client.execute(
      "SELECT source_id, category, categories_version FROM ai_source_category ORDER BY source_id",
    );
    expect(rows.rows.map((row) => ({ ...row }))).toEqual([
      {
        source_id: "s1",
        category: "brand",
        categories_version: CATEGORIES_VERSION,
      },
      {
        source_id: "s2",
        category: "competitor",
        categories_version: CATEGORIES_VERSION,
      },
      {
        source_id: "s3",
        category: "editorial",
        categories_version: CATEGORIES_VERSION,
      },
    ]);
    expect(await categorizeUpstreamSources()).toEqual({ categorized: 0 });
  });
});
