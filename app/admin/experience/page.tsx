import PageFrame from "@/lib/PageFrame";
import AdminShell from "@/lib/AdminShell";
import AdminExperiencePanel from "@/lib/AdminExperiencePanel";
import { isOwner } from "@/lib/waitlist-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "SatinLore · Heatmaps and replays", robots: { index: false, follow: false } };

export default async function ExperiencePage() {
  if (!await isOwner()) return <PageFrame title="Founder access only."><p>Sign in through Cloudflare Access with the configured founder account to view this workspace.</p></PageFrame>;
  return <AdminShell active="/admin/experience" title="See where the page works." description="Explore clicks, scrolling and time in view from visitors who chose to share a replay. Form contents and private pages are excluded."><AdminExperiencePanel /></AdminShell>;
}
