import PageFrame from "@/lib/PageFrame";
import AdminShell from "@/lib/AdminShell";
import EmailSetupPanel from "@/lib/EmailSetupPanel";
import { cleanExpired, database, isOwner, runtime } from "@/lib/waitlist-server";
export const dynamic = "force-dynamic";
export const metadata = { title: "SatinLore · Email operations", robots: { index: false, follow: false } };
export default async function Email() {
  if (!await isOwner()) return <PageFrame title="Founder access only."><p>Sign in through Cloudflare Access with the configured founder account to view email operations.</p></PageFrame>;
  await cleanExpired();
  const env = runtime();
  const jobs = await database().prepare("SELECT SUM(CASE WHEN state IN ('pending','sending') OR (state='failed' AND attempts<5) THEN 1 ELSE 0 END) queued, SUM(CASE WHEN state='sent' THEN 1 ELSE 0 END) sent, SUM(CASE WHEN state='failed' AND attempts>=5 THEN 1 ELSE 0 END) failed FROM survey_email_jobs").first<Record<string, number>>();
  return <AdminShell active="/admin/email" title="Keep email moving." description="Check sending health, review the questionnaire queue and recover waiting messages when needed."><div className="admin-stat-grid admin-email-stats">{[["Survey invitations queued", jobs?.queued || 0], ["Survey invitations accepted", jobs?.sent || 0], ["Invitations needing review", jobs?.failed || 0]].map(([label, value]) => <div className="admin-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><EmailSetupPanel sendingEnabled={env.EMAIL_ENABLED === "true"} surveyEnabled={env.SURVEY_EMAIL_ENABLED === "true"} welcomeEnabled={env.WELCOME_EMAIL_ENABLED === "true"} /></AdminShell>;
}
