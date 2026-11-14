CREATE TABLE "handbook_bot_fetch" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"url" text NOT NULL,
	"bot" text NOT NULL,
	"status" integer,
	"final_url" text,
	"bytes" integer,
	"words" integer,
	"body_sha256" text,
	"blocked_reason" text
);
--> statement-breakpoint
CREATE TABLE "handbook_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"finding_id" text,
	"item_id" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"excerpt" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"content_type" text,
	"captured_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handbook_finding_item" (
	"finding_id" text NOT NULL,
	"item_id" text NOT NULL,
	CONSTRAINT "handbook_finding_item_finding_id_item_id_pk" PRIMARY KEY("finding_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "handbook_finding_url" (
	"finding_id" text NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "handbook_finding_url_finding_id_url_pk" PRIMARY KEY("finding_id","url")
);
--> statement-breakpoint
CREATE TABLE "handbook_finding" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"code" text NOT NULL,
	"phase" text NOT NULL,
	"section_ref" text,
	"severity" text NOT NULL,
	"severity_reason" text,
	"class" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"fix" text NOT NULL,
	"fixability" text NOT NULL,
	"limited_reason" text,
	"effort" text NOT NULL,
	"template_key" text,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handbook_item_status" (
	"run_id" text NOT NULL,
	"item_id" text NOT NULL,
	"status" text NOT NULL,
	"score" real,
	"note" text,
	"severity" text,
	CONSTRAINT "handbook_item_status_run_id_item_id_pk" PRIMARY KEY("run_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "handbook_llm_call" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"item_id" text NOT NULL,
	"model" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"prompt_sha256" text NOT NULL,
	"verdict" text,
	"quotes_verified" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handbook_page_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"url" text NOT NULL,
	"final_url" text,
	"template_id" text,
	"status" integer,
	"content_type" text,
	"raw_key" text,
	"rendered_key" text,
	"nojs_key" text,
	"words_raw" integer,
	"words_rendered" integer,
	"fetched_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handbook_project_setting" (
	"project_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"mode" text DEFAULT 'AUDIT' NOT NULL,
	"tier_override" text,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handbook_run" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"audit_id" text,
	"origin" text NOT NULL,
	"handbook_version" text NOT NULL,
	"contracts_version" text NOT NULL,
	"mode" text NOT NULL,
	"tier" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"score_uncapped" real,
	"score_final" real,
	"cap_reason" text,
	"grade" text,
	"llm_cost_usd" real DEFAULT 0 NOT NULL,
	"error_code" text,
	"started_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"finished_at" text
);
--> statement-breakpoint
CREATE TABLE "handbook_site_profile" (
	"run_id" text NOT NULL,
	"sp_code" text NOT NULL,
	"value" text NOT NULL,
	"evidence" text NOT NULL,
	"confidence" text NOT NULL,
	CONSTRAINT "handbook_site_profile_run_id_sp_code_pk" PRIMARY KEY("run_id","sp_code")
);
--> statement-breakpoint
CREATE TABLE "handbook_template_sample" (
	"template_id" text NOT NULL,
	"url" text NOT NULL,
	"rank" integer NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "handbook_template_sample_template_id_rank_pk" PRIMARY KEY("template_id","rank")
);
--> statement-breakpoint
CREATE TABLE "handbook_template" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"template_key" text NOT NULL,
	"url_pattern" text NOT NULL,
	"skeleton_hash" text NOT NULL,
	"page_count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handbook_bot_fetch" ADD CONSTRAINT "handbook_bot_fetch_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_evidence" ADD CONSTRAINT "handbook_evidence_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_evidence" ADD CONSTRAINT "handbook_evidence_finding_id_handbook_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."handbook_finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_finding_item" ADD CONSTRAINT "handbook_finding_item_finding_id_handbook_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."handbook_finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_finding_url" ADD CONSTRAINT "handbook_finding_url_finding_id_handbook_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."handbook_finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_finding" ADD CONSTRAINT "handbook_finding_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_item_status" ADD CONSTRAINT "handbook_item_status_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_llm_call" ADD CONSTRAINT "handbook_llm_call_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_page_snapshot" ADD CONSTRAINT "handbook_page_snapshot_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_page_snapshot" ADD CONSTRAINT "handbook_page_snapshot_template_id_handbook_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."handbook_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_project_setting" ADD CONSTRAINT "handbook_project_setting_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_run" ADD CONSTRAINT "handbook_run_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_run" ADD CONSTRAINT "handbook_run_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_site_profile" ADD CONSTRAINT "handbook_site_profile_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_template_sample" ADD CONSTRAINT "handbook_template_sample_template_id_handbook_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."handbook_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_template" ADD CONSTRAINT "handbook_template_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_bot_fetch_run_url_bot_idx" ON "handbook_bot_fetch" USING btree ("run_id","url","bot");--> statement-breakpoint
CREATE INDEX "handbook_evidence_run_item_idx" ON "handbook_evidence" USING btree ("run_id","item_id");--> statement-breakpoint
CREATE INDEX "handbook_evidence_finding_idx" ON "handbook_evidence" USING btree ("finding_id");--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_finding_run_code_idx" ON "handbook_finding" USING btree ("run_id","code");--> statement-breakpoint
CREATE INDEX "handbook_llm_call_run_idx" ON "handbook_llm_call" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_page_snapshot_run_url_idx" ON "handbook_page_snapshot" USING btree ("run_id","url");--> statement-breakpoint
CREATE INDEX "handbook_run_project_started_idx" ON "handbook_run" USING btree ("project_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_template_run_key_idx" ON "handbook_template" USING btree ("run_id","template_key");