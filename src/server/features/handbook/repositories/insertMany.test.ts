import { beforeEach, expect, it, vi } from "vitest";
import { executeInBatches } from "@/db/runBatch";
import { getDatabaseProvider } from "@/db/provider";
import { insertMany } from "./insertMany";

vi.mock("@/db/runBatch", () => ({ executeInBatches: vi.fn() }));
vi.mock("@/db/provider", () => ({ getDatabaseProvider: vi.fn() }));

beforeEach(() => {
  vi.mocked(getDatabaseProvider).mockReturnValue("d1");
});

// The contract is the chunk size: D1 binds at most 100 parameters per statement.
it("chunks rows so no statement binds more than 100 parameters on D1", async () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({ a: i, b: i, c: i }));
  await insertMany(rows, async () => {});
  const sizes = vi
    .mocked(executeInBatches)
    .mock.calls[0][0].map((c) => (Array.isArray(c) ? c.length : 0));
  expect(sizes).toEqual([33, 12]);
});

it("uses one statement for a whole result set on Postgres", async () => {
  vi.mocked(getDatabaseProvider).mockReturnValue("postgres");
  const rows = Array.from({ length: 500 }, (_, i) => ({ a: i, b: i }));
  await insertMany(rows, async () => {});
  const sizes = vi
    .mocked(executeInBatches)
    .mock.calls[0][0].map((c) => (Array.isArray(c) ? c.length : 0));
  expect(sizes).toEqual([500]);
});
