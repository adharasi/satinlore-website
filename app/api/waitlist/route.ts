import { CONSENT_VERSION, sourceName, validEmail, validFirstName } from "@/lib/waitlist-validation";
import { cleanExpired, database, emailRateLimit, failed, hash, jsonBody, newToken, rateLimit, response } from "@/lib/waitlist-server";
import { sendConfirmation } from "@/lib/email-sender";
import { emailSettings } from "@/lib/email-settings";
import { domainCanReceiveMail } from "@/lib/email-domain";
import { emailCanSend } from "@/lib/email-readiness";
import { notifyFounder } from "@/lib/founder-alerts";
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (body.company) return response({ ok: true, state: "check_email" });
    const email = validEmail(body.email);
    const firstName = validFirstName(body.firstName);
    if (!email || !firstName || body.adult !== true || body.consent !== true || typeof body.newsletter !== "boolean") {
      return response({ error: "Add your first name and email. Then tick the two boxes to join." }, 400);
    }
    await cleanExpired();
    if (!await rateLimit(request)) return response({ error: "Too many attempts. Please try again in an hour." }, 429);
    if (!await emailRateLimit(email)) return response({ error: "We’ve had a few requests for this email. Please try again tomorrow." }, 429);
    const blocked=await database().prepare("SELECT email FROM crm_contacts WHERE email=? AND stage='blocked'").bind(email).first();
    if(blocked)return response({ok:true,state:"saved"});
    // Inbox confirmation is the proof of ownership. A short DNS outage must
    // not lose a signup; reject only a completed check that finds no mail path.
    let mailDomain:boolean|undefined;
    try { mailDomain=await domainCanReceiveMail(email); } catch { /* best-effort DNS check */ }
    if (mailDomain===false) return response({error:"Please check your email. Its mail service does not seem to be set up."},400);
    const token = newToken();
    const confirmToken = newToken();
    const now = Date.now();
    const id=crypto.randomUUID();
    const settings=emailSettings(new URL(request.url).origin);
    const ready=await emailCanSend(settings);
    await database().prepare("INSERT INTO waitlist (id, email, first_name, token_hash, created_at, expires_at, consent_version, newsletter, newsletter_consent_at, email_verified, source, confirmation_hash, confirmation_expires_at, email_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)")
      .bind(id, email, firstName, await hash(token), now, now + 30 * 86400000, CONSENT_VERSION, body.newsletter ? 1 : 0, body.newsletter ? now : null, sourceName(body.source), await hash(confirmToken), now + 86400000, ready?"pending":"waiting_setup").run();
    // Founder delivery failures must never lose a reader's saved signup.
    try { await notifyFounder(database(),settings,id); } catch { /* recover via the owner queue */ }
    if (!ready) return response({ok:true,state:"saved"});
    try {
      await sendConfirmation(settings,{email,firstName,confirmToken,manageToken:token});
      await database().prepare("UPDATE waitlist SET confirmation_sent_at = ?, email_state = 'confirmation_sent' WHERE id = ?").bind(Date.now(),id).run();
      return response({ok:true,state:"check_email"});
    } catch {
      await database().prepare("UPDATE waitlist SET email_state = 'send_failed' WHERE id = ?").bind(id).run();
      return response({error:"We could not send your email just now. Please try again soon."},503);
    }
  } catch (error) { return failed(error); }
}
