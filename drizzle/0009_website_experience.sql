CREATE TABLE `website_experience_batches` (
	`session_id` text NOT NULL,
	`seq` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`events` text NOT NULL,
	`event_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `seq`),
	FOREIGN KEY (`session_id`) REFERENCES `website_experience_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `website_experience_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`page` text NOT NULL,
	`layout` text NOT NULL,
	`consent_version` text NOT NULL,
	`consent_at` integer NOT NULL,
	`started_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`viewport_width` integer NOT NULL,
	`viewport_height` integer NOT NULL,
	`document_height` integer NOT NULL,
	`device` text NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`visible_ms` integer DEFAULT 0 NOT NULL,
	`max_scroll` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`next_seq` integer DEFAULT 0 NOT NULL,
	`last_t` integer DEFAULT 0 NOT NULL,
	`last_visible` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "website_experience_page_check" CHECK("website_experience_sessions"."page"='/'),
	CONSTRAINT "website_experience_device_check" CHECK("website_experience_sessions"."device" IN ('mobile','tablet','desktop')),
	CONSTRAINT "website_experience_visibility_check" CHECK("website_experience_sessions"."last_visible" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `website_experience_sessions_expiry_idx` ON `website_experience_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `website_experience_sessions_started_device_idx` ON `website_experience_sessions` (`started_at`,`device`,`layout`);