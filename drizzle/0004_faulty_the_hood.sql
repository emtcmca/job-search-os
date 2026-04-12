ALTER TABLE `platform_connections` ADD `connection_mode` text DEFAULT 'launch' NOT NULL;--> statement-breakpoint
ALTER TABLE `platform_connections` ADD `debug_port` integer;