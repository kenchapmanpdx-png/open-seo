import { Parser } from "htmlparser2";
import type { AiAddressedText } from "@/server/features/handbook/contracts/collectors";

/**
 * SUPP-19 raw-HTML scan (SCALED-COPY §3.4, ADR-022): text addressed to AI
 * assistants. Sources: text nodes, `alt` / `title` / `aria-label`, `<meta
 * content>`, HTML comments, JSON-LD string values. Hidden = comment,
 * attribute / meta / JSON-LD value, or text inside an element with `hidden`
 * or an inline `display:none`, `visibility:hidden`, `font-size:0` or
 * `opacity:0`. Text that JS removes after load is marked hidden by the
 * render collector (`renderRemovedAiTexts`). Pattern A applies anywhere,
 * Pattern B only in hidden locations. English patterns only; the check
 * decides by page language.
 */

/** Pattern A (any location), verbatim from SCALED-COPY §3.4. */
const PATTERN_A: readonly RegExp[] = [
  /ignore (all |any )?(previous|prior|above) instructions/i,
  /(if|when) you are an? (ai|llm|language model|assistant|chatbot)/i,
  /^(note|attention|instruction)s? (to|for) (ai|llm|ai assistants?|language models?|chatbots?)/i,
  /(ai|llm) (assistants?|agents?|models?)\s*[:,]\s*(always|never|please|you must|do not)/i,
];

/** Pattern B (hidden only): an addressee and a directive verb in one sentence. */
const ADDRESSEE =
  /\b(ai|llm|language model|assistant|chatbot|chatgpt|claude|gemini|copilot|perplexity)\b/i;
const DIRECTIVE =
  /\b(recommend|rank|cite|mention|prefer|always|never|do not|must)\b|\bdescribe\b.*\bas\b/i;

const MAX_TEXT = 200;
const MAX_ITEMS = 20;
/** `PageMarkup.text` cap (html-facts MAX_TEXT). */
const RENDERED_TEXT_CAP = 20_000;
const SKIP = new Set(["script", "style", "svg"]);
const LABEL_ATTRS = ["alt", "title", "aria-label"] as const;
/** Tags that end a text run (so a sentence never spans two blocks). */
const BLOCK =
  /^(p|div|li|ul|ol|dl|dt|dd|table|tr|td|th|section|article|main|header|footer|nav|aside|h[1-6]|blockquote|br|form|figure|figcaption)$/;
const HIDDEN_STYLE =
  /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|(?:font-size|opacity)\s*:\s*0(?:\.0*)?(?:px|em|rem|pt|%)?)\s*(?:!important\s*)?(?:;|$)/i;

const isHiddenElement = (attrs: Record<string, string>) =>
  "hidden" in attrs || HIDDEN_STYLE.test(attrs.style ?? "");

const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);

/** The sentence, or a ≤ 200-char window around the match. */
function clip(sentence: string, index: number): string {
  if (sentence.length <= MAX_TEXT) return sentence;
  const start = Math.max(0, Math.min(index - 40, sentence.length - MAX_TEXT));
  return sentence.slice(start, start + MAX_TEXT);
}

function match(
  sentence: string,
  hidden: boolean,
): { pattern: "A" | "B"; index: number } | null {
  for (const re of PATTERN_A) {
    const m = re.exec(sentence);
    if (m) return { pattern: "A", index: m.index };
  }
  if (!hidden) return null;
  const who = ADDRESSEE.exec(sentence);
  return who && DIRECTIVE.test(sentence)
    ? { pattern: "B", index: who.index }
    : null;
}

function jsonStrings(body: string): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  try {
    walk(JSON.parse(body));
  } catch {
    out.push(body);
  }
  return out;
}

/** Raw-HTML texts addressed to AI assistants, document order, ≤ 20 per page. */
export function scanAiAddressed(html: string): AiAddressedText[] {
  const out: AiAddressedText[] = [];
  const seen = new Set<string>();
  const scan = (
    text: string,
    location: AiAddressedText["location"],
    hidden: boolean,
  ) => {
    for (const sentence of sentences(text)) {
      const hit = match(sentence, hidden);
      if (!hit) continue;
      const clipped = clip(sentence, hit.index);
      const key = `${location}|${hidden}|${clipped}`;
      if (seen.has(key) || out.length >= MAX_ITEMS) continue;
      seen.add(key);
      out.push({ location, hidden, pattern: hit.pattern, text: clipped });
    }
  };

  // Open elements: hidden flag (inherited) and skip flag per element.
  const stack: Array<{ hidden: boolean; skip: boolean; jsonLd: boolean }> = [];
  const top = () => stack[stack.length - 1];
  let run = "";
  let runHidden = false;
  let script = "";
  const flush = () => {
    if (run.trim()) scan(run, "text", runHidden);
    run = "";
  };

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (BLOCK.test(name)) flush();
        const parent = top();
        const hidden = (parent?.hidden ?? false) || isHiddenElement(attrs);
        const jsonLd = name === "script" && /ld\+json/i.test(attrs.type ?? "");
        stack.push({
          hidden,
          skip: (parent?.skip ?? false) || SKIP.has(name),
          jsonLd,
        });
        if (jsonLd) script = "";
        if (name === "meta" && attrs.content) scan(attrs.content, "meta", true);
        for (const attr of LABEL_ATTRS)
          if (attrs[attr]) scan(attrs[attr], "attribute", true);
      },
      ontext(text) {
        const el = top();
        if (el?.jsonLd) {
          script += text;
          return;
        }
        if (el?.skip) return;
        const hidden = el?.hidden ?? false;
        if (hidden !== runHidden) {
          flush();
          runHidden = hidden;
        }
        run += text;
      },
      onclosetag(name) {
        const el = stack.pop();
        if (el?.jsonLd)
          for (const value of jsonStrings(script)) scan(value, "jsonld", true);
        if (BLOCK.test(name)) flush();
      },
      oncomment(text) {
        scan(text, "comment", true);
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  flush();
  return out;
}

/**
 * Visible `text` items absent from the rendered visible text: JavaScript
 * removed them, so readers never see them (hidden, SCALED-COPY §3.4).
 */
export function renderRemovedAiTexts(
  items: readonly AiAddressedText[] | undefined,
  renderedText: string,
): string[] {
  // `markup.text` stops at 20 000 chars: past that, absence proves nothing.
  if (renderedText.length >= RENDERED_TEXT_CAP) return [];
  const rendered = renderedText.replace(/\s+/g, " ").toLowerCase();
  return (items ?? [])
    .filter((i) => i.location === "text" && !i.hidden)
    .map((i) => i.text)
    .filter((t) => !rendered.includes(t.toLowerCase()));
}
