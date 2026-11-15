import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * Third-party tags and hero video (handbook §14, §15).
 * P7-04: analytics/pixel scripts in <head> load async/defer; pixel hosts are
 * not requested during the initial render (no interaction) when SP6 is Y/?
 * (handbook: "SP6 pixel review → apply as if Y") or the site shows EU
 * signals. Whether consent is legally required stays with the owner (§30).
 * Either way tags load after load/interaction (§14): a tag or pixel request
 * the sidecar saw start before the load event is a scheduling finding.
 * P7-01 (gate hero video): the first <video> has a poster; autoplay needs
 * muted and a pause control. Reduced-motion and per-device encodes → note.
 */
const ITEMS = ["P7-04", "P7-01"];

const TAG_HOST =
  /(^|\.)(googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|analytics\.tiktok\.com|snap\.licdn\.com|bat\.bing\.com|static\.hotjar\.com|clarity\.ms|plausible\.io)$/i;
const PIXEL_HOST =
  /(^|\.)(facebook\.(net|com)|tiktok\.com|licdn\.com|linkedin\.com|bat\.bing\.com|hotjar\.(com|io)|clarity\.ms)$/i;
const EU_LANG =
  /^(de|fr|es|it|nl|pl|pt|sv|da|fi|cs|sk|sl|hu|ro|bg|el|et|lv|lt|hr|ga|mt)\b/i;
const EU_TLD =
  /\.(eu|de|fr|es|it|nl|pl|pt|se|dk|fi|cz|sk|si|hu|ro|bg|gr|ee|lv|lt|hr|ie|mt|at|be|lu|cy)$/i;

const live = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  /html/i.test(s.contentType ?? "html");

function hostOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export const thirdPartyCheck: HandbookCheck = {
  id: "perf.third-party",
  itemIds: ITEMS,
  class: "PERF",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, render } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const pagesLive = pages.snapshots.filter(live);
    if (pagesLive.length === 0) {
      for (const id of ITEMS) out.na(id, "no 200 HTML page crawled");
      return out.build();
    }
    const ref = (s: PageSnapshot, excerpt: string) =>
      out.evidence("rawHtml", s.url, excerpt, s.rawKey);

    // P7-04 — tags in head without async/defer.
    const syncTags = pagesLive.flatMap((s) => {
      const tags = s.markup.scripts.filter(
        (x) => x.inHead && !x.async && !x.defer && TAG_HOST.test(hostOf(x.src)),
      );
      return tags.length > 0 ? [{ s, tags }] : [];
    });
    if (syncTags.length > 0)
      out.finding({
        itemIds: ["P7-04"],
        severity: "S3",
        title: "Analytics/pixel scripts block rendering in <head>",
        detail: syncTags
          .map(
            ({ s, tags }) => `${s.url} — ${tags.map((t) => t.src).join(", ")}`,
          )
          .join("\n"),
        fix: "Load tag managers and pixels with async/defer (or after load/interaction), and only after consent where it is required.",
        fixability: "FIXABLE",
        effort: "S",
        urls: syncTags.map(({ s }) => s.url),
        evidenceRefs: syncTags
          .slice(0, 5)
          .map(({ s, tags }) =>
            ref(
              s,
              tags
                .map((t) => `<script src="${t.src}"> in head, no async/defer`)
                .join("\n"),
            ),
          ),
      });

    // P7-04 — pixel requests during the initial render.
    const sp6 = ctx.siteProfile.find((a) => a.code === "SP6")?.value ?? "?";
    const home = pagesLive.find((s) => new URL(s.url).pathname === "/");
    const euSignal =
      EU_TLD.test(new URL(ctx.origin).hostname) ||
      EU_LANG.test(home?.head.lang ?? pagesLive[0].head.lang ?? "");
    const preConsentApplies = sp6 !== "N" || euSignal;
    const renderOk = render.status === "ok";
    const pixelPages = renderOk
      ? render.pages.flatMap((p) => {
          const hits = p.js.requests.filter((q) =>
            PIXEL_HOST.test(hostOf(q.url)),
          );
          return hits.length > 0 ? [{ p, hits }] : [];
        })
      : [];
    if (preConsentApplies && pixelPages.length > 0)
      out.finding({
        itemIds: ["P7-04"],
        severity: "S3",
        title: "Pixels fire before any interaction (pre-consent requests)",
        detail: `${pixelPages
          .map(
            ({ p, hits }) =>
              `${p.url} — ${[...new Set(hits.map((h) => hostOf(h.url)))].join(", ")}`,
          )
          .join(
            "\n",
          )}\nApplies because ${sp6 !== "N" ? `SP6 = ${sp6}` : "the site shows EU signals"}; whether consent is required is the owner's call (§30).`,
        fix: "Gate pixels behind consent (Consent Mode v2 where EU) and fire them after load or first interaction.",
        fixability: "FIXABLE",
        effort: "M",
        urls: pixelPages.map(({ p }) => p.url),
        evidenceRefs: pixelPages
          .slice(0, 5)
          .map(({ p, hits }) =>
            out.evidence(
              "renderedDom",
              p.url,
              hits.map((h) => `${h.resourceType} ${h.url}`).join("\n"),
              p.js.renderedKey,
            ),
          ),
      });

    // P7-04 — tags scheduled before the load event (consent aside).
    const preConsentFlagged = preConsentApplies && pixelPages.length > 0;
    const earlyPages = renderOk
      ? render.pages.flatMap((p) => {
          const hits = p.js.requests.filter(
            (q) =>
              q.beforeLoad === true &&
              (TAG_HOST.test(hostOf(q.url)) || PIXEL_HOST.test(hostOf(q.url))),
          );
          return hits.length > 0 ? [{ p, hits }] : [];
        })
      : [];
    if (!preConsentFlagged && earlyPages.length > 0)
      out.finding({
        itemIds: ["P7-04"],
        severity: "S4",
        severityReason: "scheduling only; tags are async",
        title: "Analytics/pixels load before the page finishes loading",
        detail: earlyPages
          .map(
            ({ p, hits }) =>
              `${p.url} — ${[...new Set(hits.map((h) => hostOf(h.url)))].join(", ")}`,
          )
          .join("\n"),
        fix: "Inject analytics and pixels after the load event or the first interaction, not from a deferred script during page load.",
        fixability: "FIXABLE",
        effort: "S",
        urls: earlyPages.map(({ p }) => p.url),
        evidenceRefs: earlyPages
          .slice(0, 5)
          .map(({ p, hits }) =>
            out.evidence(
              "renderedDom",
              p.url,
              hits
                .map((h) => `${h.resourceType} ${h.url} (before load)`)
                .join("\n"),
              p.js.renderedKey,
            ),
          ),
      });

    if (syncTags.length === 0 && !preConsentFlagged && earlyPages.length === 0)
      out.pass(
        "P7-04",
        [
          `${pagesLive.length} pages: no blocking tag scripts in <head>`,
          renderOk
            ? pixelPages.length === 0
              ? `${render.pages.length} rendered samples: no pixel request at load`
              : `pixel requests at load not flagged (SP6 = N, no EU signal)`
            : "pre-consent requests not verified (no render)",
          "third-party weight audit pending (B3)",
        ].join("; "),
        [ref(pagesLive[0], `${pagesLive[0].markup.scripts.length} scripts`)],
      );

    // P7-01 — hero video.
    const withVideo = pagesLive.filter((s) => s.markup.videos.length > 0);
    if (withVideo.length === 0) {
      out.na("P7-01", "no <video> on crawled pages");
      return out.build();
    }
    const videoProblems = withVideo.flatMap((s) => {
      const v = s.markup.videos[0];
      const why: string[] = [];
      if (!v.poster) why.push("no poster");
      if (v.autoplay && !v.muted) why.push("autoplay without muted");
      const pauseButton = s.markup.buttons.some((b) =>
        /pause/i.test(`${b.text} ${b.ariaLabel ?? ""}`),
      );
      if (v.autoplay && !v.controls && !pauseButton)
        why.push("autoplay without a pause control");
      return why.length > 0 ? [{ s, v, why }] : [];
    });
    if (videoProblems.length > 0)
      out.finding({
        itemIds: ["P7-01"],
        severity: "S3",
        title: "Hero video lacks a poster or pause control",
        detail: videoProblems
          .map(({ s, why }) => `${s.url} — ${why.join("; ")}`)
          .join("\n"),
        fix: "Give the hero <video> a poster image, keep autoplay muted with a visible pause button, honour prefers-reduced-motion, and serve size-capped encodes per device.",
        fixability: "FIXABLE",
        effort: "S",
        urls: videoProblems.map(({ s }) => s.url),
        evidenceRefs: videoProblems
          .slice(0, 5)
          .map(({ s, v, why }) =>
            ref(
              s,
              `${why.join("; ")}\n<video src="${v.src ?? ""}" poster="${v.poster ?? ""}"${v.autoplay ? " autoplay" : ""}${v.muted ? " muted" : ""}${v.controls ? " controls" : ""}>`,
            ),
          ),
      });
    else
      out.pass(
        "P7-01",
        `${withVideo.length} pages with video: poster set, autoplay muted with a pause control (reduced-motion and per-device encodes need render/owner review)`,
        withVideo
          .slice(0, 3)
          .map((s) => ref(s, `poster ${s.markup.videos[0].poster}`)),
      );
    return out.build();
  },
};
