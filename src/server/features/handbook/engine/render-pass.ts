import type {
  CollectedData,
  Collector,
  CollectorContext,
  CollectorKey,
} from "@/server/features/handbook/contracts/collectors";
import { withMediaSizes } from "../collectors/media-sizes";
import { crawlSecondPass } from "../collectors/site-crawl";
import type { RunInput } from "./runner";
import { collectStage, type StageName } from "./stages";

/**
 * One stage's collectors. After `render`, links found only in the rendered
 * DOM get a second crawl pass and those pages are rendered too (ADR-021);
 * the stage then also re-emits `pages` and `jsonld`, which override the
 * crawl stage's output when stages merge in order. Media sizes (HEAD) are
 * added last.
 */
export async function collectRunStage(
  input: RunInput,
  ctx: CollectorContext,
  stage: StageName,
  prior: Partial<CollectedData>,
): Promise<Partial<CollectedData>> {
  const produced = await collectStage(input.collectors, ctx, stage, prior);
  if (stage !== "render") return produced;
  const out = {
    ...produced,
    ...(await renderDiscoveredPass(input, ctx, { ...prior, ...produced })),
  };
  // Media sizes once every rendered page is in (HEAD only, FULL-READ §3.12).
  if (out.render?.status === "ok")
    out.render = {
      status: "ok",
      ...(await withMediaSizes(ctx, out.render)),
    };
  return out;
}

const isRenderCollector = (
  c: Collector<CollectorKey>,
): c is Collector<"render"> => c.key === "render";

async function renderDiscoveredPass(
  input: RunInput,
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
): Promise<Partial<CollectedData>> {
  const { render, pages, jsonld } = collected;
  if (render?.status !== "ok" || pages?.status !== "ok") return {};
  const links = render.pages.flatMap((p) => p.js.renderOnlyLinks ?? []);
  if (links.length === 0) return {};
  const pass = await crawlSecondPass(ctx, collected, links, input.maxPages);
  ctx.log("handbook.crawl.render_pass", {
    links: new Set(links).size,
    read: pass.snapshots.length,
  });
  const out: Partial<CollectedData> = {
    pages: {
      ...pages,
      snapshots: [...pages.snapshots, ...pass.snapshots],
      coverage: pass.coverage,
    },
  };
  if (jsonld?.status === "ok")
    out.jsonld = { ...jsonld, pages: [...jsonld.pages, ...pass.jsonld] };
  const renderer = input.collectors.find(isRenderCollector);
  if (renderer && pass.snapshots.length > 0) {
    // Empty templates: `full` renders every new live page; `quick` (template
    // samples only) reads "no template samples" and renders nothing more.
    const more = await renderer.collect(ctx, {
      ...collected,
      pages: { status: "ok", snapshots: pass.snapshots },
      templates: { status: "ok", templates: [] },
    });
    if (more.status === "ok")
      out.render = { ...render, pages: [...render.pages, ...more.pages] };
  }
  return out;
}
