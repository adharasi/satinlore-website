DROP INDEX `waitlist_email_unique`;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `newsletter_consent_at` integer;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `email_verified` integer DEFAULT false NOT NULL;