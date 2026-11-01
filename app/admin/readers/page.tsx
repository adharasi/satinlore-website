import PageFrame from "@/lib/PageFrame";
import AdminShell from "@/lib/AdminShell";
import CrmPanel, { type CrmContact } from "@/lib/CrmPanel";
import { CRM_CONTACTS_SQL } from "@/lib/crm-query";
import { withMarketingSuppression } from "@/lib/email-suppression";
import { cleanExpired, database, isOwner, runtime } from "@/lib/waitlist-server";
export const dynamic = "force-dynamic";
export const metadata = { title: "SatinLore · Reader CRM", robots: { index: false, follow: false } };
export default async function Readers() {
  if (!await isOwner()) return <PageFrame title="Founder access only."><p>Sign in through Cloudflare Access with the configured founder account to view readers.</p></PageFrame>;
  await cleanExpired();
  const now = Date.now();
  const contactRows = await database().prepare(CRM_CONTACTS_SQL).bind(now, now, now).all<CrmContact>();
  const rows = await withMarketingSuppression(database(), contactRows.results, runtime().ABUSE_SALT);
  const stats = await database().prepare("SELECT COUNT(DISTINCT email) total, COUNT(DISTINCT CASE WHEN email_verified = 1 THEN email END) confirmed FROM waitlist WHERE expires_at>?").bind(now).first<Record<string, number>>();
  const survey = await database().prepare("SELECT COUNT(*) responses, SUM(contact_consent) research_contact, SUM(prize_draw) draw_entries FROM questionnaire_responses WHERE expires_at>?").bind(now).first<Record<string, number>>();
  return <AdminShell active="/admin/readers" title="Readers, all in one place." description="The waitlist and questionnaire join by email. Verification, each consent choice, stages and notes stay separate.">
    <div className="admin-stat-grid admin-reader-stats">{[["Waitlist emails", stats?.total || 0], ["Confirmed emails", stats?.confirmed || 0], ["Questionnaires", survey?.responses || 0], ["Research contact opt-ins", survey?.research_contact || 0], ["Draw entries", survey?.draw_entries || 0]].map(([label, value]) => <div className="admin-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <section className="admin-card admin-export"><div><h2>Export waitlist readers</h2><p>Checked emails only for campaigns. Blocked readers are excluded. Survey answers remain in this private workspace.</p></div><div className="admin-action-row"><a className="button" href="/api/admin/export">Export checked readers CSV ↗</a><a className="text-button" href="/api/admin/export?include=pending">Export all for review ↗</a></div></section>
    <div className="admin-crm"><CrmPanel initialContacts={rows} /></div><p className="admin-note">Counts are distinct email addresses, not verified people. A questionnaire does not verify an email or join the waitlist. Keep exports private and honour withdrawals before sending.</p>
  </AdminShell>;
}
