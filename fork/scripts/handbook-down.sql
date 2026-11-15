-- Handbook engine down migration (B5 R1): drops the 13 fork tables, children
-- first. Valid on SQLite and Postgres. Upstream tables are untouched. The
-- drizzle journal row for 0072 (SQLite) / 0050 (pg) is not removed: to
-- re-apply, run the migration's SQL directly (or delete that journal row).
DROP TABLE IF EXISTS handbook_finding_item;
DROP TABLE IF EXISTS handbook_finding_url;
DROP TABLE IF EXISTS handbook_evidence;
DROP TABLE IF EXISTS handbook_finding;
DROP TABLE IF EXISTS handbook_bot_fetch;
DROP TABLE IF EXISTS handbook_item_status;
DROP TABLE IF EXISTS handbook_llm_call;
DROP TABLE IF EXISTS handbook_page_snapshot;
DROP TABLE IF EXISTS handbook_template_sample;
DROP TABLE IF EXISTS handbook_template;
DROP TABLE IF EXISTS handbook_site_profile;
DROP TABLE IF EXISTS handbook_run;
DROP TABLE IF EXISTS handbook_project_setting;
