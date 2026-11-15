import postgres from "postgres";
import type { TrafficEvent } from "../../../../src/server/features/ai-traffic/contracts";

// The receiver's only database access, as the `traffic_ingest` role
// (ADR-013 §1): read site + hosts, insert events, upsert discard counters.

export type DrainSite = { id: string; hosts: string[] };
export type DiscardRow = {
  vercelProjectId: string;
  hour: string;
  siteId: string | null;
  count: number;
};

export interface DrainDb {
  findSite(vercelProjectId: string): Promise<DrainSite | null>;
  insertEvents(siteId: string, events: TrafficEvent[]): Promise<void>;
  addDiscards(rows: DiscardRow[]): Promise<void>;
}

export function createDrainDb(url: string): DrainDb {
  // Supabase transaction pooler: one connection, no prepared statements.
  const sql = postgres(url, { max: 1, prepare: false });
  return {
    async findSite(vercelProjectId) {
      const [site] = await sql<{ id: string }[]>`
        select id from ai_traffic_site where vercel_project_id = ${vercelProjectId}`;
      if (!site) return null;
      const hosts = await sql<{ host: string }[]>`
        select host from ai_traffic_site_host where site_id = ${site.id}`;
      return { id: site.id, hosts: hosts.map((row) => row.host) };
    },
    async insertEvents(siteId, events) {
      if (events.length === 0) return;
      const rows = events.map((event) => ({
        id: crypto.randomUUID(),
        site_id: siteId,
        event_id: event.eventId,
        observed_at: event.observedAt,
        method: event.method ?? "GET",
        host: event.host ?? "",
        path: event.path,
        query_string: event.queryString,
        status: event.status,
        user_agent: event.userAgent,
        remote_ip: event.remoteIp,
        referer: event.referer,
        source_type: event.sourceType,
      }));
      // No conflict target: a target needs SELECT, which traffic_ingest lacks;
      // the unique (site_id, event_id) index still makes retries idempotent.
      await sql`insert into ai_traffic_event ${sql(rows)} on conflict do nothing`;
    },
    async addDiscards(rows) {
      for (const row of rows) {
        await sql`
          insert into ai_traffic_discard (vercel_project_id, hour, site_id, count)
          values (${row.vercelProjectId}, ${row.hour}, ${row.siteId}, ${row.count})
          on conflict (vercel_project_id, hour)
          do update set count = ai_traffic_discard.count + excluded.count`;
      }
    },
  };
}
