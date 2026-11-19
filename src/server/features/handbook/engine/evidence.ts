import { sha256Hex } from "@/server/lib/audit/ids";
import { truncateToBytes } from "@/server/lib/audit/html-response";
import type { EvidenceDraft } from "@/server/features/handbook/contracts/check";
import { EVIDENCE_EXCERPT_MAX_BYTES } from "@/server/features/handbook/contracts/evidence-store";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import type { SiteFactMap } from "@/server/features/handbook/contracts/site-fact-map";
import type { CopyQuality } from "@/server/features/handbook/contracts/scaled-copy";
import { SUPP_BY_ID } from "../registry-supp";
import type {
  EvidenceRow,
  FindingRow,
  HandbookRuntime,
  PendingResult,
  RunInput,
} from "./runner";

/**
 * Turns validated check results into numbered findings (F01… by severity,
 * then item id) and evidence rows; bodies go to the K4 store under
 * deterministic keys so workflow replays overwrite instead of duplicating.
 */
const SEVERITY_ORDER = ["S1", "S2", "S3", "S4"];

export async function materialize(
  input: RunInput,
  runtime: HandbookRuntime,
  pending: PendingResult[],
  registry: ReadonlyMap<string, RegistryEntry>,
) {
  const drafts = pending.flatMap(({ checkId, checkClass, result }) =>
    result.findings.map((finding) => ({
      checkId,
      checkClass,
      finding,
      result,
    })),
  );
  drafts.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.finding.severity) -
        SEVERITY_ORDER.indexOf(b.finding.severity) ||
      (a.finding.itemIds[0] ?? "").localeCompare(
        b.finding.itemIds[0] ?? "",
        undefined,
        { numeric: true },
      ),
  );
  const findings: FindingRow[] = [];
  const evidence: EvidenceRow[] = [];
  for (const [
    index,
    { checkId, checkClass, finding, result },
  ] of drafts.entries()) {
    const code = `F${String(index + 1).padStart(2, "0")}`;
    const primary = registry.get(finding.itemIds[0] ?? "");
    const refs =
      primary?.refs ?? SUPP_BY_ID.get(finding.itemIds[0] ?? "")?.refs ?? [];
    const { evidenceRefs, ...rest } = finding;
    findings.push({
      ...rest,
      code,
      checkId,
      class: checkClass,
      phase: primary?.phase ?? "P1",
      sectionRef: refs.map((r) => `§${r}`).join(", "),
    });
    for (const ref of evidenceRefs) {
      const draft = result.evidence.find((e) => e.ref === ref);
      if (draft)
        evidence.push(
          await evidenceRow(
            { input, runtime, checkId },
            draft,
            finding.itemIds[0] ?? "",
            code,
          ),
        );
    }
  }
  for (const { checkId, result } of pending) {
    for (const verdict of result.statuses) {
      for (const ref of verdict.evidenceRefs) {
        const draft = result.evidence.find((e) => e.ref === ref);
        if (draft)
          evidence.push(
            await evidenceRow(
              { input, runtime, checkId },
              draft,
              verdict.itemId,
              null,
            ),
          );
      }
    }
  }
  return { findings, evidence };
}

/**
 * The run's K15 fact map as one `factMap` evidence row (full JSON in the
 * store, counts in the excerpt). Filed under P5-02, the fact map's
 * stat-conflict item; WO-B9-017 judges cite its entries.
 */
export function factMapEvidence(
  input: RunInput,
  runtime: HandbookRuntime,
  map: SiteFactMap,
): Promise<EvidenceRow> {
  const c = map.coverage;
  const excerpt = [
    `fact map: ${map.statConflicts.length} stat conflicts, ${map.nameVariants.length} name clusters, ${map.faqDuplicates.length} duplicate FAQs, ${map.thinPages.length} thin pages, ${map.serviceCoverage.length} hubs`,
    `coverage: ${c.profiled}/${c.pages} pages profiled (${c.cached} cached, ${c.skippedBudget} skipped by budget), ${c.droppedQuotes} quotes dropped`,
    ...map.statConflicts
      .slice(0, 10)
      .map((s) => `${s.subject}: ${s.values.map((v) => v.value).join(" vs ")}`),
  ].join("\n");
  return evidenceRow(
    { input, runtime, checkId: "runner.reduce" },
    {
      ref: "fact-map",
      kind: "factMap",
      url: input.origin,
      excerpt,
      body: {
        bytes: new TextEncoder().encode(JSON.stringify(map, null, 2)),
        contentType: "application/json",
      },
    },
    "P5-02",
    null,
  );
}

/** Item id of the copy-quality artifact row (ADR-023; not a registry item). */
export const COPY_QUALITY_EVIDENCE_ITEM = "copy-quality";

/** The copy-quality section as one artifact (JSON body); the app's run page reads it back. */
export function copyQualityEvidence(
  input: RunInput,
  runtime: HandbookRuntime,
  section: CopyQuality,
): Promise<EvidenceRow> {
  const measured = section.pages.filter((p) => p.measured).length;
  return evidenceRow(
    { input, runtime, checkId: "runner.copy-quality" },
    {
      ref: "copy-quality",
      kind: "artifact",
      url: input.origin,
      excerpt: `${section.label}\ncopy quality: ${measured}/${section.pages.length} pages measured`,
      body: {
        bytes: new TextEncoder().encode(JSON.stringify(section)),
        contentType: "application/json",
      },
    },
    COPY_QUALITY_EVIDENCE_ITEM,
    null,
  );
}

async function evidenceRow(
  {
    input,
    runtime,
    checkId,
  }: { input: RunInput; runtime: HandbookRuntime; checkId: string },
  draft: EvidenceDraft,
  itemId: string,
  findingCode: string | null,
): Promise<EvidenceRow> {
  let storageKey = draft.storageKey ?? null;
  let byteSize = new TextEncoder().encode(draft.excerpt).byteLength;
  let sha256 = await sha256Hex(draft.excerpt);
  if (draft.body) {
    const key = await evidenceKey({
      projectId: runtime.projectId,
      runId: input.runId,
      kind: draft.kind,
      url: draft.url,
      bytes: draft.body.bytes,
      contentType: draft.body.contentType,
    });
    const stored = await runtime.store.put(
      key,
      draft.body.bytes,
      draft.body.contentType,
    );
    storageKey = stored.key;
    byteSize = stored.byteSize;
    sha256 = stored.sha256;
  }
  return {
    id: (
      await sha256Hex(
        `${input.runId}|${checkId}|${draft.ref}|${itemId}|${findingCode ?? ""}`,
      )
    ).slice(0, 26),
    findingCode,
    itemId,
    kind: draft.kind,
    url: draft.url,
    storageKey,
    excerpt: truncateToBytes(draft.excerpt, EVIDENCE_EXCERPT_MAX_BYTES),
    sha256,
    byteSize,
    contentType: draft.body?.contentType ?? null,
  };
}

const EXT: Record<string, string> = {
  "text/html": "html",
  "text/plain": "txt",
  "application/xml": "xml",
  "application/json": "json",
};

/** `<projectId>/<runId>/<kind>/<sha256-prefix>-<slug>.<ext>` (K4). */
export async function evidenceKey(o: {
  projectId: string;
  runId: string;
  kind: string;
  url: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const { projectId, runId, kind, url, contentType } = o;
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(o.bytes));
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const slug = url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .slice(0, 60);
  return `${projectId}/${runId}/${kind}/${hex.slice(0, 12)}-${slug}.${EXT[contentType] ?? "bin"}`;
}
