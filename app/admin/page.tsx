import PageFrame from "@/lib/PageFrame";
import AdminShell from "@/lib/AdminShell";
import AdminMetricsPanel from "@/lib/AdminMetricsPanel";
import { readAnalyticsOverview } from "@/lib/site-analytics";
import { cleanExpired, database, isOwner } from "@/lib/waitlist-server";
export const dynamic = "force-dynamic";
export const metadata = { title: "SatinLore · Website overview", robots: { index: false, follow: false } };
export default async function Admin({ searchParams }: { searchParams?: Promise<{ days?: string }> }) {
  if (!await isOwner()) return <PageFrame title="Founder access only."><p>Sign in through Cloudflare Access with the configured founder account to view this workspace.</p></PageFrame>;
  await cleanExpired();
  const query = await searchParams;
  const days = query?.days === "7" ? 7 : query?.days === "90" ? 90 : 30;
  const data = await readAnalyticsOverview(database(), days);
  return <AdminShell active="/admin" title="Your website, at a glance." description="See traffic, waitlist activity and messages. Open a section to work with the people behind the numbers."><div className="admin-toolbar"><form method="GET" action="/admin" className="admin-range-form"><label className="admin-field">Date range<select name="days" defaultValue={String(days)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><button type="submit" className="button">Update view</button></form><a className="admin-refresh" href={`/admin?days=${days}`}>Refresh numbers <span aria-hidden="true">↻</span></a></div><AdminMetricsPanel data={data} /></AdminShell>;
}
