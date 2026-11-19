-- Scaled-copy down migration (B11 R2, ADR-023): reverses sqlite 0075 /
-- pg 0053. Valid on SQLite (≥ 3.35, DROP COLUMN) and Postgres. The drizzle
-- journal row is not removed: to re-apply, run the migration's SQL directly
-- (or delete that journal row).
ALTER TABLE handbook_project_setting DROP COLUMN serp_originality;
ALTER TABLE handbook_project_setting DROP COLUMN copy_quality;
