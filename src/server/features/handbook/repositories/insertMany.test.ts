import { beforeEach, expect, it, vi } from "vitest";
import { executeInBatches } from "@/db/runBatch";
import { getDatabaseProvider } from "@/db/provider";
import { insertAll, insertMany, insertRows } from "./insertMany";

vi.mock("@/db/runBatch", () => ({ executeInBatches: vi.fn() }));
vi.mock("@/db/provider", () => ({ getDatabaseProvider: vi.fn() }));

let capture: number[] = [];
const record = async (_tx: unknown, chunk: unknown[]) => {
  capture.push(chunk.length);
};

beforeEach(() => {
  vi.mocked(getDatabaseProvider).mockReturnValue("d1");
  capture = [];
});

/** Chunk sizes the statements handed to `executeInBatches` insert. */
async function chunkSizes(): Promise<number[]> {
  const [statements, run] = vi.mocked(executeInBatches).mock.calls[0];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the test insert never touches the tx
  const tx = {} as Parameters<typeof run>[0];
  for (const statement of statements) await run(tx, statement);
  return capture;
}

// The contract is the chunk size: D1 binds at most 100 parameters per statement.
it("chunks rows so no statement binds more than 100 parameters on D1", async () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({ a: i, b: i, c: i }));
  await insertMany(rows, record);
  expect(await chunkSizes()).toEqual([33, 12]);
});

it("uses one statement for a whole result set on Postgres", async () => {
  vi.mocked(getDatabaseProvider).mockReturnValue("postgres");
  const rows = Array.from({ length: 500 }, (_, i) => ({ a: i, b: i }));
  await insertMany(rows, record);
  expect(await chunkSizes()).toEqual([500]);
});

// WO-B20-004: one save is one executeInBatches call (one Postgres transaction), not one per table.
it("writes several tables in one call, in order", async () => {
  vi.mocked(getDatabaseProvider).mockReturnValue("postgres");
  const saved = await insertAll([
    ...insertRows([{ a: 1 }], record),
    ...insertRows([{ b: 1 }, { b: 2 }], record),
  ]);
  expect(saved).toBe(3);
  expect(executeInBatches).toHaveBeenCalledTimes(1);
  expect(await chunkSizes()).toEqual([1, 2]);
});
