ALTER TABLE `applications` ADD `follow_up_required` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `follow_up_instructions` text;
