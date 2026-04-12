ALTER TABLE `inbox_connections` ADD COLUMN `provider_account_email` text;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `oauth_state_token` text;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `access_token` text;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `refresh_token` text;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `token_expires_at` text;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `sync_cursor` text;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `sync_query` text DEFAULT 'newer_than:30d' NOT NULL;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `last_sync_started_at` text;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `last_sync_completed_at` text;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `last_sync_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `inbox_connections` ADD COLUMN `last_sync_error` text;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD COLUMN `thread_id` text;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD COLUMN `message_type` text DEFAULT 'other' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `inbox_messages_provider_external_idx` ON `inbox_messages` (`source_provider`,`external_message_id`);
