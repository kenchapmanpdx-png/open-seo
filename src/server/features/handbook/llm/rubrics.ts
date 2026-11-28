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
    version: 3,
    instructions: [
      "Handbook §25 entity test: the home page's title, meta description and first H1 alone must reveal what kind of business this is and, when facts.local is true, where it operates. A person-named or place-named brand must state its business category beside the name.",
      "Also: the brand name and key-person and event names are spelled one way across all pages given (case, spacing, punctuation, abbreviations, '&' vs 'and').",
      "'Name mentions:' blocks list body-text sentences that contain a spelling of the brand or of a schema event/person name, one per page per spelling. Use them to judge spelling consistency: different case alone (WHY vs Why) counts when the brand writes itself one way in its logo/title. A plain English word that happens to match (\"why we race\") is not a mention.",
      "fail when the home page's title + description + H1 do not reveal the business type (or place when local), or a brand, person or event name is spelled two ways. Quote the lines that show it (both spellings, each copied exactly as the page prints it: same case, spacing and punctuation).",
      'When a name spelled two ways is among the reasons for a fail, start the rationale with "Spelling:".',
      "pass when both parts hold.",
    ].join("\n"),
  },
  {
    id: "stats-consistency",
    version: 2,
    instructions: [
      "Handbook §6, §20: each statistic (counts of events, customers, years in business, money raised, people served, ratings, prices) is stated with one value everywhere: page copy, meta descriptions, llms.txt and About must match. Every stat is also sourced and dated.",
      "Each page's text is a fact table: its meta description and the sentences on that page that contain numbers. A url ending in llms.txt or llms-full.txt is the site's llms file.",
      'fail when the same quantity is given different values in different places or within one source ("21 events" vs "18 events"; "$40K raised" vs "$45,000 raised"), unless the wording makes clear they measure different things or different dates. Quote both conflicting statements, each from its own url.',
      'Different quantities that merely share a number are not a conflict. Rounded forms of one value ("over 1,000" vs "1,050") are not a conflict.',
      'Also fail when a percentage, rate or market-size figure ("96% approval", "$3 billion funded", "tens of thousands of clients") is stated with neither a named source nor a year or date in its sentence; quote it. The business\'s own plain counts ("14 events") and prices need no source.',
      "pass when no quantity conflicts and every percentage, rate or market-size figure carries a source or a date.",
    ].join("\n"),
  },
  {
    id: "page-type-matrix",
    version: 1,
    instructions: [
      "Handbook §7 page-type matrix: home, service, product, location and contact pages carry no article furniture: author byline, 'key takeaways' box, citation or references list, visible 'last updated' / 'published on' stamp. Articles, guides and blog posts may carry them.",
      "Each page's text is its title, meta description and H1, then the opening of its visible main content. Decide each page's type from its URL, title and content; the pages given are expected to be non-article pages, but a page that is clearly an article or guide is exempt.",
      "Customer reviews with a reviewer name and date are not a byline. A copyright year in the footer is not a 'last updated' stamp.",
      "fail when a non-article page carries article furniture; quote it.",
      "pass otherwise.",
    ].join("\n"),
  },
  {
    id: "awards-as-text",
    version: 2,
    instructions: [
      "Handbook §6: every award, press mention and certification is stated as HTML text naming the awarding body (or publication), the year, and a link to the source. A badge image may decorate it but must not be the only statement.",
      "Each page's text lists the award-like images (alt and src), award-like sentences and award-like links found on that page.",
      "An award-like image counts as stated in text only when an award-like sentence on the same page names the same award with its body and year.",
      'Compliance and trust badges are certifications: "HIPAA compliant", "SOC 2", "PCI DSS", "BBB accredited", "verified" or "secure" seals each claim that a body certified the business, so each needs text naming that body (and the year). Payment-card and partner logos are not certifications.',
      "fail when an award, press mention or certification is shown only as an image, or as text missing the awarding body, the year, or a source link; quote the text or the image line (alt/src) exactly as given.",
      "pass when every one is complete text, or when nothing listed is actually an award, press mention or certification (e.g. 'press' as a verb, a 'featured events' heading).",
    ].join("\n"),
  },
  {
    id: "detail-key-facts",
    version: 1,
    instructions: [
      "Handbook §6, §7: each detail page (one event, product, listing, case study) has a key-facts block (a list or table of the item's own facts: date, place, price, distance, specs, duration) and facts unique to that item, not template copy with the name swapped.",
      "Each page's text is its title, meta description and H1, then the opening of its main content. facts.detailPages gives per page: template, word count, number of tables and lists, and sharedSentenceRatio (share of its sentences that also appear on another sampled page of the same template).",
      "A sharedSentenceRatio above 0.5 with few words means the body is mostly boilerplate. A page with no tables or lists may still have a key-facts block as labelled lines ('Date: …', 'Location: …').",
      "fail when a page lacks a key-facts block or its body is mostly shared boilerplate; quote the boilerplate sentence or the page's H1 line.",
      "pass otherwise.",
    ].join("\n"),
  },
  {
    id: "hub-titles",
    version: 1,
    instructions: [
      "Handbook §2: a hub or category page title names the collection and a specific promise (what, where, for whom, or when) plus the brand.",
      "Each page's text is the title, meta description and H1 of one hub page (a page that lists a collection of detail pages).",
      "fail when a hub title is a bare label ('Events | Brand', 'Blog', 'Our Services - Brand', 'Shop'); quote the title line exactly as given.",
      "pass when every hub title names the collection with a specific promise.",
    ].join("\n"),
  },
  {
    id: "local-pages",
    version: 2,
    instructions: [
      "Handbook §9, §24: one page per real service and per real location, each with distinct content. Pages that differ only by the swapped place or service name (doorway pages) are a defect, and so is one page listing all services with no page per real service.",
      "The pages given are candidates: either pages whose titles differ only by one or two words, with sharedSentenceRatio (share of their sentences found on another candidate), or a services/locations page with its text and a note that no page exists below it.",
      "fail when location/service pages differ only by the swapped name, or all services sit on one page with no page per real service; quote the repeated sentence or the title/heading lines that show it.",
      "pass when the candidates have distinct, specific content (similar titles alone are fine), or the single page covers one real service only.",
    ].join("\n"),
  },
  {
    id: "fallback-freshness",
    version: 1,
    instructions: [
      "Handbook §14: the server HTML of an API-driven page (shown before or without JavaScript data) must be either a dated snapshot ('as of <date>', 'updated <date>') or neutral copy.",
      "Each page's text is the visible text of the server HTML of a page whose browser version loads data from the site's own API.",
      "fail when that HTML presents prices, availability, dates, counts or an empty state ('No events found', '0 results', 'Sold out') as current without a timestamp; quote it.",
      "Loading spinners and 'Loading…' strings are handled by another check: ignore them. pass otherwise.",
    ].join("\n"),
  },
  {
    id: "source-check",
    version: 1,
    instructions: [
      "Handbook §0 EP-1, §6: every citation, study, survey, quotation, testimonial attributed to a third party, award and external statistic is backed by a working link to the page that states it. First-party facts about the business itself (its own prices, event counts, years in business, services) do not need an outside source.",
      "Each page's text lists claim sentences from that page; under each, 'source:' gives the off-site link cited in the sentence and its HTTP status, or 'none cited'. The cited pages were not fetched: do not guess what they say.",
      "fail when a claim that needs an outside source has 'none cited', or its link status is an error (4xx, 5xx, unreachable); quote the claim sentence exactly as given (without the '- ' prefix).",
      "pass when every claim that needs an outside source has a working link, or no claim needs one.",
    ].join("\n"),
  },
];

