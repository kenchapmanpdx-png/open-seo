import type {
  JsonLdData,
  LlmsData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import type {
  FactRef,
  SiteFactMap,
} from "@/server/features/handbook/contracts/site-fact-map";
import { sort } from "remeda";
import { normalizeUrl } from "../checks/support";
import {
  countClaims,
  hubs,
  live,
  llmsLists,
  NUMBER_WORDS,
  singular,
  STOP,
  type Claim,
} from "./reduce-lists";

/**
 * Reduce (ADR-019, FULL-READ §5.3): PageProfiles + llms.txt + JSON-LD +
 * crawled pages → K15 SiteFactMap. Deterministic, no LLM call. Every entry
 * carries the quotes it came from.
 */

/** Map-stage counters the profiles alone do not carry. */
export type MapCounts = { cached: number; skippedBudget: number };

/** Indexable 200 page below this many main-content words (handbook §17, P3-12). */
const THIN_WORDS = 50;

/** Lower-case, singular, number-word → digits, filler words dropped. */
function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[^a-z0-9$%+\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w in NUMBER_WORDS ? String(NUMBER_WORDS[w]) : singular(w)))
    .join(" ");
}

type Value = { n: number | null; plus: boolean; text: string };

/** "$3M+", "3,000,000+", "21", "twenty" → comparable value. */
function parseValue(raw: string): Value {
  const text = raw.trim().toLowerCase();
  const word = NUMBER_WORDS[text.replace(/\+$/, "")];
  if (word !== undefined)
    return { n: word, plus: text.endsWith("+"), text: String(word) };
  const m =
    /^[$€£]?\s?(\d[\d,]*(?:\.\d+)?)\s*([km]|million|thousand)?\s*(\+)?/.exec(
      text,
    );
  if (!m?.[1]) return { n: null, plus: false, text };
  const scale = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 }[m[2] ?? ""];
  const n = Number(m[1].replace(/,/g, "")) * (scale ?? 1);
  return { n, plus: Boolean(m[3]), text: `${n}${m[3] ? "+" : ""}` };
}

/** "20+" agrees with 21; two "at least" claims agree with each other. */
function compatible(a: Value, b: Value): boolean {
  if (a.n === null || b.n === null) return a.text === b.text;
  if (a.plus && b.plus) return true;
  if (a.plus) return b.n >= a.n;
  if (b.plus) return a.n >= b.n;
  return a.n === b.n;
}

/** Groups claims by parsed value; a conflict needs two incompatible values. */
function conflictValues(claims: readonly Claim[]) {
  const groups = new Map<
    string,
    { value: string; v: Value; refs: FactRef[] }
  >();
  for (const c of claims) {
    const v = parseValue(c.value);
    const g = groups.get(v.text) ?? { value: c.value, v, refs: [] };
    if (!g.refs.some((r) => r.url === c.ref.url && r.quote === c.ref.quote))
      g.refs.push(c.ref);
    groups.set(v.text, g);
  }
  const list = [...groups.values()];
  const clash = list.some((a, i) =>
    list.slice(i + 1).some((b) => !compatible(a.v, b.v)),
  );
  return clash ? list.map(({ value, refs }) => ({ value, refs })) : null;
}

const JSONLD_STATS: Record<string, string> = {
  foundingDate: "year founded",
  numberOfEmployees: "employee",
  reviewCount: "review",
  ratingCount: "rating count",
  ratingValue: "rating",
};

type Bucket<T> = Map<string, T>;
const push = <T>(map: Bucket<T[]>, key: string, value: T) =>
  map.set(key, [...(map.get(key) ?? []), value]);

function profileSource(p: PageProfile, llmsUrls: ReadonlySet<string>) {
  if (p.scope === "template") return "template" as const;
  return llmsUrls.has(normalizeUrl(p.url))
    ? ("llmsTxt" as const)
    : ("page" as const);
}

