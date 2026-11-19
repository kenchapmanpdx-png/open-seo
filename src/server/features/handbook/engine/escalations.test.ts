import { describe, expect, it } from "vitest";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";
import { escalationSchema } from "@/server/features/handbook/contracts/exports";
import {
  context,
  ORIGIN,
  snapshot,
} from "@/server/features/handbook/checks/check-test-fixtures";
import { collectEscalations } from "./escalations";

const href = (path: string) => new URL(path, ORIGIN).href;

function rendered(
  path: string,
  words: number,
  opacityZeroWords: number,
  noJsOpacityZeroWords?: number,
): RenderData["pages"][number] {
  return {
    url: href(path),
    js: {
      finalUrl: href(path),
      status: 200,
      renderedKey: "k",
      words,
      requests: [],
      opacityZeroWords,
      firstScreenActions: [],
    },
    noJs: {
      status: 200,
      nojsKey: "n",
      words: 100,
      ...(noJsOpacityZeroWords === undefined
        ? {}
        : { opacityZeroWords: noJsOpacityZeroWords }),
    },
    firstScreenKey: null,
    consoleErrors: [],
  };
}

const collected = (pages: RenderData["pages"]) =>
  context({
    pages: {
      status: "ok",
      snapshots: ["/fade/one", "/fade/two", "/fade/three"].map((p) =>
        snapshot(p),
      ),
    },
    templates: {
      status: "ok",
      templates: [
        {
          key: "/fade/*:abc",
          urlPattern: "/fade/*",
          skeletonHash: "abc",
          urls: ["/fade/one", "/fade/two", "/fade/three"].map(href),
          samples: [{ url: href("/fade/one"), rank: 1, reason: "first" }],
        },
      ],
    },
    render: { status: "ok", pages },
  }).collected;

describe("collectEscalations", () => {
  it("fires once per template when its rank-1 page hides text", () => {
    const escalations = collectEscalations(
      collected([
        rendered("/fade/one", 100, 5),
        rendered("/fade/two", 100, 60),
        rendered("/fade/three", 100, 70),
      ]),
    );
    expect(escalations).toHaveLength(1);
    const escalation = escalationSchema.parse(escalations[0]);
    expect(escalation.because).toContain("/fade/one has 5 words at opacity:0");
    expect(escalation).toMatchObject({
      trigger: "template-hidden-text",
      action: "JS-off render all pages of that template",
      urls: ["/fade/one", "/fade/two", "/fade/three"].map(href),
      capped: false,
    });
  });

  it("decides on the JS-off count when the render has one", () => {
    const hiddenOnlyAfterLoad = collected([rendered("/fade/one", 100, 5, 0)]);
    expect(collectEscalations(hiddenOnlyAfterLoad)).toEqual([]);
    const [escalation] = collectEscalations(
      collected([rendered("/fade/one", 100, 0, 40)]),
    );
    expect(escalation.because).toContain(
      "40 words at opacity:0 with JavaScript off",
    );
  });

  it("marks the escalation capped when some template pages were not rendered", () => {
    const [escalation] = collectEscalations(
      collected([rendered("/fade/one", 100, 5)]),
    );
    expect(escalation).toMatchObject({
      urls: [href("/fade/one")],
      capped: true,
    });
  });

  it("stores the render diff for the whole template on a word gap", () => {
    const escalations = collectEscalations(
      collected([
        rendered("/fade/one", 100, 0),
        rendered("/fade/two", 400, 0),
        rendered("/fade/three", 100, 0),
      ]),
    );
    expect(escalations.map((e) => [e.trigger, e.urls.length])).toEqual([
      ["render-word-gap", 3],
    ]);
  });

  it("reports Lighthouse escalations at full depth only", () => {
    const base = collected([
      rendered("/fade/one", 100, 0),
      rendered("/fade/two", 100, 0),
      {
        ...rendered("/fade/three", 100, 0),
        js: { ...rendered("/fade/three", 100, 0).js, pageWeightBytes: 6e6 },
      },
    ]);
    const data = {
      ...base,
      lighthouse: {
        status: "ok" as const,
        pages: [
          {
            url: href("/fade/one"),
            formFactor: "mobile" as const,
            environment: "e",
            performance: 0.3,
            lcpMs: 5200,
            cls: 0,
            tbtMs: 0,
            lcpElement: null,
            storageKey: null,
          },
        ],
      },
    };
    expect(collectEscalations(data, "quick")).toEqual([]);
    expect(
      collectEscalations(data, "full").map((e) => [e.trigger, e.urls]),
    ).toEqual([
      // /fade/three is a heaviest page, so already in the base set.
      ["template-slow-lcp", [href("/fade/two")]],
      ["page-weight-over-5mb", [href("/fade/three")]],
    ]);
  });

  it("reports the bot-parity escalation with its plain-HTTP probes and stopped UAs", () => {
    const fetch = (bot: "browser" | "ClaudeBot", status: number) => ({
      url: href("/fade/one"),
      bot,
      status,
      finalUrl: href("/fade/one"),
      bytes: 100,
      words: 50,
      bodySha256: "a",
      blockedReason: status === 403 ? "HTTP 403" : null,
    });
    const data = {
      ...collected([]),
      botFetch: {
        status: "ok" as const,
        fetches: [fetch("browser", 200), fetch("ClaudeBot", 403)],
      },
    };
    const escalation = collectEscalations(data).find(
      (e) => e.trigger === "bot-parity",
    );
    expect(escalation?.because).toContain("ClaudeBot got HTTP 403");
    expect(escalation?.urls).toEqual([
      ...["/fade/one", "/fade/two", "/fade/three"].map(href),
      "http://example.com/fade/one",
      "http://example.com/fade/two",
      "http://example.com/fade/three",
    ]);
    // No round-2 fetches recorded → every bot counts as stopped.
    expect(escalation?.capped).toBe(true);
  });
});
