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
