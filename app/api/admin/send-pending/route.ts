import {cleanExpired,database,hash,isOwner,jsonBody,newToken,response,failed} from "@/lib/waitlist-server";
import {emailSettings} from "@/lib/email-settings";
import {emailCanSend} from "@/lib/email-readiness";
import {sendConfirmation} from "@/lib/email-sender";
export async function POST(request:Request){
 if(!await isOwner())return response({error:"Owner access required."},403);
 try{
  const body=await jsonBody(request);if(body.send!==true)return response({error:"Choose Send to start."},400);
  const settings=emailSettings(new URL(request.url).origin);
  if(!await emailCanSend(settings))return response({error:"Email is not ready. Check the sender, account access and sending settings first."},503);
  await cleanExpired();
  const rows=await database().prepare("SELECT w.id,w.email,w.first_name FROM waitlist w WHERE w.email_state IN ('waiting_setup','send_failed') AND w.first_name IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.email=w.email AND c.stage='blocked') AND NOT EXISTS (SELECT 1 FROM waitlist checked WHERE checked.email=w.email AND checked.email_verified=1) AND NOT EXISTS (SELECT 1 FROM waitlist newer WHERE newer.email=w.email AND (newer.created_at>w.created_at OR (newer.created_at=w.created_at AND newer.id>w.id))) ORDER BY w.created_at LIMIT 5").all<{id:string;email:string;first_name:string}>();
  let sent=0,failedCount=0;
  for(const row of rows.results){
   const confirmToken=newToken(),manageToken=newToken();
   const claimed=await database().prepare("UPDATE waitlist SET email_state='sending', token_hash=?, confirmation_hash=?, confirmation_expires_at=? WHERE id=? AND email_state IN ('waiting_setup','send_failed') AND NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.email=waitlist.email AND c.stage='blocked') RETURNING id")
    .bind(await hash(manageToken),await hash(confirmToken),Date.now()+86400000,row.id).first();
   if(!claimed)continue;
   try{
    await sendConfirmation(settings,{email:row.email,firstName:row.first_name,confirmToken,manageToken});
    await database().prepare("UPDATE waitlist SET email_state='confirmation_sent',confirmation_sent_at=? WHERE id=?").bind(Date.now(),row.id).run();sent++;
   }catch{
    await database().prepare("UPDATE waitlist SET email_state='send_failed' WHERE id=?").bind(row.id).run();failedCount++;
   }
  }
  return response({ok:true,sent,failed:failedCount});
 }catch(error){return failed(error);}
}
