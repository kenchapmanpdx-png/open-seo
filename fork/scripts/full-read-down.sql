-- Full-read down migration (B8 R2, ADR-018/019): reverses sqlite 0074 /
-- pg 0052. Valid on SQLite (≥ 3.35, DROP COLUMN) and Postgres. Upstream
-- tables are untouched. The drizzle journal row is not removed: to re-apply,
-- run the migration's SQL directly (or delete that journal row).
DROP TABLE IF EXISTS handbook_page_profile;
DROP TABLE IF EXISTS handbook_run_lease;
DROP TABLE IF EXISTS handbook_run_stage;
ALTER TABLE handbook_run DROP COLUMN depth;
ALTER TABLE handbook_run DROP COLUMN coverage_discovered;
ALTER TABLE handbook_run DROP COLUMN coverage_read;
ALTER TABLE handbook_run DROP COLUMN coverage_capped;