function inventory(
  profiles: readonly { p: PageProfile; ref: (quote: string) => FactRef }[],
  pick: (p: PageProfile) => readonly { text: string; quote: string }[],
): SiteFactMap["superlatives"] {
  const groups: Bucket<{ text: string; refs: FactRef[] }> = new Map();
  for (const { p, ref } of profiles)
    for (const item of pick(p)) {
      const key = item.text.toLowerCase().replace(/\s+/g, " ").trim();
      const g = groups.get(key) ?? { text: item.text, refs: [] };
      g.refs.push(ref(item.quote));
      groups.set(key, g);
    }
  return [...groups.values()];
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]/g, "");
const words = (s: string) =>
  s
    .replace(/[™®©]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
const initials = (s: string) =>
  words(s)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/** Name clusters: case / space / punctuation / ™ folding, acronym ↔ expansion, brand prefix. */
function nameVariants(
  names: readonly {
    kind: "brand" | "person" | "place";
    text: string;
    ref: FactRef;
  }[],
): SiteFactMap["nameVariants"] {
  const parent = names.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i] ?? i));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  names.forEach((a, i) =>
    names.forEach((b, j) => {
      if (j <= i || a.kind !== b.kind) return;
      const fa = fold(a.text);
      const fb = fold(b.text);
      const acronym = (x: string, y: string) =>
        /^[A-Z]{2,6}$/.test(x) && words(y).length >= 2 && initials(y) === x;
      const prefix = (x: string, y: string) =>
        a.kind === "brand" &&
        fold(x).length >= 6 &&
        fold(y).startsWith(fold(x)) &&
        words(y).length > words(x).length;
      if (
        fa === fb ||
        acronym(a.text, b.text) ||
        acronym(b.text, a.text) ||
        prefix(a.text, b.text) ||
        prefix(b.text, a.text)
      )
        union(i, j);
    }),
  );
  const clusters: Bucket<number[]> = new Map();
  names.forEach((_, i) => push(clusters, String(find(i)), i));
  const out: SiteFactMap["nameVariants"] = [];
  for (const members of clusters.values()) {
    const byText: Bucket<FactRef[]> = new Map();
    for (const i of members) {
      const n = names[i];
      if (n) push(byText, n.text, n.ref);
    }
    if (byText.size < 2) continue;
    const variants = [...byText].map(([text, refs]) => ({ text, refs }));
    const canonical = sort(
      variants,
      (a, b) => b.refs.length - a.refs.length || b.text.length - a.text.length,
    )[0];
    const kind = names[members[0] ?? 0]?.kind ?? "brand";
    out.push({ kind, canonical: canonical?.text ?? "", variants });
  }
  return out;
}

