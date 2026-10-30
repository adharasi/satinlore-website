import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const waitlist = sqliteTable("waitlist", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  tokenHash: text("token_hash").notNull().unique(),
  previousTokenHash: text("previous_token_hash"),
  surveyTokenHash: text("survey_token_hash"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consentVersion: text("consent_version").notNull(),
  newsletter: integer("newsletter", { mode: "boolean" }).notNull().default(false),
  newsletterConsentAt: integer("newsletter_consent_at"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  confirmationHash: text("confirmation_hash").unique(),
  confirmationExpiresAt: integer("confirmation_expires_at"),
  confirmationSentAt: integer("confirmation_sent_at"),
  confirmedAt: integer("confirmed_at"),
  welcomeSentAt: integer("welcome_sent_at"),
  emailState: text("email_state").notNull().default("pending"),
  founderAlertState: text("founder_alert_state").notNull().default("pending"),
  founderNotifiedAt: integer("founder_notified_at"),
  founderAlertAttemptAt: integer("founder_alert_attempt_at"),
  source: text("source").notNull().default("direct"),
  model: text("model"),
  phone: text("phone"),
  interest: text("interest"),
});
export const crmContacts = sqliteTable("crm_contacts", {
  email: text("email").primaryKey(),
  stage: text("stage").notNull().default("new"),
  notes: text("notes").notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const contactRequests = sqliteTable("contact_requests", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const surveyEmailJobs = sqliteTable("survey_email_jobs", {
  email: text("email").primaryKey(),
  waitlistId: text("waitlist_id").notNull(),
  dueAt: integer("due_at").notNull(),
  state: text("state").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  attemptAt: integer("attempt_at"),
  nextAttemptAt: integer("next_attempt_at").notNull(),
  sentAt: integer("sent_at"),
  createdAt: integer("created_at").notNull(),
});
export const questionnaireResponses = sqliteTable("questionnaire_responses", {
  email: text("email").primaryKey(),
  responseId: text("response_id").notNull().unique(),
  submittedAt: integer("submitted_at").notNull(),
  receivedAt: integer("received_at").notNull(),
  schemaVersion: text("schema_version").notNull(),
  answersJson: text("answers_json").notNull(),
  sensitiveConsent: integer("sensitive_consent", {mode:"boolean"}).notNull().default(false),
  contactConsent: integer("contact_consent", {mode:"boolean"}).notNull().default(false),
  marketingConsent: integer("marketing_consent", {mode:"boolean"}).notNull().default(false),
  prizeDraw: integer("prize_draw", {mode:"boolean"}).notNull().default(false),
  expiresAt: integer("expires_at").notNull(),
});

export const emailSuppressions = sqliteTable("email_suppressions", {
  emailHash: text("email_hash").notNull(),
  purpose: text("purpose").notNull(),
  suppressedAt: integer("suppressed_at").notNull(),
}, table => [primaryKey({columns:[table.emailHash,table.purpose]})]);
