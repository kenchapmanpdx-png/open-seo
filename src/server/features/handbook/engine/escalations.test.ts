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
    noJs: { status: 200, nojsKey: "n", words: 100 },
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
});
