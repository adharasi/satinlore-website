import {emailCanSend} from "./email-readiness";
import {sendFounderAlert,type EmailSettings} from "./email-sender";

/** Only a real saved row can generate an alert; no caller supplies its recipient. */
export async function notifyFounder(db:D1Database, settings:EmailSettings, id:string) {
  if (!await emailCanSend(settings)) return "queued";
  const now=Date.now();
  const claimed=await db.prepare(`UPDATE waitlist SET founder_alert_state='sending',founder_alert_attempt_at=?
    WHERE id=? AND expires_at>? AND (founder_alert_state IN ('pending','failed') OR (founder_alert_state='sending' AND founder_alert_attempt_at<?))
    AND NOT EXISTS (SELECT 1 FROM waitlist other WHERE other.email=waitlist.email AND other.id!=waitlist.id AND (other.founder_notified_at IS NOT NULL OR (other.founder_alert_state='sending' AND other.founder_alert_attempt_at>=?)))
    AND NOT EXISTS (SELECT 1 FROM crm_contacts c WHERE c.email=waitlist.email AND c.stage='blocked')
    RETURNING id,first_name,email,created_at`).bind(now,id,now,now-900000,now-900000).first<{id:string;first_name:string|null;email:string;created_at:number}>();
  if(!claimed)return "skipped";
  try {
    await sendFounderAlert(settings,{firstName:claimed.first_name||"Reader",email:claimed.email,createdAt:claimed.created_at});
    await db.prepare("UPDATE waitlist SET founder_alert_state='sent',founder_notified_at=? WHERE id=? AND founder_alert_state='sending' AND founder_alert_attempt_at=?").bind(Date.now(),id,now).run();
    return "sent";
  } catch {
    await db.prepare("UPDATE waitlist SET founder_alert_state='failed' WHERE id=? AND founder_alert_state='sending' AND founder_alert_attempt_at=?").bind(id,now).run();
    return "failed";
  }
}
