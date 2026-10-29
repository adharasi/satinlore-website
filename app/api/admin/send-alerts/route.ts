import {cleanExpired,database,failed,isOwner,jsonBody,response} from "@/lib/waitlist-server";
import {emailSettings} from "@/lib/email-settings";
import {emailCanSend} from "@/lib/email-readiness";
import {notifyFounder} from "@/lib/founder-alerts";
export async function POST(request:Request){
 if(!await isOwner())return response({error:"Owner access required."},403);
 try{
  const b=await jsonBody(request);if(b.send!==true)return response({error:"Choose Send to start."},400);
  const settings=emailSettings(new URL(request.url).origin);
  if(!await emailCanSend(settings))return response({error:"Email is not ready. Check the sender setup first."},503);
  await cleanExpired();
  const rows=await database().prepare(`SELECT w.id FROM waitlist w WHERE (w.founder_alert_state IN ('pending','failed') OR (w.founder_alert_state='sending' AND w.founder_alert_attempt_at<?))
   AND NOT EXISTS (SELECT 1 FROM waitlist sent WHERE sent.email=w.email AND sent.founder_notified_at IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM waitlist newer WHERE newer.email=w.email AND (newer.created_at>w.created_at OR (newer.created_at=w.created_at AND newer.id>w.id)))
   AND NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.email=w.email AND c.stage='blocked')
   ORDER BY w.created_at LIMIT 5`).bind(Date.now()-900000).all<{id:string}>();
  let sent=0,failedCount=0;for(const row of rows.results){const result=await notifyFounder(database(),settings,row.id);if(result==='sent')sent++;if(result==='failed')failedCount++;}
  return response({ok:true,sent,failed:failedCount});
 }catch(error){return failed(error);}
}
