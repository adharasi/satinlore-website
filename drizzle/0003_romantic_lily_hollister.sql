CREATE TABLE `crm_contacts` (
	`email` text PRIMARY KEY NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `waitlist` ADD `founder_alert_state` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `founder_notified_at` integer;