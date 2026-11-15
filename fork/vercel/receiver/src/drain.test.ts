import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DiscardRow, DrainDb, DrainSite } from "./db";
import { handleDrain } from "./drain";

const SECRET = "drain-test-secret";

function fixture(name: string): unknown[] {
  const parsed: unknown = JSON.parse(
    readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), "utf8"),
  );
  return Array.isArray(parsed) ? parsed : [];
}

function fakeDb(sites: Record<string, DrainSite> = {}) {
  const events: Array<{ siteId: string; eventId: string; path: string }> = [];
  const discards: DiscardRow[] = [];
  const db: DrainDb = {
    findSite: async (id) => sites[id] ?? null,
    insertEvents: async (siteId, rows) => {
      for (const row of rows)
        events.push({ siteId, eventId: row.eventId, path: row.path });
    },
    addDiscards: async (rows) => {
      discards.push(...rows);
    },
  };
  return { db, events, discards };
}

function post(entries: unknown[], signature?: string) {
  const body = JSON.stringify(entries);
  return new Request("https://receiver.test/api/drain", {
    method: "POST",
    body,
    headers: {
      "x-vercel-signature":
        signature ?? createHmac("sha1", SECRET).update(body).digest("hex"),
    },
  });
}

const SITE = { prj_site: { id: "site-1", hosts: [] } };

describe("handleDrain", () => {
  it("rejects a bad signature before touching the database", async () => {
    const { db, events, discards } = fakeDb(SITE);
    const response = await handleDrain(post(fixture("ai-bot"), "00"), {
      secret: SECRET,
      db,
    });
    expect(response.status).toBe(403);
    expect(events).toEqual([]);
    expect(discards).toEqual([]);
  });

  it("keeps AI bots and AI referrals, counts humans, drops build lines", async () => {
    const { db, events, discards } = fakeDb(SITE);
    const entries = [
      ...fixture("ai-bot"),
      ...fixture("ai-referral"),
      ...fixture("human"),
      ...fixture("build-line"),
    ];
    const response = await handleDrain(post(entries), { secret: SECRET, db });
    expect(response.status).toBe(200);
    expect(events).toEqual([
      { siteId: "site-1", eventId: "req_1", path: "/pricing" },
      { siteId: "site-1", eventId: "req_2", path: "/blog/post" },
    ]);
    expect(discards).toEqual([
      {
        vercelProjectId: "prj_site",
        hour: "2025-11-15T00",
        siteId: "site-1",
        count: 1,
      },
    ]);
  });

  it("counts every request of an unknown project as a discard with no site", async () => {
    const { db, events, discards } = fakeDb();
    await handleDrain(post([...fixture("ai-bot"), ...fixture("human")]), {
      secret: SECRET,
      db,
    });
    expect(events).toEqual([]);
    expect(discards).toEqual([
      expect.objectContaining({ siteId: null, count: 2 }),
    ]);
  });
});
