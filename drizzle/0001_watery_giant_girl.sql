ALTER TABLE `scores` ADD `recommended_resume_type` text;--> statement-breakpoint
ALTER TABLE `scores` ADD `deep_review_recommended` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `scores` ADD `deep_review_reason` text;