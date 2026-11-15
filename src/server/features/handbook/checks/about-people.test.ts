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

describe("crawl.about-people", () => {
  it("passes P5-17 when About has a Person with jobTitle and authors link to it", async () => {
    expect(statusOf(await run(person["@id"]), "P5-17")).toBe("PASS");
  });

  it("opens P5-17 when an Article author @id is dangling", async () => {
    expect(statusOf(await run(`${ORIGIN}/#ghost`), "P5-17")).toBe("OPEN");
  });
});
