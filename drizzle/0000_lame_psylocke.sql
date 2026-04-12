CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`industry` text,
	`hq_location` text,
	`size_band` text,
	`trust_flags_json` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_budget_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`monthly_budget` real DEFAULT 25 NOT NULL,
	`warning_threshold` real DEFAULT 0.8 NOT NULL,
	`hard_limit_enabled` integer DEFAULT true NOT NULL,
	`never_auto_run_deep_analysis` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_usage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer,
	`snapshot_hash` text,
	`tier` text NOT NULL,
	`model` text,
	`estimated_cost` real,
	`actual_cost` real,
	`was_user_approved` integer DEFAULT false NOT NULL,
	`cache_hit` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `linear_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer,
	`application_id` integer,
	`linear_project_key` text NOT NULL,
	`linear_issue_id` text,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`last_synced_at` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `platform_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`browser_profile_name` text,
	`is_enabled` integer DEFAULT false NOT NULL,
	`last_verified_at` text
);
--> statement-breakpoint
CREATE TABLE `user_feedback_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer,
	`signal_type` text NOT NULL,
	`value` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `job_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`snapshot_hash` text NOT NULL,
	`raw_text` text,
	`raw_html_path` text,
	`parsed_json` text DEFAULT '{}' NOT NULL,
	`captured_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_type` text DEFAULT 'full_time' NOT NULL,
	`source` text NOT NULL,
	`source_job_id` text,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`company_id` integer,
	`location_text` text,
	`location_type` text,
	`employment_type` text,
	`salary_min` real,
	`salary_max` real,
	`currency` text DEFAULT 'USD',
	`is_rejected` integer DEFAULT false NOT NULL,
	`current_stage` text DEFAULT 'new' NOT NULL,
	`dedupe_key` text NOT NULL,
	`discovered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `candidate_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`profile_type` text NOT NULL,
	`source_doc_path` text,
	`content_json` text DEFAULT '{}' NOT NULL,
	`is_canonical` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `generated_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer,
	`document_type` text NOT NULL,
	`profile_id` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`file_path` text,
	`content_text` text,
	`provenance_json` text DEFAULT '{}' NOT NULL,
	`approval_state` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `candidate_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'full_time' NOT NULL,
	`keywords` text NOT NULL,
	`filters_json` text DEFAULT '{}' NOT NULL,
	`sources_json` text DEFAULT '[]' NOT NULL,
	`schedule_json` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_run_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `score_factors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`score_id` integer NOT NULL,
	`factor_key` text NOT NULL,
	`factor_label` text NOT NULL,
	`weight` real,
	`value` real,
	`explanation` text,
	FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`snapshot_id` integer,
	`tier` text DEFAULT 'tier_0' NOT NULL,
	`overall_score` real,
	`recommendation` text DEFAULT 'review' NOT NULL,
	`summary` text,
	`reasons_for_json` text DEFAULT '[]' NOT NULL,
	`reasons_against_json` text DEFAULT '[]' NOT NULL,
	`analyzed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snapshot_id`) REFERENCES `job_snapshots`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `application_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`platform` text,
	`status` text DEFAULT 'new' NOT NULL,
	`submitted_at` text,
	`resume_doc_id` integer,
	`cover_letter_doc_id` integer,
	`notes` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_doc_id`) REFERENCES `generated_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cover_letter_doc_id`) REFERENCES `generated_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer,
	`application_id` integer,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer,
	`application_id` integer,
	`title` text NOT NULL,
	`due_at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
