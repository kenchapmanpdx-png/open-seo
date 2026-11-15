import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  JsonLdData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL/SCHEMA (handbook §7, §33): the About page names people with roles in
 * Person schema whose names appear in the server text, and Article authors
 * reference those Person `@id`s (P5-17, deterministic part); an editorial /
 * review standards page is linked site-wide (P5-10, footer-wide link proxy:
 * present on ≥80% of pages; byline links are not checked).
 */
const ITEMS = ["P5-17", "P5-10"];

const ARTICLE_TYPES = new Set(["Article", "BlogPosting", "NewsArticle"]);
const STANDARDS =
  /editorial|standards|review[- ]?policy|corrections|ethics|fact[- ]?check/i;

type Person = { id: string | null; name: string; jobTitle: string | null };
type JsonLdPage = JsonLdData["pages"][number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const live = (s: PageSnapshot) =>
  s.status === 200 && normalizeUrl(s.finalUrl) === normalizeUrl(s.url);

const isAbout = (url: string) => /about/i.test(new URL(url).pathname);

/** Person objects anywhere in a value (top-level nodes, employee, founder…). */
function collectPeople(value: unknown, out: Person[]) {
  if (Array.isArray(value)) {
    for (const v of value) collectPeople(v, out);
    return;
  }
  if (!isRecord(value)) return;
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  const name = str(value.name);
  if (types.includes("Person") && name) {
    out.push({
      id: str(value["@id"]),
      name,
      jobTitle: str(value.jobTitle),
    });
  }
  for (const [k, v] of Object.entries(value)) {
    if (k !== "@type") collectPeople(v, out);
  }
}

function peopleOn(page: JsonLdPage): Person[] {
  const people: Person[] = [];
  for (const node of page.nodes) {
    collectPeople(
      { "@type": node.types, "@id": node.id, ...node.properties },
      people,
    );
  }
  return people;
}

/** `author` values of Article nodes: their @id (or null when unlinked). */
function authorRefs(pages: readonly JsonLdPage[]) {
  return pages.flatMap((page) =>
    page.nodes
      .filter((n) => n.types.some((t) => ARTICLE_TYPES.has(t)))
      .flatMap((n) => {
        const author = n.properties.author;
        const list = Array.isArray(author) ? author : author ? [author] : [];
        return list.map((a) => ({
          url: page.url,
          id: isRecord(a) ? str(a["@id"]) : null,
          label: isRecord(a) ? (str(a.name) ?? str(a["@id"])) : String(a),
        }));
      }),
  );
}

export const aboutPeopleCheck: HandbookCheck = {
  id: "crawl.about-people",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages", "jsonld"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, jsonld } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const pagesLive = pages.snapshots.filter(live);
    const jsonPages = jsonld.status === "ok" ? jsonld.pages : [];

    // P5-17
    const about = pagesLive.find((s) => isAbout(s.url));
    if (!about) {
      out.finding({
        itemIds: ["P5-17"],
        severity: "S3",
        title: "No About page found",
        detail: `none of ${pagesLive.length} crawled page(s) has "about" in its path`,
        fix: "Publish an About page naming the people behind the site with their roles, marked up as Person nodes.",
        fixability: "FIXABLE",
        effort: "M",
        urls: [ctx.origin],
        evidenceRefs: [
          out.evidence(
            "rawHtml",
            ctx.origin,
            pagesLive.map((s) => s.url).join("\n") || "no pages",
          ),
        ],
      });
    } else {
      const aboutJson = jsonPages.find(
        (p) => normalizeUrl(p.url) === normalizeUrl(about.url),
      );
      const people = aboutJson ? peopleOn(aboutJson) : [];
      const withRole = people.filter((p) => p.jobTitle);
      const text = about.markup.text.toLowerCase();
      const unseen = withRole.filter(
        (p) => !text.includes(p.name.toLowerCase()),
      );
      const ids = new Set(people.flatMap((p) => (p.id ? [p.id] : [])));
      const authors = authorRefs(jsonPages);
      const dangling = authors.filter((a) => !a.id || !ids.has(a.id));
      const aboutRef = () =>
        out.evidence(
          "jsonld",
          about.url,
          aboutJson?.blocks.map((b) => b.raw).join("\n") || "no JSON-LD",
        );
      const problems = [
        withRole.length === 0 &&
          `About page has no Person node with name + jobTitle (${people.length} Person node(s))`,
        unseen.length > 0 &&
          `Person names not in About page text: ${unseen.map((p) => p.name).join(", ")}`,
        dangling.length > 0 &&
          `Article authors not linked to an About Person @id: ${dangling
            .slice(0, 10)
            .map((a) => `${a.url} → ${a.label}`)
            .join("; ")}`,
      ].filter((p): p is string => !!p);
      if (problems.length > 0) {
        out.finding({
          itemIds: ["P5-17"],
          severity: "S3",
          title: "About page people are not marked up or linked from authors",
          detail: problems.join("\n"),
          fix: "List the named people and roles on the About page, emit a Person node for each (name, jobTitle, @id), and point Article author at those @ids.",
          fixability: "FIXABLE",
          effort: "S",
          urls: [about.url, ...new Set(dangling.map((a) => a.url))],
          evidenceRefs: [
            aboutRef(),
            ...dangling
              .slice(0, 10)
              .map((a) => out.evidence("jsonld", a.url, `author: ${a.label}`)),
          ],
        });
      } else {
        out.pass(
          "P5-17",
          `About Person nodes with roles: ${withRole.map((p) => p.name).join(", ")}; ${authors.length} Article author ref(s) resolve (visible-role wording not judged)`,
          [aboutRef()],
        );
      }
    }

    // P5-10
    if (pagesLive.length === 0) {
      out.na("P5-10", "no 200 page crawled");
      return out.build();
    }
    const counts = new Map<string, number>();
    for (const s of pagesLive) {
      const hrefs = new Set(
        s.links
          .filter((l) =>
            STANDARDS.test(`${l.text} ${new URL(l.href).pathname}`),
          )
          .map((l) => normalizeUrl(l.href)),
      );
      for (const h of hrefs) counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const needed = Math.ceil(pagesLive.length * 0.8);
    const sitewide = [...counts].filter(([, n]) => n >= needed);
    if (sitewide.length > 0) {
      const [href, n] = sitewide[0];
      out.pass(
        "P5-10",
        `standards page ${href} linked on ${n}/${pagesLive.length} pages (byline links not checked)`,
        [
          out.evidence(
            "rawHtml",
            pagesLive[0].url,
            `link → ${href}`,
            pagesLive[0].rawKey,
          ),
        ],
      );
    } else {
      out.finding({
        itemIds: ["P5-10"],
        severity: "S3",
        title: "No site-wide link to editorial / review standards",
        detail: counts.size
          ? `standards-like links on too few pages: ${[...counts]
              .map(([h, n]) => `${h} (${n}/${pagesLive.length})`)
              .join(", ")}`
          : `no link matching editorial/standards/corrections on ${pagesLive.length} page(s)`,
        fix: "Publish an editorial / review standards page and link it from the footer and article bylines.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [pagesLive[0].url],
        evidenceRefs: [
          out.evidence(
            "rawHtml",
            pagesLive[0].url,
            pagesLive[0].links.map((l) => `${l.text} → ${l.href}`).join("\n") ||
              "no links",
            pagesLive[0].rawKey,
          ),
        ],
      });
    }
    return out.build();
  },
};
