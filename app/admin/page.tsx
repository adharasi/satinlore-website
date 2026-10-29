import PageFrame from "@/lib/PageFrame";
import EmailSetupPanel from "@/lib/EmailSetupPanel";
import CrmPanel, { type CrmContact } from "@/lib/CrmPanel";
import {cleanExpired,database,isOwner} from "@/lib/waitlist-server";
export const dynamic = "force-dynamic";
export const metadata = { title:"Satinlore · Founder dashboard",robots:{index:false,follow:false} };
export default async function Admin(){
 if(!await isOwner())return <PageFrame title="Founder access only."><p>Open this dashboard through your Cloudflare Access sign-in. Only the configured founder account can view reader details.</p><p>If you have already signed in, check the Access application and server settings before trying again.</p></PageFrame>;
 await cleanExpired();
 const stats = await database().prepare("SELECT COUNT(DISTINCT email) total, COUNT(DISTINCT CASE WHEN email_verified = 1 THEN email END) confirmed, COUNT(DISTINCT CASE WHEN model IS NOT NULL AND TRIM(model) != '' THEN email END) owners, COUNT(DISTINCT CASE WHEN interest = 'freebeta' THEN email END) freebeta, COUNT(DISTINCT CASE WHEN interest = 'paidlater' THEN email END) paidlater FROM waitlist").first<Record<string,number>>();
 const rows=await database().prepare("WITH ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY email_verified DESC, confirmed_at DESC, created_at DESC, id DESC) AS rank FROM waitlist) SELECT w.id,w.first_name,w.email,w.email_verified,w.email_state,w.founder_alert_state,w.founder_notified_at,w.model,w.phone,w.interest,w.source,w.newsletter,w.consent_version,w.created_at,w.confirmed_at,COALESCE(c.stage,'new') stage,COALESCE(c.notes,'') notes,c.updated_at FROM ranked w LEFT JOIN crm_contacts c ON c.email=w.email WHERE w.rank=1 ORDER BY w.created_at DESC LIMIT 250").all<CrmContact>();
 const requests=await database().prepare("SELECT id,email,category,message,created_at FROM contact_requests ORDER BY created_at DESC LIMIT 100").all<Record<string,string|number>>();
 return <PageFrame title="The first chapter: your readers.">
 <p>Private founder dashboard. Only checked emails should be used for campaigns. Unchecked sign-ups stay separate. Blocked readers stay in the CRM for review and are excluded from the checked-reader export.</p><EmailSetupPanel />
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:16,margin:"28px 0"}}>{[["All sign-ups",stats?.total||0],["Checked emails",stats?.confirmed||0],["Toy answers",stats?.owners||0],["Early test interest",stats?.freebeta||0],["Paid-later interest",stats?.paidlater||0]].map(([label,n])=><div key={label} style={{padding:18,border:"1px solid #d9c9be",borderRadius:12}}><strong style={{fontSize:32,display:"block",fontFamily:"Georgia"}}>{n}</strong><span>{label}</span></div>)}</div>
 <p>Counts are distinct email addresses, not verified people. Toy answers are self-reported and do not prove compatibility. Paid-later interest is stated intent, not a sale. Exports contain personal information: store them securely and honour withdrawals before sending.</p>
 <p><a className="button" href="/api/admin/export">Export checked readers CSV ↗</a></p><p><a href="/api/admin/export?include=pending">Export all readers for review</a></p>
 <p>For Google Sheets, create a private sheet and choose File → Import → Upload, then select the CSV. Each export has one row per email, with CRM notes and dates. An exported sheet is a snapshot: refresh it before use and remove withdrawn readers from copies.</p>
 <CrmPanel initialContacts={rows.results} />
 <h2 style={{marginTop:36}}>Contact and privacy enquiries</h2><p>Requests are retained for 30 days. Handle privacy requests promptly; verify email ownership before changing someone’s entry from an enquiry alone.</p>
 {requests.results.map(r=><article key={r.id} style={{borderTop:"1px solid #d9c9be",padding:"18px 0"}}><p><strong>{r.category}</strong> · {r.email} · {new Date(Number(r.created_at)).toLocaleDateString("en-GB")}</p><p style={{whiteSpace:"pre-wrap"}}>{r.message}</p></article>)}{!requests.results.length&&<p>No contact requests yet.</p>}
 </PageFrame>;
}