const normQuestion = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function buildSiteFactMap(
  profiles: readonly PageProfile[],
  jsonld: JsonLdData | null,
  llms: LlmsData | null,
  pages: readonly PageSnapshot[],
  counts: MapCounts = { cached: 0, skippedBudget: 0 },
): SiteFactMap {
  const llmsUrls = new Set((llms?.files ?? []).map((f) => normalizeUrl(f.url)));
  const sourced = profiles.map((p) => {
    const source = profileSource(p, llmsUrls);
    return {
      p,
      ref: (quote: string): FactRef => ({ url: p.url, source, quote }),
    };
  });

  // Stat conflicts by normalized subject (profiles + JSON-LD).
  const bySubject: Bucket<Claim[]> = new Map();
  for (const { p, ref } of sourced)
    for (const s of p.stats)
      push(bySubject, normalizeSubject(s.subject), {
        value: s.value,
        ref: ref(s.quote),
      });
  for (const page of jsonld?.pages ?? [])
    for (const node of page.nodes)
      for (const [key, subject] of Object.entries(JSONLD_STATS)) {
        const raw = node.properties[key];
        if (typeof raw !== "string" && typeof raw !== "number") continue;
        const value =
          key === "foundingDate" ? String(raw).slice(0, 4) : String(raw);
        push(bySubject, subject, {
          value,
          ref: {
            url: page.url,
            source: "jsonld",
            quote: `"${key}": ${JSON.stringify(raw)}`,
          },
        });
      }
  const statConflicts: SiteFactMap["statConflicts"] = [];
  for (const [subject, claims] of bySubject) {
    const values = conflictValues(claims);
    if (subject && values) statConflicts.push({ subject, values });
  }

  // List counts: llms.txt list sections and hubs vs stated counts anywhere.
  const html = pages.filter(live);
  const hubLists = hubs(html);
  for (const list of [...llmsLists(llms), ...hubLists]) {
    const claims: Claim[] = [];
    for (const page of html)
      claims.push(
        ...countClaims(
          [page.head.metaDescription ?? "", page.markup.text].join("\n"),
          list.noun,
          { url: page.finalUrl, source: "page" },
        ),
      );
    for (const file of llms?.files ?? [])
      if (file.status === 200 && file.text)
        claims.push(
          ...countClaims(file.text, list.noun, {
            url: file.url,
            source: "llmsTxt",
          }),
        );
    for (const { p, ref } of sourced)
      for (const s of p.stats)
        if (normalizeSubject(s.subject).split(" ").at(-1) === list.noun)
          claims.push({ value: s.value, ref: ref(s.quote) });
    const listed = parseValue(String(list.count));
    const off = claims.filter((c) => !compatible(parseValue(c.value), listed));
    const values = conflictValues([
      ...off,
      { value: `${list.count} listed`, ref: list.ref },
    ]);
    if (off.length > 0 && values)
      statConflicts.push({ subject: `${list.noun} count`, values });
  }

  const names = sourced.flatMap(({ p, ref }) =>
    p.names.map((n) => ({ kind: n.kind, text: n.text, ref: ref(n.quote) })),
  );

  const faqUrls: Bucket<Set<string>> = new Map();
  const faqText = new Map<string, string>();
  for (const { p } of sourced) {
    if (p.scope !== "page") continue;
    for (const q of [
      ...p.faqQuestions.map((f) => f.text),
      ...p.faqPairs.map((f) => f.question),
    ]) {
      const key = normQuestion(q);
      if (!key) continue;
      faqText.set(key, faqText.get(key) ?? q);
      faqUrls.set(key, (faqUrls.get(key) ?? new Set()).add(p.url));
    }
  }

  const profileByUrl = new Map(
    profiles
      .filter((p) => p.scope === "page")
      .map((p) => [normalizeUrl(p.url), p]),
  );
  const indexable = html.filter(
    (s) => !/noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`),
  );

  return {
    statConflicts,
    nameVariants: nameVariants(names),
    superlatives: inventory(sourced, (p) => p.superlatives),
    placeholders: inventory(sourced, (p) => p.placeholders),
    undefinedAcronyms: inventory(sourced, (p) => p.undefinedAcronyms),
    awards: inventory(sourced, (p) => p.awards).map((a) => {
      const all = profiles.flatMap((p) =>
        p.awards.filter((x) => x.text.toLowerCase() === a.text.toLowerCase()),
      );
      return {
        ...a,
        hasYear: all.some((x) => x.hasYear),
        hasSource: all.some((x) => x.hasSource),
      };
    }),
    faqDuplicates: [...faqUrls]
      .filter(([, urls]) => urls.size >= 2)
      .map(([key, urls]) => ({
        question: faqText.get(key) ?? key,
        urls: [...urls],
      })),
    thinPages: indexable
      .filter((s) => (s.mainWords ?? s.wordsRaw) < THIN_WORDS)
      .map((s) => ({
        url: s.finalUrl,
        words: s.mainWords ?? s.wordsRaw,
        hasKeyFactsBlock: Boolean(
          profileByUrl.get(normalizeUrl(s.finalUrl))?.keyFactsBlock,
        ),
      })),
    serviceCoverage: hubLists.map((h) => ({
      hubUrl: h.ref.url,
      children: h.children,
    })),
    coverage: {
      pages: new Set(html.map((s) => normalizeUrl(s.finalUrl))).size,
      profiled: [...profileByUrl.keys()].filter((u) => !llmsUrls.has(u)).length,
      cached: counts.cached,
      skippedBudget: counts.skippedBudget,
      droppedQuotes: profiles.reduce((n, p) => n + p.droppedQuotes, 0),
    },
  };
}
