import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { createResult } from "./support";

/**
 * RENDER first mobile screen (handbook §8, §14). P5-14: every rendered
 * template sample shows an action with a primary verb (or a tel:/mailto:
 * link) in the first mobile screen; which action is "primary" and whether it
 * is a labelled button is LLM work. P8-09: the Lighthouse LCP element is not
 * a consent/cookie banner; Consent Mode v2 needs owner/EU scope.
 */
const PRIMARY_VERB =
  /\b(book|buy|register|sign ?up|get started|contact|call|donate|tickets?|order|shop|quote|appointments?|schedule|reserve)\b/i;
/** Banner selectors and CMP vendors; bare "cookie" would hit bakeries. */
const CONSENT_SELECTOR =
  /consent|gdpr|cookie[-_ ]?(banner|notice|bar|law|policy|settings|preferences)|onetrust|cookiebot|didomi|usercentrics/i;
/** Banner wording; bare "consent" is ordinary page text (an SMS opt-in on /terms). */
const CONSENT_TEXT =
  /we use cookies|accept (all )?cookies|cookie (settings|preferences)/i;

/** The sidecar reports "selector · label"; each part has its own pattern. */
function isConsentBanner(lcpElement: string): boolean {
  const [selector = "", ...label] = lcpElement.split(" · ");
  return (
    CONSENT_SELECTOR.test(selector) || CONSENT_TEXT.test(label.join(" · "))
  );
}

export const firstScreenActionCheck: HandbookCheck = {
  id: "render.first-screen-action",
  itemIds: ["P5-14"],
  class: "RENDER",
  requires: ["render"],
  run(ctx) {
    const out = createResult(["P5-14"]);
    const { render } = ctx.collected;
    if (render.status !== "ok") return out.build();
    const pages = render.pages.filter((p) => p.js.status === 200);
    if (pages.length === 0) {
      out.na("P5-14", "no rendered 200 page");
      return out.build();
    }
    const ref = (p: (typeof pages)[number]) =>
      out.evidence(
        p.firstScreenKey ? "screenshot" : "renderedDom",
        p.url,
        `first mobile screen actions:\n${
          p.js.firstScreenActions
            .map((a) => `${a.tag} "${a.text}"${a.href ? ` → ${a.href}` : ""}`)
            .join("\n") || "(none)"
        }`,
        p.firstScreenKey ?? p.js.renderedKey,
      );
    const primary = (p: (typeof pages)[number]) =>
      p.js.firstScreenActions.some(
        (a) =>
          PRIMARY_VERB.test(a.text) || /^(tel|mailto):/i.test(a.href ?? ""),
      );
    const missing = pages.filter((p) => !primary(p));
    if (missing.length > 0)
      out.finding({
        itemIds: ["P5-14"],
        severity: "S3",
        title: "No primary action in the first mobile screen",
        detail: missing
          .map(
            (p) =>
              `${p.url} — ${p.js.firstScreenActions.length} actions, none with a primary verb (book, buy, call, contact, tickets…) or tel:/mailto:`,
          )
          .join("\n"),
        fix: "Put one labelled button for the main action (book, call, buy, get a quote) in the first screen at a 390×844 viewport on every template.",
        fixability: "FIXABLE",
        effort: "S",
        urls: missing.map((p) => p.url),
        evidenceRefs: missing.slice(0, 5).map(ref),
      });
    else
      out.pass(
        "P5-14",
        `${pages.length} template samples show a primary-verb action in the first mobile screen (button vs link and "primary" judgement pending LLM pass)`,
        pages.slice(0, 3).map(ref),
      );
    return out.build();
  },
};

export const consentLcpCheck: HandbookCheck = {
  id: "render.consent-lcp",
  itemIds: ["P8-09"],
  class: "RENDER",
  requires: ["lighthouse"],
  run(ctx) {
    const out = createResult(["P8-09"]);
    const { lighthouse } = ctx.collected;
    if (lighthouse.status !== "ok") return out.build();
    const measured = lighthouse.pages.filter((p) => p.lcpElement !== null);
    if (measured.length === 0) {
      out.na("P8-09", "Lighthouse reported no LCP element");
      return out.build();
    }
    const ref = (p: (typeof measured)[number]) =>
      out.evidence(
        "lighthouse",
        p.url,
        `Lighthouse ${p.formFactor} LCP element: ${p.lcpElement} (${p.lcpMs ?? "?"} ms, ${p.environment})`,
        p.storageKey,
      );
    const banner = measured.filter((p) => isConsentBanner(p.lcpElement ?? ""));
    if (banner.length > 0)
      out.finding({
        itemIds: ["P8-09"],
        severity: "S3",
        title: "Consent banner is the LCP element",
        detail: `${banner.map((p) => `${p.url} — LCP element ${p.lcpElement}`).join("\n")}\nConsent Mode v2 (EU traffic) needs owner/EU scope.`,
        fix: "Make the consent banner smaller than the hero (or render it after the hero) so the page content is the LCP element; load it without blocking rendering.",
        fixability: "FIXABLE",
        effort: "S",
        urls: banner.map((p) => p.url),
        evidenceRefs: banner.slice(0, 5).map(ref),
      });
    else
      out.pass(
        "P8-09",
        `${measured.length} Lighthouse runs: LCP element is not a consent banner (Consent Mode v2 needs owner/EU scope)`,
        measured.slice(0, 3).map(ref),
      );
    return out.build();
  },
};
