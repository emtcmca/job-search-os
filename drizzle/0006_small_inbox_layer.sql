CREATE TABLE `inbox_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text DEFAULT 'manual' NOT NULL,
	`monitored_address` text,
	`forwarding_address` text,
	`connection_status` text DEFAULT 'not_connected' NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`auto_create_reminders` integer DEFAULT true NOT NULL,
	`notify_on_employer_replies` integer DEFAULT true NOT NULL,
	`notes` text,
	`last_ingested_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE TABLE `inbox_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer,
	`job_id` integer,
	`source_provider` text DEFAULT 'manual' NOT NULL,
	`external_message_id` text,
	`sender_name` text,
	`sender_email` text NOT NULL,
	`subject` text NOT NULL,
	`snippet` text,
	`body_text` text,
	`received_at` text NOT NULL,
	`matched_status` text DEFAULT 'unmatched' NOT NULL,
	`processing_notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null
);
