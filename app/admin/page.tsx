import PageFrame from "@/lib/PageFrame";
import EmailSetupPanel from "@/lib/EmailSetupPanel";
import CrmPanel, { type CrmContact } from "@/lib/CrmPanel";
import {CRM_CONTACTS_SQL} from "@/lib/crm-query";
import {withMarketingSuppression} from "@/lib/email-suppression";
import {cleanExpired,database,isOwner,runtime} from "@/lib/waitlist-server";
export const dynamic = "force-dynamic";
export const metadata = { title:"Satinlore · Founder dashboard",robots:{index:false,follow:false} };
export default async function Admin(){
 if(!await isOwner())return <PageFrame title="Founder access only."><p>Open this dashboard through your Cloudflare Access sign-in. Only the configured founder account can view reader details.</p><p>If you have already signed in, check the Access application and server settings before trying again.</p></PageFrame>;
 await cleanExpired();
 const stats = await database().prepare("SELECT COUNT(DISTINCT email) total, COUNT(DISTINCT CASE WHEN email_verified = 1 THEN email END) confirmed, COUNT(DISTINCT CASE WHEN model IS NOT NULL AND TRIM(model) != '' THEN email END) owners, COUNT(DISTINCT CASE WHEN interest = 'freebeta' THEN email END) freebeta, COUNT(DISTINCT CASE WHEN interest = 'paidlater' THEN email END) paidlater FROM waitlist").first<Record<string,number>>();
 const now=Date.now();
 const contactRows=await database().prepare(CRM_CONTACTS_SQL).bind(now,now,now).all<CrmContact>();
 const rows=await withMarketingSuppression(database(),contactRows.results,runtime().ABUSE_SALT);
 const surveyStats=await database().prepare("SELECT COUNT(*) responses, SUM(contact_consent) research_contact, SUM(prize_draw) draw_entries FROM questionnaire_responses WHERE expires_at > ?").bind(now).first<Record<string,number>>();
 const requests=await database().prepare("SELECT id,email,category,message,created_at FROM contact_requests ORDER BY created_at DESC LIMIT 100").all<Record<string,string|number>>();
 return <PageFrame title="The first chapter: your readers.">
 <p>Private founder dashboard. Only checked emails should be used for campaigns. Unchecked sign-ups stay separate. Blocked readers stay in the CRM for review and are excluded from the checked-reader export.</p><EmailSetupPanel />
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:16,margin:"28px 0"}}>{[["Waitlist sign-ups",stats?.total||0],["Checked emails",stats?.confirmed||0],["Survey responses",surveyStats?.responses||0],["Research contact opt-ins",surveyStats?.research_contact||0],["Draw entries",surveyStats?.draw_entries||0]].map(([label,n])=><div key={label} style={{padding:18,border:"1px solid #d9c9be",borderRadius:12}}><strong style={{fontSize:32,display:"block",fontFamily:"Georgia"}}>{n}</strong><span>{label}</span></div>)}</div>
 <p>Counts are distinct email addresses, not verified people. A survey response does not check email ownership or join the waitlist. Research contact, draw entry and news consent are stored apart. Sensitive answers appear only when the reader agreed to share them. Exports contain personal information: store them securely and honour withdrawals before sending.</p>
 <p><a className="button" href="/api/admin/export">Export checked readers CSV ↗</a></p><p><a href="/api/admin/export?include=pending">Export all readers for review</a></p>
 <p>The CRM below joins waitlist and survey data by the same email. These CSV links export waitlist records only. Survey answers stay in this protected dashboard. Refresh the page to see new responses.</p>
 <CrmPanel initialContacts={rows} />
 <h2 style={{marginTop:36}}>Contact and privacy enquiries</h2><p>Requests are retained for 30 days. Handle privacy requests promptly; verify email ownership before changing someone’s entry from an enquiry alone.</p>
 {requests.results.map(r=><article key={r.id} style={{borderTop:"1px solid #d9c9be",padding:"18px 0"}}><p><strong>{r.category}</strong> · {r.email} · {new Date(Number(r.created_at)).toLocaleDateString("en-GB")}</p><p style={{whiteSpace:"pre-wrap"}}>{r.message}</p></article>)}{!requests.results.length&&<p>No contact requests yet.</p>}
 </PageFrame>;
}
