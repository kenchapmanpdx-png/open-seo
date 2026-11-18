CREATE TABLE "handbook_page_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"run_id" text,
	"url" text NOT NULL,
	"text_sha256" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"scope" text NOT NULL,
	"template_key" text,
	"page_type" text NOT NULL,
	"profile_json" text NOT NULL,
	"dropped_quotes" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"last_used_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handbook_run_lease" (
	"key" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"expires_at" text NOT NULL,
	"renewed_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handbook_run_stage" (
	"run_id" text NOT NULL,
	"stage" text NOT NULL,
	"batch" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"items_total" integer DEFAULT 0 NOT NULL,
	"items_done" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" text,
	"finished_at" text,
	CONSTRAINT "handbook_run_stage_run_id_stage_batch_pk" PRIMARY KEY("run_id","stage","batch")
);
--> statement-breakpoint
ALTER TABLE "handbook_run" ADD COLUMN "depth" text DEFAULT 'quick' NOT NULL;--> statement-breakpoint
ALTER TABLE "handbook_run" ADD COLUMN "coverage_discovered" integer;--> statement-breakpoint
ALTER TABLE "handbook_run" ADD COLUMN "coverage_read" integer;--> statement-breakpoint
ALTER TABLE "handbook_run" ADD COLUMN "coverage_capped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "handbook_page_profile" ADD CONSTRAINT "handbook_page_profile_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_page_profile" ADD CONSTRAINT "handbook_page_profile_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_run_lease" ADD CONSTRAINT "handbook_run_lease_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handbook_run_stage" ADD CONSTRAINT "handbook_run_stage_run_id_handbook_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."handbook_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "handbook_page_profile_key_idx" ON "handbook_page_profile" USING btree ("project_id","url","text_sha256","prompt_version","model");--> statement-breakpoint
CREATE INDEX "handbook_page_profile_run_idx" ON "handbook_page_profile" USING btree ("run_id");