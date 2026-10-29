import { cleanExpired, database, isOwner, response } from "@/lib/waitlist-server";
import { csvCell } from "@/lib/waitlist-validation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await isOwner()) return response({error:"Owner access required."},403);
  await cleanExpired();
  const includePending = new URL(request.url).searchParams.get("include") === "pending";
  const fields="w.id,w.first_name,w.email,w.email_verified,w.email_state,w.founder_alert_state,w.founder_notified_at,w.confirmed_at,w.created_at,w.expires_at,w.consent_version,w.newsletter,w.newsletter_consent_at,w.source,w.model,w.phone,w.interest,COALESCE(c.stage,'new') crm_stage,COALESCE(c.notes,'') crm_notes,c.updated_at crm_updated_at";
  const query=`WITH ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY email_verified DESC, confirmed_at DESC, created_at DESC, id DESC) AS rank FROM waitlist ${includePending ? "" : "WHERE email_verified=1"}) SELECT ${fields} FROM ranked w LEFT JOIN crm_contacts c ON c.email=w.email WHERE w.rank=1 ${includePending ? "" : "AND COALESCE(c.stage,'new')!='blocked'"} ORDER BY w.created_at DESC`;
  const rows = await database().prepare(query).all<Record<string,unknown>>();
  const keys = ["id","first_name","email","email_verified","email_state","founder_alert_state","founder_notified_at","confirmed_at","created_at","expires_at","consent_version","newsletter","newsletter_consent_at","source","model","phone","interest","crm_stage","crm_notes","crm_updated_at"];
  const dates = new Set(["founder_notified_at", "confirmed_at", "created_at", "expires_at", "newsletter_consent_at", "crm_updated_at"]);
  const csv = "\uFEFF" + [keys.map(csvCell).join(","), ...rows.results.map(r => keys.map(k => csvCell(dates.has(k) && r[k] != null ? new Date(Number(r[k])).toISOString() : r[k])).join(","))].join("\r\n");
  return new Response(csv, {headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=satinlore-waitlist.csv","Cache-Control":"no-store"}});
}
