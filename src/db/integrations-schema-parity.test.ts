import { sort } from "remeda";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import { getTableConfig as sqliteConfig } from "drizzle-orm/sqlite-core";
import { getTableConfig as pgConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as sqliteIntegrations from "./integrations.schema";
import * as pgIntegrations from "./pg/integrations.schema";

// Fork mirror of ./schema-parity.test.ts for the fork integration tables (ADR-013…017) (the
// upstream test enumerates its own modules). Shape = what repositories and the
// provider cast in ./integrations-tables.ts rely on.
type Config = ReturnType<typeof sqliteConfig> | ReturnType<typeof pgConfig>;

function shape(table: Table, config: Config) {
  const columns = Object.values(getTableColumns(table)).map((c) => ({
    name: c.name,
    notNull: c.notNull,
    dataType: String(c.dataType),
    hasDefault: c.hasDefault,
    enumValues: Array.isArray(c.enumValues) ? c.enumValues.map(String) : null,
    primary: c.primary,
  }));
  const pk = config.primaryKeys.map((p) => p.columns.map((c) => c.name));
  const unique = config.indexes
    .filter((i) => i.config.unique)
    .map((i) => i.config.name);
  const fks = config.foreignKeys.map((fk) => {
    const ref = fk.reference();
    return `${ref.columns.map((c) => c.name).join(",")}->${getTableName(ref.foreignTable)} ${fk.onDelete ?? "none"}`;
  });
  return { columns, pk, unique, fks };
}

function tables(mod: Record<string, unknown>) {
  return new Map(
    Object.values(mod)
      .filter((v): v is Table => is(v, Table))
      .map((t) => [getTableName(t), t]),
  );
}

const sqliteTables = tables(sqliteIntegrations);
const pgTables = tables(pgIntegrations);

describe("integrations schema parity", () => {
  it("defines the same tables on both backends", () => {
    expect(sort([...pgTables.keys()], (a, b) => a.localeCompare(b))).toEqual(
      sort([...sqliteTables.keys()], (a, b) => a.localeCompare(b)),
    );
  });

  for (const [name, table] of sqliteTables) {
    it(`table ${name} matches`, () => {
      const pg = pgTables.get(name);
      if (!pg) throw new Error(`missing pg table ${name}`);
      expect(shape(pg, pgConfig(pg))).toEqual(
        shape(table, sqliteConfig(table)),
      );
    });
  }
});
