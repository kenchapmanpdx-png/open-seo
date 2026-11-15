-- Fork integrations down migration (B5 R4a; ADR-013…017): drops the 35 fork
-- tables, children first. Valid on SQLite and Postgres. Upstream tables are
-- untouched. The drizzle journal row for 0073 (SQLite) / 0051 (pg) is not
-- removed: to re-apply, run the migration's SQL directly (or delete that row).
DROP TABLE IF EXISTS outcome_metric;
DROP TABLE IF EXISTS outcome_check;
DROP TABLE IF EXISTS outcome_batch_class;
DROP TABLE IF EXISTS outcome_batch;
DROP TABLE IF EXISTS agency_brand;
DROP TABLE IF EXISTS agency_client;
DROP TABLE IF EXISTS cc_backlink_domain;
DROP TABLE IF EXISTS cc_backlink_summary;
DROP TABLE IF EXISTS cc_target;
DROP TABLE IF EXISTS cc_release;
DROP TABLE IF EXISTS ai_source_category;
DROP TABLE IF EXISTS ai_web_query;
DROP TABLE IF EXISTS byok_ai_match;
DROP TABLE IF EXISTS byok_ai_source;
DROP TABLE IF EXISTS byok_ai_answer;
DROP TABLE IF EXISTS byok_ai_run;
DROP TABLE IF EXISTS byok_ai_schedule;
DROP TABLE IF EXISTS byok_ai_tracker_provider;
DROP TABLE IF EXISTS byok_ai_credential;
DROP TABLE IF EXISTS bing_ai_grounding_query;
DROP TABLE IF EXISTS bing_ai_citation_day;
DROP TABLE IF EXISTS bing_ai_import;
DROP TABLE IF EXISTS bing_crawl_issue;
DROP TABLE IF EXISTS bing_page_week;
DROP TABLE IF EXISTS bing_query_week;
DROP TABLE IF EXISTS bing_daily_traffic;
DROP TABLE IF EXISTS bing_sync_state;
DROP TABLE IF EXISTS bing_site;
DROP TABLE IF EXISTS bing_credential;
DROP TABLE IF EXISTS ai_traffic_discard;
DROP TABLE IF EXISTS ai_traffic_daily;
DROP TABLE IF EXISTS ai_traffic_class;
DROP TABLE IF EXISTS ai_traffic_event;
DROP TABLE IF EXISTS ai_traffic_site_host;
DROP TABLE IF EXISTS ai_traffic_site;
