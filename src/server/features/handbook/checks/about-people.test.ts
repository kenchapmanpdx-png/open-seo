import { describe, expect, it } from "vitest";
import { aboutPeopleCheck } from "./about-people";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";

const person = {
  "@type": "Person",
  "@id": `${ORIGIN}/about/#jane`,
  name: "Jane Doe",
  jobTitle: "Editor",
};

function run(authorId: string) {
  const about = snapshot("/about/");
  const post = snapshot("/blog/post/");
  const pages = [about, post].map((s) => ({
    ...s,
    markup: { ...s.markup, text: "Our team: Jane Doe, Editor." },
  }));
  return aboutPeopleCheck.run(
    context({
      pages: { status: "ok", snapshots: pages },
      jsonld: {
        status: "ok",
        pages: [
          {
            url: about.url,
            blocks: [
              { index: 0, raw: JSON.stringify(person), parseError: null },
            ],
            nodes: [
              { id: person["@id"], types: ["Person"], properties: person },
            ],
          },
          {
            url: post.url,
            blocks: [],
            nodes: [
              {
                id: null,
                types: ["Article"],
                properties: { author: { "@id": authorId } },
              },
            ],
          },
        ],
      },
    }),
  );
}

type Result = ReturnType<typeof aboutPeopleCheck.run>;
const noAbout = async (r: Result) =>
  (await r).findings.some((f) => f.title === "No About page found");
const cited = async (r: Result) => (await r).findings.flatMap((f) => f.urls);

describe("crawl.about-people", () => {
  it("passes P5-17 when About has a Person with jobTitle and authors link to it", async () => {
    expect(statusOf(await run(person["@id"]), "P5-17")).toBe("PASS");
  });

  it("opens P5-17 when an Article author @id is dangling", async () => {
    expect(statusOf(await run(`${ORIGIN}/#ghost`), "P5-17")).toBe("OPEN");
  });

  describe("finds the About page beyond an 'about' path (WO-B25-005)", () => {
    const crawl = (paths: string[], homeLinks: [string, string][] = []) => {
      const pages = paths.map((p) => snapshot(p));
      pages[0] = {
        ...pages[0],
        links: homeLinks.map(([href, text]) => ({
          href: new URL(href, ORIGIN).href,
          text,
          rel: null,
          target: null,
          ariaLabel: null,
        })),
      };
      return aboutPeopleCheck.run(
        context({
          pages: { status: "ok", snapshots: pages },
          jsonld: { status: "ok", pages: [] },
        }),
      );
    };

    it("takes /our-story/ linked as 'Our Story' (theogdenver.com)", async () => {
      const r = crawl(
        ["/", "/menus/", "/our-story/"],
        [["/our-story/", "Our Story"]],
      );
      expect(await noAbout(r)).toBe(false);
      expect(await cited(r)).toContain(`${ORIGIN}/our-story/`);
    });

    it("takes /our-team, never /team/<person> (samanthaco.ca)", async () => {
      const r = crawl(["/", "/team/samantha-eisen", "/our-team"]);
      expect(await noAbout(r)).toBe(false);
      expect(await cited(r)).toContain(`${ORIGIN}/our-team`);
      expect(await cited(r)).not.toContain(`${ORIGIN}/team/samantha-eisen`);
    });

    it("finds none on aircorheatingcooling.com or under /blog/", async () => {
      expect(
        await noAbout(
          crawl([
            "/",
            "/hvac-chicago/a-fresh-look-for-aircor-meet-our-refreshed-logo/",
            "/blog/my-story/",
            "/chicago-air-conditioning-furnace-savings",
          ]),
        ),
      ).toBe(true);
    });
  });
});
