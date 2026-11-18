CREATE TABLE `handbook_page_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text,
	`url` text NOT NULL,
	`text_sha256` text NOT NULL,
	`prompt_version` text NOT NULL,
	`model` text NOT NULL,
	`scope` text NOT NULL,
	`template_key` text,
	`page_type` text NOT NULL,
	`profile_json` text NOT NULL,
	`dropped_quotes` integer DEFAULT 0 NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`last_used_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handbook_page_profile_key_idx` ON `handbook_page_profile` (`project_id`,`url`,`text_sha256`,`prompt_version`,`model`);--> statement-breakpoint
CREATE INDEX `handbook_page_profile_run_idx` ON `handbook_page_profile` (`run_id`);--> statement-breakpoint
CREATE TABLE `handbook_run_lease` (
	`key` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`renewed_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `handbook_run_stage` (
	`run_id` text NOT NULL,
	`stage` text NOT NULL,
	`batch` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`items_total` integer DEFAULT 0 NOT NULL,
	`items_done` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` text,
	`finished_at` text,
	PRIMARY KEY(`run_id`, `stage`, `batch`),
	FOREIGN KEY (`run_id`) REFERENCES `handbook_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `handbook_run` ADD `depth` text DEFAULT 'quick' NOT NULL;--> statement-breakpoint
ALTER TABLE `handbook_run` ADD `coverage_discovered` integer;--> statement-breakpoint
ALTER TABLE `handbook_run` ADD `coverage_read` integer;--> statement-breakpoint
ALTER TABLE `handbook_run` ADD `coverage_capped` integer DEFAULT false NOT NULL;