import type { Rubric } from "./judge";

/**
 * K5 rubrics (ADR-007), one per LLM check. Each states the handbook rule
 * (fork/handbook §-refs in the item text) as pass/fail criteria the judge can
 * apply to the page views it receives. Bump `version` whenever the wording
 * changes: it is part of the prompt hash logged in `handbook_llm_call`.
 */
const list: Rubric[] = [
  {
    id: "opening-sentence",
    version: 1,
    instructions: [
      "Handbook §3: the first sentence of the main content names the brand, the subject of the page and what the page gives the reader (answer first, within the first 60 words).",
      "Each page's text starts with its title and H1, then the opening of the visible main content (navigation may precede it; skip menus, cookie notices and repeated header links).",
      "fail when any page's opening sentence omits the brand, omits the subject, or is a slogan, greeting or teaser that gives nothing concrete. Quote the weak opening sentence.",
      "pass when every page meets the rule. Contact, legal and thank-you pages are exempt.",
    ].join("\n"),
  },
  {
    id: "superlatives-acronyms",
    version: 1,
    instructions: [
      "Handbook §6: no placeholder copy (lorem ipsum, TODO, [Brand]); no superlatives (best, #1, leading, most, fastest, premier) or percentage claims without an on-page citation; every acronym spelled out on first use on each page.",
      "Well-known acronyms that are the brand name itself, units (km, mph) and universal ones (USA, FAQ, URL) are exempt. A superlative inside a quoted customer review is exempt when the review is attributed.",
      "fail when a page has a placeholder, an unsupported superlative or percentage claim, or an acronym never spelled out on that page. Quote each offending phrase (at most 6).",
      "pass when none of the pages has such a problem.",
    ].join("\n"),
  },
  {
    id: "page-specific-faq",
    version: 1,
    instructions: [
      'Handbook §3, §7: an FAQ block answers real questions about that page\'s own subject. Generic questions that would fit any page of the site ("How do I contact you?", "Where are you located?" on a service page) or the same FAQ repeated on several pages are defects.',
      "The pages given are the ones that carry an FAQ block.",
      "fail when an FAQ question is generic or off the page's subject, or the same questions appear on more than one page. Quote the offending questions.",
      "pass when every FAQ question is specific to its page.",
    ].join("\n"),
  },
  {
    id: "titles-h1",
    version: 1,
    instructions: [
      'Handbook §2: the title states what the page offers (service, product or topic; plus the place when facts.local is true) before the brand. Brand-only titles ("Brand") and bare page-label titles ("Services | Brand", "Contact - Brand", "Home | Brand") are defects. The H1 states the page topic, not a promo or banner ("Book now!", "Welcome").',
      "Each page's text is its title, meta description and H1 lines. Contact, legal, 404 and thank-you pages may use plain labels.",
      "fail when any other page breaks the rule. Quote the offending title or H1 line exactly as given.",
      "pass when every remaining page meets the rule.",
    ].join("\n"),
  },
  {
    id: "entity-test",
    version: 1,
    instructions: [
      "Handbook §25 entity test: the home page's title, meta description and first H1 alone must reveal what kind of business this is and, when facts.local is true, where it operates. A person-named or place-named brand must state its business category beside the name.",
      "Also: the brand name and key-person names are spelled one way across all pages given (case, spacing, punctuation, abbreviations).",
      "fail when the home page's title + description + H1 do not reveal the business type (or place when local), or a brand or person name is spelled two ways. Quote the lines that show it.",
      "pass when both parts hold.",
    ].join("\n"),
  },
  {
    id: "stats-consistency",
    version: 1,
    instructions: [
      "Handbook §6, §20: each statistic (counts of events, customers, years in business, money raised, people served, ratings, prices) is stated with one value everywhere: page copy, meta descriptions, llms.txt and About must match.",
      "Each page's text is a fact table: its meta description and the sentences on that page that contain numbers. A url ending in llms.txt or llms-full.txt is the site's llms file.",
      'fail when the same quantity is given different values in different places or within one source ("21 events" vs "18 events"; "$40K raised" vs "$45,000 raised"), unless the wording makes clear they measure different things or different dates. Quote both conflicting statements, each from its own url.',
      'Different quantities that merely share a number are not a conflict. Rounded forms of one value ("over 1,000" vs "1,050") are not a conflict.',
      "pass when no quantity conflicts.",
    ].join("\n"),
  },
];

export const RUBRICS: ReadonlyMap<string, Rubric> = new Map(
  list.map((r) => [r.id, r]),
);
