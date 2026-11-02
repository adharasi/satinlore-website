/** Purge only expired records; survey and draw choices remain independent of leaving the waitlist. */
export async function purgeExpiredRecords(db: D1Database, now = Date.now()) {
  await db.batch([
    db.prepare("DELETE FROM waitlist WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM contact_requests WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM website_daily_uniques WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM website_metrics WHERE day < ?").bind(new Date(now - 89 * 86400000).toISOString().slice(0,10)),
    db.prepare("DELETE FROM questionnaire_responses WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM survey_email_jobs WHERE NOT EXISTS (SELECT 1 FROM waitlist w WHERE w.email=survey_email_jobs.email AND w.expires_at > ?)").bind(now),
    db.prepare("DELETE FROM crm_contacts WHERE NOT EXISTS (SELECT 1 FROM waitlist w WHERE w.email=crm_contacts.email AND w.expires_at > ?) AND NOT EXISTS (SELECT 1 FROM questionnaire_responses q WHERE q.email=crm_contacts.email AND q.expires_at > ?)").bind(now,now),
  ]);
  // Optional analytics must not block the existing email/CRM cleanup if its migration
  // is temporarily unavailable. Expired sessions are excluded from every read immediately.
  try {
    await db.prepare("DELETE FROM website_visual_batches WHERE session_id IN (SELECT id FROM website_experience_sessions WHERE expires_at<=?)").bind(now).run();
  } catch { /* A missing visual migration cannot block existing cleanup. */ }
  try {
    await db.batch([
      db.prepare("DELETE FROM website_experience_batches WHERE session_id IN (SELECT id FROM website_experience_sessions WHERE expires_at<=?)").bind(now),
      db.prepare("DELETE FROM website_experience_sessions WHERE expires_at<=?").bind(now),
    ]);
  } catch { /* The next cleanup tick retries; no private exception is logged. */ }
}
