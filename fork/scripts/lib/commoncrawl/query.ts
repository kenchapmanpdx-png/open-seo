// Ported from Canonry/canonry@4b91e077 packages/integration-commoncrawl/src/duckdb-query.ts — MIT, © 2026 Arber X and contributors
// Licensed under the MIT License (https://opensource.org/licenses/MIT).
import { DuckDBInstance } from "@duckdb/node-api";
import { reverseDomain } from "../../../../src/server/features/backlinks/providers/commoncrawl/release";
import {
  ccBacklinkRowSchema,
  type CcBacklinkRow,
} from "../../../../src/server/features/backlinks/providers/commoncrawl/contracts";

/**
 * Inbound linking domains for every target in ONE pass over the release's
 * gzipped vertex/edge TSVs (`id\trev_domain\tnum_hosts`, `from_id\tto_id`),
 * capped per target, larger linking domains (`num_hosts`) first.
 */
export async function queryBacklinks(opts: {
  vertexPath: string;
  edgesPath: string;
  targets: string[];
  limitPerTarget?: number;
}): Promise<CcBacklinkRow[]> {
  if (opts.targets.length === 0) return [];
  const targetList = opts.targets
    .map((t) => quote(reverseDomain(t)))
    .join(", ");
  const limit = Math.floor(opts.limitPerTarget ?? 5000);

  const sql = `
    WITH vertices AS (
      SELECT * FROM read_csv(
        ${quote(opts.vertexPath)},
        delim='\t', header=false,
        columns={'id':'BIGINT','rev_domain':'VARCHAR','num_hosts':'BIGINT'}
      )
    ),
    targets AS (
      SELECT v.id AS target_id, v.rev_domain AS target_rev_domain
      FROM vertices v
      WHERE v.rev_domain IN (${targetList})
    ),
    inbound AS (
      SELECT e.from_id, e.to_id
      FROM read_csv(
        ${quote(opts.edgesPath)},
        delim='\t', header=false,
        columns={'from_id':'BIGINT','to_id':'BIGINT'}
      ) e
      WHERE e.to_id IN (SELECT target_id FROM targets)
    )
    SELECT
      t.target_rev_domain,
      v.rev_domain AS linking_rev_domain,
      v.num_hosts
    FROM inbound i
    JOIN targets t ON t.target_id = i.to_id
    JOIN vertices v ON v.id = i.from_id
    QUALIFY row_number() OVER (PARTITION BY t.target_rev_domain ORDER BY v.num_hosts DESC, v.rev_domain) <= ${limit}
    ORDER BY t.target_rev_domain, v.num_hosts DESC, v.rev_domain
  `;

  const instance = await DuckDBInstance.create(":memory:");
  const conn = await instance.connect();
  try {
    const reader = await conn.runAndReadAll(sql);
    return reader.getRowObjects().map((r) =>
      ccBacklinkRowSchema.parse({
        targetDomain: reverseDomain(String(r.target_rev_domain)),
        linkingDomain: reverseDomain(String(r.linking_rev_domain)),
        numHosts: Number(r.num_hosts),
      }),
    );
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}
