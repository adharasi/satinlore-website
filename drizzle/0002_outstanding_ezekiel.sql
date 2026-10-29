ALTER TABLE `waitlist` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `confirmation_hash` text;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `confirmation_expires_at` integer;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `confirmation_sent_at` integer;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `welcome_sent_at` integer;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `email_state` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_confirmation_hash_unique` ON `waitlist` (`confirmation_hash`);