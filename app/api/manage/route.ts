import { validToken } from "@/lib/waitlist-validation";
import { cleanExpired, database, failed, hash, jsonBody, response } from "@/lib/waitlist-server";
export async function POST(request: Request) {
  try {
    const b = await jsonBody(request);
    if (!validToken(b.token)) return response({error:"This private link is invalid or has expired."}, 404);
    await cleanExpired();
    const tokenHash = await hash(b.token);
    const entry = await database().prepare("SELECT email, email_verified FROM waitlist WHERE (token_hash = ? OR (email_verified=1 AND previous_token_hash=?)) AND expires_at > ?").bind(tokenHash,tokenHash,Date.now()).first<{email:string;email_verified:number}>();
    if (b.action === "delete") {
      if(entry?.email_verified)await database().batch([
        database().prepare("DELETE FROM waitlist WHERE email = ?").bind(entry.email),
        database().prepare("DELETE FROM crm_contacts WHERE email = ?").bind(entry.email),
      ]);
      else await database().prepare("DELETE FROM waitlist WHERE token_hash = ?").bind(tokenHash).run();
      return response({ok:true,deleted:true});
    }
    if (b.action === "newsletter" && typeof b.newsletter === "boolean") {
      if(entry?.email_verified && !b.newsletter)await database().prepare("UPDATE waitlist SET newsletter = 0, newsletter_consent_at = NULL WHERE email = ?").bind(entry.email).run();
      const row = await database().prepare("UPDATE waitlist SET newsletter = ?, newsletter_consent_at = ? WHERE (token_hash = ? OR (email_verified=1 AND previous_token_hash=?)) AND expires_at > ? RETURNING id")
        .bind(b.newsletter ? 1 : 0, b.newsletter ? Date.now() : null, tokenHash, tokenHash, Date.now()).first();
      return row ? response({ok:true}) : response({error:"This private link is invalid or has expired."}, 404);
    }
    if (b.action !== "get") return response({error:"Choose a valid action."}, 400);
    const row = await database().prepare("SELECT newsletter, model, phone, interest FROM waitlist WHERE (token_hash = ? OR (email_verified=1 AND previous_token_hash=?)) AND expires_at > ?").bind(tokenHash, tokenHash, Date.now()).first();
    return row ? response({ok:true,profile:row}) : response({error:"This private link is invalid or has expired."}, 404);
  } catch (error) { return failed(error); }
}
