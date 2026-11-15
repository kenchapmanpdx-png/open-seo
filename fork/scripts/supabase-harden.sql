-- Supabase hardening (ADR-009). Run after every migration (run-local.sh migrate).
-- The app connects as the database owner over the session pooler, so RLS without
-- policies blocks only the PostgREST roles (anon, authenticated). Idempotent.

do $$
declare r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname in ('public', 'drizzle')
  loop
    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'drizzle') then
    execute 'revoke all on schema drizzle from anon, authenticated';
    execute 'revoke all on all tables in schema drizzle from anon, authenticated';
  end if;
end $$;

-- AI traffic receiver role (ADR-013, B5 R4a). NOLOGIN here: no password in the
-- repo. The receiver WO (B6) enables login with a generated password written
-- straight into the receiver project's Vercel env, never into a file.
-- Least privilege: resolve the site, insert events, upsert hourly discards.
-- SELECT on ai_traffic_discard is required by INSERT … ON CONFLICT DO UPDATE.
-- Events: the receiver must write `ON CONFLICT DO NOTHING` with NO conflict
-- target (a target needs SELECT on its columns); the unique index on
-- (site_id, event_id) still makes drain retries idempotent.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'traffic_ingest') then
    create role traffic_ingest nologin;
  end if;
end $$;

do $$
begin
  if to_regclass('public.ai_traffic_event') is null then
    return; -- fork integrations migration not applied yet
  end if;
  execute 'grant usage on schema public to traffic_ingest';
  execute 'revoke all on all tables in schema public from traffic_ingest';
  execute 'grant select on public.ai_traffic_site, public.ai_traffic_site_host to traffic_ingest';
  execute 'grant insert on public.ai_traffic_event to traffic_ingest';
  execute 'grant select, insert, update on public.ai_traffic_discard to traffic_ingest';

  execute 'drop policy if exists traffic_ingest_read on public.ai_traffic_site';
  execute 'create policy traffic_ingest_read on public.ai_traffic_site for select to traffic_ingest using (true)';
  execute 'drop policy if exists traffic_ingest_read on public.ai_traffic_site_host';
  execute 'create policy traffic_ingest_read on public.ai_traffic_site_host for select to traffic_ingest using (true)';
  execute 'drop policy if exists traffic_ingest_insert on public.ai_traffic_event';
  execute 'create policy traffic_ingest_insert on public.ai_traffic_event for insert to traffic_ingest with check (true)';
  execute 'drop policy if exists traffic_ingest_all on public.ai_traffic_discard';
  execute 'create policy traffic_ingest_all on public.ai_traffic_discard for all to traffic_ingest using (true) with check (true)';
end $$;
