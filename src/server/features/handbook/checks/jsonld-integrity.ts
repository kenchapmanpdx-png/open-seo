import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { JsonLdNode } from "@/server/features/handbook/contracts/collectors";
import { groupBy, sort } from "remeda";
import { createResult } from "./support";

/** Entries whose `key` differs from the most common key in the group. */
function minority<T>(group: readonly T[], key: (t: T) => string): T[] {
  const counts = new Map<string, number>();
  for (const t of group) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1);
  if (counts.size < 2) return [];
  const top = sort([...counts], (a, b) => b[1] - a[1])[0]?.[0];
  return group.filter((t) => key(t) !== top);
}

/**
 * SCHEMA exemplar (handbook §24): every JSON-LD block parses (P6-08);
 * organization nodes carry one stable `@id` with identical values wherever
 * repeated (P6-03, deterministic part); no §24 placeholder sentinels in
 * JSON-LD or `<meta content>` by typed whole-value match (P6-15). Rich
 * Results Test, GSC validation, sameAs/GBP completeness and provenance
 * records stay manual; PASS notes say so.
 */
const ITEMS = ["P6-08", "P6-15", "P6-03"];

const ORG_TYPE =
  /^(Organization|Corporation|NGO|LocalBusiness|.*(Organization|Business|Store|Salon|Shop))$/;

const isOrg = (node: JsonLdNode) => node.types.some((t) => ORG_TYPE.test(t));

const nameOf = (node: JsonLdNode) =>
  typeof node.properties.name === "string" ? node.properties.name.trim() : null;

// --- §24 placeholder sentinels -------------------------------------------

const EXACT = new Set(
  [
    "0000000000000",
    "PROD-001",
    "123 Main St",
    "00000",
    "00.0000",
    "Founder Name",
    "Author Name",
    "Reviewer Name",
    "@brandhandle",
    "0000-0000-0000-0000",
  ].map((s) => s.toLowerCase()),
);
const EXAMPLE_DATES = ["2024-08-15", "2026-05-01", "2026-12-31", "2027-03-14"];

function sentinel(value: string): string | null {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (EXACT.has(lower)) return v;
  if (/^\[[^\]]+\]$/.test(v)) return v;
  if (/(^|[/.@])yoursite\.com\b/i.test(v)) return "yoursite.com";
  if (/\/(company|organization)\/brand\/?$/i.test(v)) return v;
  if (/\bTODO\b|\bXXX\b|\blorem\b/.test(v)) return v;
  const date = EXAMPLE_DATES.find((d) => v === d || v.startsWith(`${d}T`));
  return date ?? null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const scalar = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

