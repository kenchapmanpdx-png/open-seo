import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { a11yMarkupCheck } from "./a11y-markup";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";

function page(
  extra: Partial<Pick<PageSnapshot, "images">> & {
    buttons?: PageSnapshot["markup"]["buttons"];
  } = {},
): PageSnapshot {
  const s = snapshot("/a/");
  return {
    ...s,
    links: [
      {
        href: `${s.url}#main`,
        text: "Skip to content",
        rel: null,
        target: null,
        ariaLabel: null,
      },
      {
        href: `${ORIGIN}/`,
        text: "Home",
        rel: null,
        target: null,
        ariaLabel: null,
      },
    ],
    images: extra.images ?? [],
    markup: { ...s.markup, buttons: extra.buttons ?? [] },
  };
}

const image = (alt: string) => ({
  src: `${ORIGIN}/img/IMG_2041.jpg`,
  dataSrc: null,
  srcset: null,
  alt,
  width: "10",
  height: "10",
  loading: null,
  fetchpriority: null,
});

const run = (p: PageSnapshot) =>
  a11yMarkupCheck.run(context({ pages: { status: "ok", snapshots: [p] } }));

describe("a11y.markup", () => {
  it("passes with a skip link and named controls", async () => {
    expect(
      statusOf(
        await run(page({ images: [image("Runners at the start")] })),
        "P8-04",
      ),
    ).toBe("PASS");
  });

  it("opens on a filename alt", async () => {
    expect(
      statusOf(await run(page({ images: [image("IMG_2041.jpg")] })), "P8-04"),
    ).toBe("OPEN");
  });

  it("opens on an icon-only button", async () => {
    expect(
      statusOf(
        await run(page({ buttons: [{ text: "", ariaLabel: null }] })),
        "P8-04",
      ),
    ).toBe("OPEN");
  });
});
