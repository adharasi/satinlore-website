CREATE TABLE `website_visual_batches` (
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`events` text NOT NULL,
	`event_count` integer NOT NULL,
	`byte_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `seq`),
	FOREIGN KEY (`session_id`) REFERENCES `website_experience_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `website_experience_sessions` ADD `visual_format` text;--> statement-breakpoint
ALTER TABLE `website_experience_sessions` ADD `visual_bytes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `website_experience_sessions` ADD `visual_event_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `website_experience_sessions` ADD `visual_next_seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `website_experience_sessions` ADD `visual_last_t` integer DEFAULT 0 NOT NULL;