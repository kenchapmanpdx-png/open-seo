CREATE TABLE "agency_brand" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"agency_name" text NOT NULL,
	"logo_path" text,
	"accent_color" text,
	"contact_line" text,
	"footer_text" text,
	"hide_openseo_credit" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_client" (
	"project_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_name" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"report_cadence" text DEFAULT 'none' NOT NULL,
	"notes" text,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_source_category" (
	"source_id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"page_type" text NOT NULL,
	"categories_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_traffic_class" (
	"event_id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"rule_id" text,
	"operator" text,
	"product" text,
	"purpose" text,
	"verification" text,
	"evidence_type" text,
	"rules_version" text NOT NULL,
	"classified_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_traffic_daily" (
	"site_id" text NOT NULL,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"rule_id" text DEFAULT '' NOT NULL,
	"verification" text DEFAULT '' NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"distinct_paths" integer DEFAULT 0 NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "ai_traffic_daily_site_id_day_kind_rule_id_verification_pk" PRIMARY KEY("site_id","day","kind","rule_id","verification")
);
--> statement-breakpoint
CREATE TABLE "ai_traffic_discard" (
	"vercel_project_id" text NOT NULL,
	"hour" text NOT NULL,
	"site_id" text,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_traffic_discard_vercel_project_id_hour_pk" PRIMARY KEY("vercel_project_id","hour")
);
--> statement-breakpoint
CREATE TABLE "ai_traffic_event" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"event_id" text NOT NULL,
	"observed_at" text NOT NULL,
	"method" text NOT NULL,
	"host" text NOT NULL,
	"path" text NOT NULL,
	"query_string" text,
	"status" integer,
	"user_agent" text,
	"remote_ip" text,
	"referer" text,
	"source_type" text DEFAULT 'vercel-drain' NOT NULL,
	"received_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_traffic_site_host" (
	"site_id" text NOT NULL,
	"host" text NOT NULL,
	CONSTRAINT "ai_traffic_site_host_site_id_host_pk" PRIMARY KEY("site_id","host")
);
--> statement-breakpoint
CREATE TABLE "ai_traffic_site" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"vercel_project_id" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_web_query" (
	"id" text PRIMARY KEY NOT NULL,
	"answer_id" text NOT NULL,
	"position" integer NOT NULL,
	"query" text NOT NULL,
	"normalized" text NOT NULL,
	"is_fanout" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bing_ai_citation_day" (
	"site_id" text NOT NULL,
	"day" text NOT NULL,
	"citations" integer NOT NULL,
	"cited_pages" integer,
	CONSTRAINT "bing_ai_citation_day_site_id_day_pk" PRIMARY KEY("site_id","day")
);
--> statement-breakpoint
CREATE TABLE "bing_ai_grounding_query" (
	"site_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"query" text NOT NULL,
	"citations" integer NOT NULL,
	CONSTRAINT "bing_ai_grounding_query_pk" PRIMARY KEY("site_id","period_start","period_end","query")
);
--> statement-breakpoint
CREATE TABLE "bing_ai_import" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"imported_by" text NOT NULL,
	"file_hash" text NOT NULL,
	"evidence_path" text NOT NULL,
	"rows_read" integer NOT NULL,
	"rows_upserted" integer NOT NULL,
	"imported_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bing_crawl_issue" (
	"site_id" text NOT NULL,
	"url" text NOT NULL,
	"issue_type" text NOT NULL,
	"http_code" integer,
	"first_seen" text NOT NULL,
	"last_seen" text NOT NULL,
	CONSTRAINT "bing_crawl_issue_site_id_url_issue_type_pk" PRIMARY KEY("site_id","url","issue_type")
);
--> statement-breakpoint
CREATE TABLE "bing_credential" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bing_daily_traffic" (
	"site_id" text NOT NULL,
	"day" text NOT NULL,
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	CONSTRAINT "bing_daily_traffic_site_id_day_pk" PRIMARY KEY("site_id","day")
);
--> statement-breakpoint
CREATE TABLE "bing_page_week" (
	"site_id" text NOT NULL,
	"week_start" text NOT NULL,
	"page" text NOT NULL,
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	"avg_impression_position" real,
	"avg_click_position" real,
	CONSTRAINT "bing_page_week_site_id_week_start_page_pk" PRIMARY KEY("site_id","week_start","page")
);
--> statement-breakpoint
CREATE TABLE "bing_query_week" (
	"site_id" text NOT NULL,
	"week_start" text NOT NULL,
	"query" text NOT NULL,
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	"avg_impression_position" real,
	"avg_click_position" real,
	CONSTRAINT "bing_query_week_site_id_week_start_query_pk" PRIMARY KEY("site_id","week_start","query")
);
--> statement-breakpoint
CREATE TABLE "bing_site" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"site_url" text NOT NULL,
	"verified" boolean NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bing_sync_state" (
	"site_id" text PRIMARY KEY NOT NULL,
	"last_success_at" text,
	"last_error" text,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "byok_ai_answer" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"prompt_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"model_version" text,
	"web_search" boolean NOT NULL,
	"status" text NOT NULL,
	"answer_markdown" text,
	"raw_output_path" text,
	"error" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"search_calls" integer,
	"cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"collected_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "byok_ai_credential" (
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "byok_ai_credential_organization_id_provider_pk" PRIMARY KEY("organization_id","provider")
);
--> statement-breakpoint
CREATE TABLE "byok_ai_match" (
	"id" text PRIMARY KEY NOT NULL,
	"answer_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"own" boolean NOT NULL,
	"mentioned" boolean NOT NULL,
	"cited" boolean NOT NULL,
	"first_mention" integer
);
--> statement-breakpoint
CREATE TABLE "byok_ai_run" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"tracker_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"started_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"finished_at" text
);
--> statement-breakpoint
CREATE TABLE "byok_ai_schedule" (
	"tracker_id" text PRIMARY KEY NOT NULL,
	"interval_days" integer NOT NULL,
	"next_run_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "byok_ai_source" (
	"id" text PRIMARY KEY NOT NULL,
	"answer_id" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"title" text,
	"position" integer NOT NULL,
	"category" text NOT NULL,
	"page_type" text NOT NULL,
	"categories_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "byok_ai_tracker_provider" (
	"tracker_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	CONSTRAINT "byok_ai_tracker_provider_tracker_id_provider_pk" PRIMARY KEY("tracker_id","provider")
);
--> statement-breakpoint
CREATE TABLE "cc_backlink_domain" (
	"id" text PRIMARY KEY NOT NULL,
	"summary_id" text NOT NULL,
	"linking_domain" text NOT NULL,
	"num_hosts" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cc_backlink_summary" (
	"id" text PRIMARY KEY NOT NULL,
	"target_id" text NOT NULL,
	"release_id" text NOT NULL,
	"referring_domains" integer NOT NULL,
	"referring_hosts_sum" integer NOT NULL,
	"imported_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cc_release" (
	"id" text PRIMARY KEY NOT NULL,
	"window_label" text NOT NULL,
	"status" text NOT NULL,
	"imported_at" text,
	"bytes" bigint
);
--> statement-breakpoint
CREATE TABLE "cc_target" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"domain" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_batch_class" (
	"batch_id" text NOT NULL,
	"item_id" text NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "outcome_batch_class_batch_id_item_id_url_pk" PRIMARY KEY("batch_id","item_id","url")
);
--> statement-breakpoint
CREATE TABLE "outcome_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"baseline_run_id" text NOT NULL,
	"fixed_at" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_check" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"offset_weeks" integer NOT NULL,
	"due_at" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"result_run_id" text,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "outcome_metric" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"item_id" text NOT NULL,
	"url" text NOT NULL,
	"metric" text NOT NULL,
	"before_value" text,
	"after_value" text,
	"source" text NOT NULL,
	"evidence_path" text
);
--> statement-breakpoint
ALTER TABLE "agency_client" ADD CONSTRAINT "agency_client_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_category" ADD CONSTRAINT "ai_source_category_source_id_ai_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ai_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_traffic_class" ADD CONSTRAINT "ai_traffic_class_event_id_ai_traffic_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ai_traffic_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_traffic_daily" ADD CONSTRAINT "ai_traffic_daily_site_id_ai_traffic_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."ai_traffic_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_traffic_discard" ADD CONSTRAINT "ai_traffic_discard_site_id_ai_traffic_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."ai_traffic_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_traffic_event" ADD CONSTRAINT "ai_traffic_event_site_id_ai_traffic_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."ai_traffic_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_traffic_site_host" ADD CONSTRAINT "ai_traffic_site_host_site_id_ai_traffic_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."ai_traffic_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_traffic_site" ADD CONSTRAINT "ai_traffic_site_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_web_query" ADD CONSTRAINT "ai_web_query_answer_id_byok_ai_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."byok_ai_answer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_ai_citation_day" ADD CONSTRAINT "bing_ai_citation_day_site_id_bing_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."bing_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_ai_grounding_query" ADD CONSTRAINT "bing_ai_grounding_query_site_id_bing_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."bing_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_ai_import" ADD CONSTRAINT "bing_ai_import_site_id_bing_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."bing_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_crawl_issue" ADD CONSTRAINT "bing_crawl_issue_site_id_bing_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."bing_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_daily_traffic" ADD CONSTRAINT "bing_daily_traffic_site_id_bing_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."bing_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_page_week" ADD CONSTRAINT "bing_page_week_site_id_bing_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."bing_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_query_week" ADD CONSTRAINT "bing_query_week_site_id_bing_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."bing_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_site" ADD CONSTRAINT "bing_site_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bing_sync_state" ADD CONSTRAINT "bing_sync_state_site_id_bing_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."bing_site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_ai_answer" ADD CONSTRAINT "byok_ai_answer_run_id_byok_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."byok_ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_ai_answer" ADD CONSTRAINT "byok_ai_answer_prompt_id_ai_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_ai_match" ADD CONSTRAINT "byok_ai_match_answer_id_byok_ai_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."byok_ai_answer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_ai_run" ADD CONSTRAINT "byok_ai_run_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_ai_run" ADD CONSTRAINT "byok_ai_run_tracker_id_ai_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."ai_trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_ai_schedule" ADD CONSTRAINT "byok_ai_schedule_tracker_id_ai_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."ai_trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_ai_source" ADD CONSTRAINT "byok_ai_source_answer_id_byok_ai_answer_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."byok_ai_answer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "byok_ai_tracker_provider" ADD CONSTRAINT "byok_ai_tracker_provider_tracker_id_ai_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."ai_trackers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cc_backlink_domain" ADD CONSTRAINT "cc_backlink_domain_summary_id_cc_backlink_summary_id_fk" FOREIGN KEY ("summary_id") REFERENCES "public"."cc_backlink_summary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cc_backlink_summary" ADD CONSTRAINT "cc_backlink_summary_target_id_cc_target_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."cc_target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cc_backlink_summary" ADD CONSTRAINT "cc_backlink_summary_release_id_cc_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."cc_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cc_target" ADD CONSTRAINT "cc_target_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_batch_class" ADD CONSTRAINT "outcome_batch_class_batch_id_outcome_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."outcome_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_batch" ADD CONSTRAINT "outcome_batch_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_batch" ADD CONSTRAINT "outcome_batch_baseline_run_id_handbook_run_id_fk" FOREIGN KEY ("baseline_run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_check" ADD CONSTRAINT "outcome_check_batch_id_outcome_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."outcome_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_check" ADD CONSTRAINT "outcome_check_result_run_id_handbook_run_id_fk" FOREIGN KEY ("result_run_id") REFERENCES "public"."handbook_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_metric" ADD CONSTRAINT "outcome_metric_check_id_outcome_check_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."outcome_check"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_traffic_class_kind_idx" ON "ai_traffic_class" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_traffic_event_site_event_idx" ON "ai_traffic_event" USING btree ("site_id","event_id");--> statement-breakpoint
CREATE INDEX "ai_traffic_event_site_observed_idx" ON "ai_traffic_event" USING btree ("site_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_traffic_site_vercel_project_idx" ON "ai_traffic_site" USING btree ("vercel_project_id");--> statement-breakpoint
CREATE INDEX "ai_traffic_site_project_idx" ON "ai_traffic_site" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_web_query_answer_position_idx" ON "ai_web_query" USING btree ("answer_id","position");--> statement-breakpoint
CREATE INDEX "ai_web_query_normalized_idx" ON "ai_web_query" USING btree ("normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "bing_ai_import_site_hash_idx" ON "bing_ai_import" USING btree ("site_id","file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "bing_site_project_url_idx" ON "bing_site" USING btree ("project_id","site_url");--> statement-breakpoint
CREATE UNIQUE INDEX "byok_ai_answer_run_prompt_provider_idx" ON "byok_ai_answer" USING btree ("run_id","prompt_id","provider");--> statement-breakpoint
CREATE INDEX "byok_ai_answer_prompt_idx" ON "byok_ai_answer" USING btree ("prompt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "byok_ai_match_answer_domain_idx" ON "byok_ai_match" USING btree ("answer_id","domain");--> statement-breakpoint
CREATE INDEX "byok_ai_run_tracker_started_idx" ON "byok_ai_run" USING btree ("tracker_id","started_at");--> statement-breakpoint
CREATE INDEX "byok_ai_schedule_next_run_idx" ON "byok_ai_schedule" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "byok_ai_source_answer_idx" ON "byok_ai_source" USING btree ("answer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cc_backlink_domain_summary_domain_idx" ON "cc_backlink_domain" USING btree ("summary_id","linking_domain");--> statement-breakpoint
CREATE INDEX "cc_backlink_domain_summary_hosts_idx" ON "cc_backlink_domain" USING btree ("summary_id","num_hosts");--> statement-breakpoint
CREATE UNIQUE INDEX "cc_backlink_summary_target_release_idx" ON "cc_backlink_summary" USING btree ("target_id","release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cc_target_project_domain_idx" ON "cc_target" USING btree ("project_id","domain");--> statement-breakpoint
CREATE INDEX "outcome_batch_project_fixed_idx" ON "outcome_batch" USING btree ("project_id","fixed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outcome_check_batch_offset_idx" ON "outcome_check" USING btree ("batch_id","offset_weeks");--> statement-breakpoint
CREATE INDEX "outcome_check_status_due_idx" ON "outcome_check" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outcome_metric_check_item_url_metric_idx" ON "outcome_metric" USING btree ("check_id","item_id","url","metric");