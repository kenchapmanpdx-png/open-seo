import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import type { JudgeInput } from "@/server/features/handbook/contracts/llm";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import type { CopyPage } from "@/server/features/handbook/contracts/scaled-copy";
import { REGISTRY } from "@/server/features/handbook/registry";
import {
  ORIGIN,
  snapshot,
  stubJudge,
} from "@/server/features/handbook/checks/check-test-fixtures";
import { renderReviewMd } from "../export/markdown";
import { buildCopyQuality, COPY_QUALITY_LABEL } from "./copy-quality";
import { extractHtmlFacts } from "./html-facts";
import { createMemoryEvidenceStore } from "./memory-evidence-store";
import { buildReportJson } from "./report";
import { runHandbook } from "./runner";

const fixtureProse = (name: string) =>
  extractHtmlFacts(
    readFileSync(`fork/fixtures/copy-quality/${name}.html`, "utf8"),
    ORIGIN,
  ).markup.prose ?? [];

function page(
  path: string,
  prose: PageSnapshot["markup"]["prose"],
  lang: string | null = null,
): PageSnapshot {
  const s = snapshot(path);
  return { ...s, head: { ...s.head, lang }, markup: { ...s.markup, prose } };
}

const contactProfile: PageProfile = {
  url: `${ORIGIN}/contact`,
  pageType: "contact",
  scope: "page",
  topic: "Contact",
  names: [],
  stats: [],
  prices: [],
  superlatives: [],
  awards: [],
  placeholders: [],
  undefinedAcronyms: [],
  faqQuestions: [],
  faqPairs: [],
  freshness: [],
  ctaFirstScreen: null,
  keyFactsBlock: null,
  contact: [],
  sections: [],
  videoText: null,
  textSha256: "0".repeat(64),
  promptVersion: "1",
  model: "test",
  templateKey: null,
  droppedQuotes: 0,
  truncated: false,
  tokensIn: 0,
  tokensOut: 0,
  costUsd: 0,
};

const reasonOf = (p: CopyPage | undefined) =>
  p && !p.measured ? p.reason : null;

describe("copy quality section", () => {
  it("flags every threshold metric on the over fixture and none on the control", () => {
    const section = buildCopyQuality({
      snapshots: [
        page("/control", fixtureProse("control")),
        page("/over", fixtureProse("over")),
      ],
      templates: [],
    });
    expect(section.label).toBe(COPY_QUALITY_LABEL);
    const [over, control] = section.pages;
    expect(over?.url).toBe(`${ORIGIN}/over`);
    expect(over?.measured && over.overCount).toBe(14);
    expect(control?.measured && control.overCount).toBe(0);
  });

  it("skips non-English pages, short prose after boilerplate, and contact pages", () => {
    const over = fixtureProse("over");
    const section = buildCopyQuality({
      snapshots: [
        page("/de", over, "de-DE"),
        page("/a", over),
        page("/b", over),
        page("/contact", over, "en-US"),
      ],
      templates: [
        {
          key: "t1",
          urlPattern: "/*",
          skeletonHash: "h",
          urls: [`${ORIGIN}/a`, `${ORIGIN}/b`],
          samples: [],
          boilerplate: { blocks: over.map((p) => p.text), words: 300 },
        },
      ],
      profiles: [contactProfile],
    });
    const byUrl = new Map(section.pages.map((p) => [p.url, p]));
    expect(reasonOf(byUrl.get(`${ORIGIN}/de`))).toBe("language");
    expect(reasonOf(byUrl.get(`${ORIGIN}/a`))).toBe("prose words < 200");
    expect(reasonOf(byUrl.get(`${ORIGIN}/contact`))).toBe("page type contact");
    expect(section.medians.every((m) => m.value === null)).toBe(true);
  });

  it("is deterministic and adds nothing to the run when the option is off", async () => {
    const pages = [
      page("/over", fixtureProse("over")),
      page("/control", fixtureProse("control")),
    ];
    const seen: JudgeInput[] = [];
    const run = (copyQuality: boolean) =>
      runHandbook(
        {
          runId: "r1",
          origin: ORIGIN,
          mode: "REVIEW",
          registry: REGISTRY,
          collectors: [
            {
              key: "pages",
              dependsOn: [],
              collect: async () => ({ status: "ok", snapshots: pages }),
            },
          ],
          checks: [],
          maxPages: 10,
          judge: stubJudge({}, seen),
          options: { copyQuality },
        },
        {
          projectId: "p1",
          fetch: async () => {
            throw new Error("no network in tests");
          },
          fetchOffsite: async () => {
            throw new Error("no network in tests");
          },
          store: createMemoryEvidenceStore(),
          log: () => {},
        },
      );
    const off = await run(false);
    expect(off.copyQuality).toBeUndefined();
    const [a, b] = [await run(true), await run(true)];
    expect(JSON.stringify(a.copyQuality)).toBe(JSON.stringify(b.copyQuality));
    expect(a.evidence.filter((e) => e.itemId === "copy-quality")).toHaveLength(
      1,
    );
    expect(seen).toHaveLength(0);
    const report = buildReportJson({
      result: a,
      registry: REGISTRY,
      handbookVersion: "test",
      runId: "r1",
      origin: ORIGIN,
      mode: "REVIEW",
      startedAt: "2026-11-19T00:00:00.000Z",
      finishedAt: null,
    });
    expect(renderReviewMd(report, REGISTRY)).toContain(COPY_QUALITY_LABEL);
  });
});