/** Walk a parsed JSON-LD value; yields `path = value` for every sentinel hit. */
function scan(value: unknown, path: string, hits: string[]) {
  if (typeof value === "string") {
    const hit = sentinel(value);
    if (hit) hits.push(`${path} = "${value}"`);
    return;
  }
  if (typeof value === "number" && path.endsWith("postalCode")) {
    if (value === 0) hits.push(`${path} = ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scan(v, `${path}[${i}]`, hits));
    return;
  }
  if (isRecord(value)) {
    const record = value;
    const rating = scalar(record.ratingValue);
    const count = scalar(record.reviewCount ?? record.ratingCount);
    if (rating === "4.7" && count === "1284")
      hits.push(`${path} = ratingValue 4.7 + count 1284`);
    for (const [k, v] of Object.entries(record)) scan(v, `${path}.${k}`, hits);
  }
}

function parseBlock(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const jsonLdIntegrityCheck: HandbookCheck = {
  id: "schema.jsonld-integrity",
  itemIds: ITEMS,
  class: "SCHEMA",
  requires: ["jsonld", "pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { jsonld, pages } = ctx.collected;
    if (jsonld.status !== "ok" || pages.status !== "ok") return out.build();
    const withBlocks = jsonld.pages.filter((p) => p.blocks.length > 0);
    const passRefs: string[] = [];

    // P6-08 — parse errors.
    const broken = withBlocks.flatMap((p) =>
      p.blocks
        .filter((b) => b.parseError)
        .map((b) => ({ url: p.url, block: b })),
    );
    if (broken.length > 0) {
      const refs = broken.map(({ url, block }) =>
        out.evidence("jsonld", url, `${block.parseError}\n\n${block.raw}`),
      );
      out.finding({
        itemIds: ["P6-08"],
        severity: "S2",
        title: "JSON-LD block does not parse",
        detail: broken
          .map(
            ({ url, block }) =>
              `${url} block ${block.index}: ${block.parseError}`,
          )
          .join("\n"),
        fix: "Fix the JSON syntax (trailing commas, unescaped quotes, template output) so every block parses, then re-run the Rich Results Test per template.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(broken.map((b) => b.url))],
        evidenceRefs: refs,
      });
    }

    // P6-15 — sentinels in JSON-LD and meta content.
    const sentinelHits = new Map<string, { hits: string[]; ref: string }>();
    for (const page of withBlocks) {
      const hits: string[] = [];
      for (const block of page.blocks) {
        if (!block.parseError)
          scan(parseBlock(block.raw), `block${block.index}`, hits);
      }
      if (hits.length > 0) {
        const ref = out.evidence(
          "jsonld",
          page.url,
          `${hits.join("\n")}\n\n${page.blocks.map((b) => b.raw).join("\n")}`,
        );
        sentinelHits.set(page.url, { hits, ref });
      }
    }
    for (const snap of pages.snapshots) {
      const meta = {
        description: snap.head.metaDescription,
        ...snap.head.og,
        ...snap.head.twitter,
      };
      const hits = Object.entries(meta).flatMap(([k, v]) =>
        v && sentinel(v) ? [`meta ${k} = "${v}"`] : [],
      );
      if (hits.length === 0) continue;
      const ref = out.evidence("rawHtml", snap.url, hits.join("\n"));
      const prev = sentinelHits.get(snap.url);
      sentinelHits.set(snap.url, {
        hits: [...(prev?.hits ?? []), ...hits],
        ref: prev?.ref ?? ref,
      });
    }
    if (sentinelHits.size > 0) {
      out.finding({
        itemIds: ["P6-15"],
        severity: "S2",
        title: "§24 placeholder sentinel values in JSON-LD / meta",
        detail: [...sentinelHits]
          .map(([url, { hits }]) => `${url}\n  ${hits.join("\n  ")}`)
          .join("\n"),
        fix: "Replace every sentinel with the owner-confirmed value or remove the property; a genuine value equal to an example passes only with recorded provenance (property, URL, source).",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...sentinelHits.keys()],
        evidenceRefs: [...sentinelHits.values()].map((h) => h.ref),
      });
    }

    // P6-03 — organization @id integrity (deterministic part).
    const orgs = jsonld.pages.flatMap((p) =>
      p.nodes.filter(isOrg).map((node) => ({ url: p.url, node })),
    );
    const issues: { url: string; text: string }[] = [];
    if (orgs.length === 0) {
      issues.push({
        url: new URL("/", ctx.origin).href,
        text: "no Organization / LocalBusiness node on any crawled page",
      });
    }
    for (const { url, node } of orgs) {
      if (!node.id)
        issues.push({
          url,
          text: `${node.types.join("/")} "${nameOf(node) ?? "?"}" has no @id`,
        });
    }
    const named = orgs.flatMap(({ url, node }) => {
      const name = nameOf(node);
      return node.id && name ? [{ url, id: node.id, name }] : [];
    });
    // Same @id with differing names; same name under several @ids. The
    // majority value is the reference; pages carrying another value are cited.
    for (const [id, group] of Object.entries(groupBy(named, (n) => n.id))) {
      for (const n of minority(group, (x) => x.name))
        issues.push({
          url: n.url,
          text: `@id ${id} named "${n.name}" here, differently elsewhere`,
        });
    }
    for (const group of Object.values(
      groupBy(named, (n) => n.name.toLowerCase()),
    )) {
      for (const n of minority(group, (x) => x.id))
        issues.push({
          url: n.url,
          text: `"${n.name}" uses @id ${n.id} here; other pages use ${group.find((g) => g.id !== n.id)?.id}`,
        });
    }
    if (issues.length > 0) {
      const refs = issues.map((i) => out.evidence("jsonld", i.url, i.text));
      out.finding({
        itemIds: ["P6-03"],
        severity: "S2",
        title: "Organization nodes lack one stable @id",
        detail: issues.map((i) => `${i.url}: ${i.text}`).join("\n"),
        fix: "Give the organization one `@id` (e.g. `https://<host>/#organization`), emit the full node on Home/About, and reference that `@id` elsewhere with identical values.",
        fixability: "FIXABLE",
        effort: "M",
        urls: [...new Set(issues.map((i) => i.url))],
        evidenceRefs: refs,
      });
    }

    if (withBlocks.length === 0) {
      for (const id of ITEMS) out.na(id, "no JSON-LD on crawled pages");
      return out.build();
    }
    const first = withBlocks[0];
    if (first) {
      passRefs.push(
        out.evidence(
          "jsonld",
          first.url,
          first.blocks.map((b) => b.raw).join("\n"),
        ),
      );
    }
    out.pass(
      "P6-08",
      `${withBlocks.length} pages, every block parses (Rich Results Test / GSC validation manual)`,
      passRefs,
    );
    out.pass("P6-15", "no §24 sentinel by typed whole-value match", passRefs);
    out.pass(
      "P6-03",
      "organization @id stable and consistent (sameAs/GBP completeness manual)",
      passRefs,
    );
    return out.build();
  },
};
