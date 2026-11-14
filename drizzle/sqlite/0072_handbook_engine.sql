CREATE TABLE `handbook_bot_fetch` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`url` text NOT NULL,
	`bot` text NOT NULL,
	`status` integer,
	`final_url` text,
	`bytes` integer,
	`words` integer,
	`body_sha256` text,
	`blocked_reason` text,
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handbook_bot_fetch_run_url_bot_idx` ON `handbook_bot_fetch` (`run_id`,`url`,`bot`);--> statement-breakpoint
CREATE TABLE `handbook_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`finding_id` text,
	`item_id` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`storage_key` text,
	`excerpt` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_size` integer DEFAULT 0 NOT NULL,
	`content_type` text,
	`captured_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`finding_id`) REFERENCES `handbook_finding`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `handbook_evidence_run_item_idx` ON `handbook_evidence` (`run_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `handbook_evidence_finding_idx` ON `handbook_evidence` (`finding_id`);--> statement-breakpoint
CREATE TABLE `handbook_finding_item` (
	`finding_id` text NOT NULL,
	`item_id` text NOT NULL,
	PRIMARY KEY(`finding_id`, `item_id`),
	FOREIGN KEY (`finding_id`) REFERENCES `handbook_finding`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbook_finding_url` (
	`finding_id` text NOT NULL,
	`url` text NOT NULL,
	PRIMARY KEY(`finding_id`, `url`),
	FOREIGN KEY (`finding_id`) REFERENCES `handbook_finding`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbook_finding` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`code` text NOT NULL,
	`phase` text NOT NULL,
	`section_ref` text,
	`severity` text NOT NULL,
	`severity_reason` text,
	`class` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`fix` text NOT NULL,
	`fixability` text NOT NULL,
	`limited_reason` text,
	`effort` text NOT NULL,
	`template_key` text,
	`source` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handbook_finding_run_code_idx` ON `handbook_finding` (`run_id`,`code`);--> statement-breakpoint
CREATE TABLE `handbook_item_status` (
	`run_id` text NOT NULL,
	`item_id` text NOT NULL,
	`status` text NOT NULL,
	`score` real,
	`note` text,
	`severity` text,
	PRIMARY KEY(`run_id`, `item_id`),
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbook_llm_call` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`item_id` text NOT NULL,
	`model` text NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`prompt_sha256` text NOT NULL,
	`verdict` text,
	`quotes_verified` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `handbook_llm_call_run_idx` ON `handbook_llm_call` (`run_id`);--> statement-breakpoint
CREATE TABLE `handbook_page_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`url` text NOT NULL,
	`final_url` text,
	`template_id` text,
	`status` integer,
	`content_type` text,
	`raw_key` text,
	`rendered_key` text,
	`nojs_key` text,
	`words_raw` integer,
	`words_rendered` integer,
	`fetched_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `handbook_template`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handbook_page_snapshot_run_url_idx` ON `handbook_page_snapshot` (`run_id`,`url`);--> statement-breakpoint
CREATE TABLE `handbook_project_setting` (
	`project_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`mode` text DEFAULT 'AUDIT' NOT NULL,
	`tier_override` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbook_run` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`audit_id` text,
	`origin` text NOT NULL,
	`handbook_version` text NOT NULL,
	`contracts_version` text NOT NULL,
	`mode` text NOT NULL,
	`tier` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`score_uncapped` real,
	`score_final` real,
	`cap_reason` text,
	`grade` text,
	`llm_cost_usd` real DEFAULT 0 NOT NULL,
	`error_code` text,
	`started_at` text DEFAULT (current_timestamp) NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `handbook_run_project_started_idx` ON `handbook_run` (`project_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `handbook_site_profile` (
	`run_id` text NOT NULL,
	`sp_code` text NOT NULL,
	`value` text NOT NULL,
	`evidence` text NOT NULL,
	`confidence` text NOT NULL,
	PRIMARY KEY(`run_id`, `sp_code`),
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbook_template_sample` (
	`template_id` text NOT NULL,
	`url` text NOT NULL,
	`rank` integer NOT NULL,
	`reason` text NOT NULL,
	PRIMARY KEY(`template_id`, `rank`),
	FOREIGN KEY (`template_id`) REFERENCES `handbook_template`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbook_template` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`template_key` text NOT NULL,
	`url_pattern` text NOT NULL,
	`skeleton_hash` text NOT NULL,
	`page_count` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handbook_template_run_key_idx` ON `handbook_template` (`run_id`,`template_key`);