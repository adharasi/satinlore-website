import { validToken } from "@/lib/waitlist-validation";
import { cleanExpired, database, failed, hash, jsonBody, newToken, response } from "@/lib/waitlist-server";
import { emailIsReady, sendWelcome } from "@/lib/email-sender";
import { emailSettings } from "@/lib/email-settings";
export async function POST(request:Request) {
  try {
    const b=await jsonBody(request);
    if(!validToken(b.token))return response({error:"This link does not look right. Please join the list again."},400);
    await cleanExpired();
    const tokenHash=await hash(b.token);
    const current=await database().prepare("SELECT id, email_verified, confirmation_expires_at FROM waitlist WHERE confirmation_hash = ?").bind(tokenHash).first<{id:string;email_verified:number;confirmation_expires_at:number}>();
    if(!current)return response({error:"This link is out of date. Please join the list again."},410);
    if(current.email_verified)return response({ok:true,alreadyConfirmed:true});
    if(current.confirmation_expires_at<=Date.now())return response({error:"This link is out of date. Please join the list again."},410);
    const now=Date.now();const manageToken=newToken();
    const row=await database().prepare("UPDATE waitlist SET email_verified = 1, confirmed_at = ?, previous_token_hash=token_hash, token_hash = ?, email_state = 'confirmed', expires_at = ? WHERE id = ? AND email_verified = 0 AND confirmation_expires_at > ? AND expires_at > ? RETURNING email, first_name")
      .bind(now,await hash(manageToken),now+180*86400000,current.id,now,now).first<{email:string;first_name:string|null}>();
    if(!row)return response({ok:true,alreadyConfirmed:true});
    const settings=emailSettings(new URL(request.url).origin);
    let welcomeSent=false;
    if(settings.welcomeEnabled && emailIsReady(settings)) {
      try {
        await sendWelcome(settings,{email:row.email,firstName:row.first_name || "there",manageToken});
        await database().prepare("UPDATE waitlist SET welcome_sent_at = ? WHERE id = ?").bind(Date.now(),current.id).run();
        welcomeSent=true;
      } catch {
        await database().prepare("UPDATE waitlist SET email_state = 'welcome_failed' WHERE id = ?").bind(current.id).run();
      }
    }
    return response({ok:true,manageToken,welcomeSent});
  } catch(error) {return failed(error);}
}
