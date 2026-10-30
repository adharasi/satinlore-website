CREATE TABLE `questionnaire_responses` (
	`email` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`schema_version` text NOT NULL,
	`answers_json` text NOT NULL,
	`sensitive_consent` integer DEFAULT false NOT NULL,
	`contact_consent` integer DEFAULT false NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`prize_draw` integer DEFAULT false NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questionnaire_responses_response_id_unique` ON `questionnaire_responses` (`response_id`);--> statement-breakpoint
CREATE TABLE `survey_email_jobs` (
	`email` text PRIMARY KEY NOT NULL,
	`waitlist_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`attempt_at` integer,
	`next_attempt_at` integer NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `waitlist` ADD `survey_token_hash` text;--> statement-breakpoint
CREATE INDEX `survey_email_jobs_due_idx` ON `survey_email_jobs` (`state`,`next_attempt_at`,`due_at`);
--> statement-breakpoint
CREATE INDEX `waitlist_survey_token_hash_idx` ON `waitlist` (`survey_token_hash`);
--> statement-breakpoint
CREATE TRIGGER `queue_survey_after_verification`
AFTER UPDATE OF `email_verified` ON `waitlist`
WHEN OLD.email_verified = 0 AND NEW.email_verified = 1 AND NEW.confirmed_at IS NOT NULL
BEGIN
  INSERT INTO survey_email_jobs (email,waitlist_id,due_at,next_attempt_at,created_at)
  VALUES (NEW.email,NEW.id,NEW.confirmed_at+300000,NEW.confirmed_at+300000,NEW.confirmed_at)
  ON CONFLICT(email) DO NOTHING;
END;

--> statement-breakpoint
CREATE TABLE `email_suppressions` (
  `email_hash` text NOT NULL,
  `purpose` text NOT NULL,
  `suppressed_at` integer NOT NULL,
  PRIMARY KEY (`email_hash`, `purpose`)
);
