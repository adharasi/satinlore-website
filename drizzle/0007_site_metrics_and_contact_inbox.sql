CREATE TABLE `website_metrics` (
  `day` text NOT NULL,
  `event` text NOT NULL,
  `page` text NOT NULL,
  `source` text NOT NULL,
  `referrer` text NOT NULL,
  `device` text NOT NULL,
  `count` integer DEFAULT 0 NOT NULL,
  `last_seen` integer NOT NULL,
  PRIMARY KEY (`day`, `event`, `page`, `source`, `referrer`, `device`)
);
--> statement-breakpoint
CREATE INDEX `website_metrics_day_event_idx` ON `website_metrics` (`day`, `event`);
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `status` text DEFAULT 'new' NOT NULL;
--> statement-breakpoint
ALTER TABLE `contact_requests` ADD `updated_at` integer;
--> statement-breakpoint
CREATE INDEX `contact_requests_email_created_idx` ON `contact_requests` (`email`, `created_at`);
--> statement-breakpoint
CREATE INDEX `contact_requests_status_created_idx` ON `contact_requests` (`status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `contact_requests_expires_created_idx` ON `contact_requests` (`expires_at`, `created_at`);
