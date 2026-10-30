import { marketingSuppressionHash } from "@/lib/email-suppression";
import { validToken } from "@/lib/waitlist-validation";
import { cleanExpired, database, failed, hash, jsonBody, response, runtime } from "@/lib/waitlist-server";
export async function POST(request: Request) {
  try {
    const b = await jsonBody(request);
    if (!validToken(b.token)) return response({error:"This private link is invalid or has expired."}, 404);
    await cleanExpired();
    const tokenHash = await hash(b.token);
    const entry = await database().prepare("SELECT email, email_verified FROM waitlist WHERE (token_hash = ? OR (email_verified=1 AND (previous_token_hash=? OR survey_token_hash=?))) AND expires_at > ?").bind(tokenHash,tokenHash,tokenHash,Date.now()).first<{email:string;email_verified:number}>();
    if (b.action === "delete") {
      if(entry?.email_verified)await database().batch([
        database().prepare("INSERT INTO email_suppressions(email_hash,purpose,suppressed_at) VALUES (?,'marketing',?) ON CONFLICT(email_hash,purpose) DO UPDATE SET suppressed_at=excluded.suppressed_at").bind(await marketingSuppressionHash(entry.email,runtime().ABUSE_SALT),Date.now()),
        database().prepare("DELETE FROM waitlist WHERE email = ?").bind(entry.email),
        database().prepare("DELETE FROM survey_email_jobs WHERE email = ?").bind(entry.email),
        database().prepare("DELETE FROM crm_contacts WHERE email = ? AND NOT EXISTS (SELECT 1 FROM questionnaire_responses q WHERE q.email=crm_contacts.email)").bind(entry.email),
      ]);
      else await database().prepare("DELETE FROM waitlist WHERE token_hash = ?").bind(tokenHash).run();
      return response({ok:true,deleted:true});
    }
    if (b.action === "newsletter" && typeof b.newsletter === "boolean") {
      if(entry?.email_verified) {
        const emailHash=await marketingSuppressionHash(entry.email,runtime().ABUSE_SALT);
        if(!b.newsletter) await database().batch([
          database().prepare("INSERT INTO email_suppressions(email_hash,purpose,suppressed_at) VALUES (?,'marketing',?) ON CONFLICT(email_hash,purpose) DO UPDATE SET suppressed_at=excluded.suppressed_at").bind(emailHash,Date.now()),
          database().prepare("UPDATE waitlist SET newsletter=0,newsletter_consent_at=NULL WHERE email=?").bind(entry.email),
        ]);
        else await database().prepare("DELETE FROM email_suppressions WHERE email_hash=? AND purpose='marketing'").bind(emailHash).run();
      }
      const row = await database().prepare("UPDATE waitlist SET newsletter = ?, newsletter_consent_at = ? WHERE (token_hash = ? OR (email_verified=1 AND (previous_token_hash=? OR survey_token_hash=?))) AND expires_at > ? RETURNING id")
        .bind(b.newsletter ? 1 : 0, b.newsletter ? Date.now() : null, tokenHash, tokenHash, tokenHash, Date.now()).first();
      return row ? response({ok:true}) : response({error:"This private link is invalid or has expired."}, 404);
    }
    if (b.action !== "get") return response({error:"Choose a valid action."}, 400);
    const row = await database().prepare("SELECT newsletter, model, phone, interest FROM waitlist WHERE (token_hash = ? OR (email_verified=1 AND (previous_token_hash=? OR survey_token_hash=?))) AND expires_at > ?").bind(tokenHash, tokenHash, tokenHash, Date.now()).first();
    if(row && entry?.email_verified) {
      const suppressed=await database().prepare("SELECT 1 FROM email_suppressions WHERE email_hash=? AND purpose='marketing'").bind(await marketingSuppressionHash(entry.email,runtime().ABUSE_SALT)).first();
      if(suppressed) row.newsletter=0;
    }
    return row ? response({ok:true,profile:row}) : response({error:"This private link is invalid or has expired."}, 404);
  } catch (error) { return failed(error); }
}
