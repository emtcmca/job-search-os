CREATE TABLE IF NOT EXISTS `freelance_positioning_profiles` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `source_profile_id` integer,
  `is_default` integer DEFAULT false NOT NULL,
  `services_json` text DEFAULT '[]' NOT NULL,
  `pricing_json` text DEFAULT '{}' NOT NULL,
  `voice_json` text DEFAULT '{}' NOT NULL,
  `proof_points_json` text DEFAULT '[]' NOT NULL,
  `banned_claims_json` text DEFAULT '[]' NOT NULL,
  `platform_preferences_json` text DEFAULT '{}' NOT NULL,
  `notes` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`source_profile_id`) REFERENCES `candidate_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `freelance_niches` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `profile_id` integer,
  `legacy_source_id` text,
  `slug` text NOT NULL,
  `title` text NOT NULL,
  `demand` text DEFAULT 'Medium' NOT NULL,
  `rationale` text NOT NULL,
  `platforms_json` text DEFAULT '[]' NOT NULL,
  `buyer` text,
  `edge` text,
  `status` text DEFAULT 'candidate' NOT NULL,
  `notes` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`profile_id`) REFERENCES `freelance_positioning_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `freelance_service_listings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `niche_id` integer,
  `profile_id` integer,
  `legacy_source_id` text,
  `platform` text NOT NULL,
  `format` text DEFAULT 'generic' NOT NULL,
  `title` text NOT NULL,
  `content_json` text DEFAULT '{}' NOT NULL,
  `performance_json` text DEFAULT '{}' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `notes` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`niche_id`) REFERENCES `freelance_niches`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`profile_id`) REFERENCES `freelance_positioning_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `freelance_listing_versions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `listing_id` integer NOT NULL,
  `content_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`listing_id`) REFERENCES `freelance_service_listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `freelance_generated_drafts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `job_id` integer,
  `profile_id` integer,
  `platform` text NOT NULL,
  `draft_type` text DEFAULT 'proposal' NOT NULL,
  `tone` text DEFAULT 'balanced' NOT NULL,
  `prompt_json` text DEFAULT '{}' NOT NULL,
  `fit_json` text DEFAULT '{}' NOT NULL,
  `content_text` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`profile_id`) REFERENCES `freelance_positioning_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `freelance_social_posts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `profile_id` integer,
  `legacy_source_id` text,
  `niche` text NOT NULL,
  `topic` text NOT NULL,
  `angle` text,
  `format` text DEFAULT 'short' NOT NULL,
  `hook_style` text DEFAULT 'boldclaim' NOT NULL,
  `tone` text DEFAULT 'howto' NOT NULL,
  `content_text` text NOT NULL,
  `notes` text,
  `performance_json` text DEFAULT '{}' NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`profile_id`) REFERENCES `freelance_positioning_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
