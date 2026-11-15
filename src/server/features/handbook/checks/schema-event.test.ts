import { describe, expect, it } from "vitest";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { schemaEventCheck } from "./schema-event";

const full = {
  "@type": "Event",
  name: "Spring Run",
  startDate: "2026-04-12T09:00:00-07:00",
  eventStatus: "https://schema.org/EventScheduled",
  image: `${ORIGIN}/run.jpg`,
  organizer: { "@type": "Organization", name: "Run Club" },
  location: {
    "@type": "Place",
    name: "City Park",
    address: {
      streetAddress: "1 Park Rd",
      addressLocality: "Portland",
      postalCode: "97201",
      addressCountry: "US",
    },
    geo: { latitude: 45.5, longitude: -122.6 },
  },
  offers: {
    price: "25",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: `${ORIGIN}/register`,
  },
};

function run(event: Record<string, unknown>) {
  const page = snapshot("/events/spring-run/");
  return schemaEventCheck.run(
    context({
      pages: {
        status: "ok",
        snapshots: [
          { ...page, markup: { ...page.markup, text: "Starts 9:00 AM. $25." } },
        ],
      },
      jsonld: {
        status: "ok",
        pages: [
          {
            url: page.url,
            blocks: [],
            nodes: [{ id: null, types: ["Event"], properties: event }],
          },
        ],
      },
    }),
  );
}

describe("schema.event", () => {
  it("passes a full event", async () => {
    const result = await run(full);
    expect(statusOf(result, "P2-06")).toBe("PASS");
    expect(statusOf(result, "P6-05")).toBe("PASS");
  });

  it("opens P2-06 on a date-only startDate when the page shows a time", async () => {
    expect(
      statusOf(await run({ ...full, startDate: "2026-04-12" }), "P2-06"),
    ).toBe("OPEN");
  });

  it("opens P6-05 on a filler performer", async () => {
    const result = await run({ ...full, performer: { name: "TBA" } });
    expect(statusOf(result, "P6-05")).toBe("OPEN");
  });
});