export const RUBRICS: ReadonlyMap<string, Rubric> = new Map(
  list.map((r) => [r.id, r]),
);

/**
 * SUPP-18 verdict prompt (SCALED-COPY §3.3, ADR-024). Not a K5 pass/fail
 * rubric: its own caller (`createSerpJudge`) returns the element list. It
 * judges presence only, never truth, writing quality or who wrote the page.
 */
export const SERP_ORIGINALITY_RUBRIC: Rubric = {
  id: "serp-originality",
  version: 1,
  instructions: [
    "Handbook §6, §33: a page should offer at least one original element that the pages already ranking for its query lack.",
    "Input: the audited page (url, title, H1, its profile and main text) and profiles of the top search results for the page's query (topic, stats, prices, names, awards, section headings, key facts).",
    "An original element is one of: first-party data (the business's own numbers, counts, results, prices or measurements), a test (something the business tried or measured itself), a case (a specific client, project or job described with its details), an expert quote (a named person quoted), a worked example (a concrete calculation or step-by-step example with real figures).",
    "hasOriginalElement is true when the audited page contains at least one such element that none of the competitor profiles contains. Generic explanations, definitions, lists of benefits and advice that the competitors also cover are not original elements.",
    "For each element give its type and a quote copied character for character from the audited page's text (one sentence or less). List at most 5 elements. When hasOriginalElement is false, elements is empty.",
    "Judge only whether such an element is present. Do not judge whether a claim is true, how well the page is written, or who or what wrote it.",
    "confidence is 0 to 1.",
  ].join("\n"),
};
