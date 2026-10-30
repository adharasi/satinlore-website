import { emailCanSend } from "./email-readiness";
import { sendSurveyInvitation, type EmailSettings } from "./email-sender";

export const SURVEY_DELAY_MS = 5 * 60_000;
const CLAIM_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;
const RETRY_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 24 * 3_600_000];

type SurveyJob = { email: string; waitlist_id: string; created_at: number; attempts: number; attempt_at: number };

async function sha256(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}

/** Reconstruct the private link at send time: D1 never stores a raw credential. */
export async function surveyManageToken(secret: string, waitlistId: string, createdAt: number): Promise<string> {
  if (secret.length < 16 || !waitlistId || !Number.isSafeInteger(createdAt)) throw new Error("Survey email link configuration is unavailable");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`satinlore:survey-manage:v1:${waitlistId}:${createdAt}`));
  return Array.from(new Uint8Array(signed), b => b.toString(16).padStart(2, "0")).join("");
}

/** Cron makes durable progress without relying on a browser visit or keeping a request asleep. */
export async function processSurveyEmailJobs(db: D1Database, settings: EmailSettings, options: { enabled: boolean; tokenSecret: string }) {
  const summary = { sent: 0, failed: 0, skipped: 0, disabled: false };
  if (!options.enabled || options.tokenSecret.length < 16 || !await emailCanSend(settings)) return { ...summary, disabled: true };
  const now = Date.now();
  // Leaving, expiry and blocking cancel delivery; a form response cannot grant verification.
  await db.prepare(`UPDATE survey_email_jobs SET state='cancelled' WHERE state IN ('pending','failed','sending')
    AND (NOT EXISTS (SELECT 1 FROM waitlist w WHERE w.id=survey_email_jobs.waitlist_id AND w.email=survey_email_jobs.email AND w.email_verified=1 AND w.expires_at>?)
    OR EXISTS (SELECT 1 FROM crm_contacts c WHERE c.email=survey_email_jobs.email AND c.stage='blocked'))`).bind(now).run();
  const due = await db.prepare(`SELECT email FROM survey_email_jobs WHERE due_at<=? AND next_attempt_at<=? AND attempts<?
    AND (state IN ('pending','failed') OR (state='sending' AND attempt_at<?)) ORDER BY due_at LIMIT 10`)
    .bind(now, now, MAX_ATTEMPTS, now - CLAIM_MS).all<{ email: string }>();
  for (const candidate of due.results) {
    const claimedAt = Date.now();
    // The primary key and conditional update prevent concurrent ticks and duplicate signups from sending twice.
    const job = await db.prepare(`UPDATE survey_email_jobs SET state='sending', attempts=attempts+1, attempt_at=?
      WHERE email=? AND due_at<=? AND next_attempt_at<=? AND attempts<?
      AND (state IN ('pending','failed') OR (state='sending' AND attempt_at<?))
      AND EXISTS (SELECT 1 FROM waitlist w WHERE w.id=survey_email_jobs.waitlist_id AND w.email=survey_email_jobs.email AND w.email_verified=1 AND w.expires_at>?)
      AND NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.email=survey_email_jobs.email AND c.stage='blocked')
      RETURNING email,waitlist_id,created_at,attempts,attempt_at`)
      .bind(claimedAt, candidate.email, claimedAt, claimedAt, MAX_ATTEMPTS, claimedAt - CLAIM_MS, claimedAt).first<SurveyJob>();
    if (!job) { summary.skipped++; continue; }
    try {
      const token = await surveyManageToken(options.tokenSecret, job.waitlist_id, job.created_at);
      const tokenHash = await sha256(token);
      // A separate hash preserves both the immediate post-confirmation link and original email link.
      const live = await db.prepare(`UPDATE waitlist SET survey_token_hash=? WHERE id=? AND email=? AND email_verified=1 AND expires_at>?
        AND NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.email=waitlist.email AND c.stage='blocked')
        AND EXISTS (SELECT 1 FROM survey_email_jobs j WHERE j.email=waitlist.email AND j.waitlist_id=waitlist.id AND j.state='sending' AND j.attempt_at=?) RETURNING id`)
        .bind(tokenHash, job.waitlist_id, job.email, Date.now(), claimedAt).first();
      if (!live) {
        await db.prepare("UPDATE survey_email_jobs SET state='cancelled' WHERE email=? AND state='sending' AND attempt_at=?").bind(job.email, claimedAt).run();
        summary.skipped++; continue;
      }
      await sendSurveyInvitation(settings, { email: job.email, manageToken: token });
      await db.prepare("UPDATE survey_email_jobs SET state='sent',sent_at=? WHERE email=? AND state='sending' AND attempt_at=?")
        .bind(Date.now(), job.email, claimedAt).run();
      summary.sent++;
    } catch {
      // An ambiguous network failure after SES acceptance can cause a duplicate on retry.
      // The queue is best effort with bounded retries, not an exactly-once delivery guarantee.
      await db.prepare("UPDATE survey_email_jobs SET state='failed',next_attempt_at=? WHERE email=? AND state='sending' AND attempt_at=?")
        .bind(Date.now() + RETRY_MS[Math.min(job.attempts - 1, RETRY_MS.length - 1)], job.email, claimedAt).run();
      summary.failed++;
    }
  }
  return summary;
}
