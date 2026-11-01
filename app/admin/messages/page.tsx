import PageFrame from "@/lib/PageFrame";
import AdminShell from "@/lib/AdminShell";
import ContactRequestsPanel from "@/lib/ContactRequestsPanel";
import { isOwner } from "@/lib/waitlist-server";
export const dynamic = "force-dynamic";
export const metadata = { title: "SatinLore · Contact inbox", robots: { index: false, follow: false } };
export default async function Messages() {
  if (!await isOwner()) return <PageFrame title="Founder access only."><p>Sign in through Cloudflare Access with the configured founder account to view messages.</p></PageFrame>;
  return <AdminShell active="/admin/messages" title="Your contact inbox." description="Browse questions, partnership notes and privacy requests. Search by email, filter by topic, and keep track of what needs a reply."><ContactRequestsPanel /></AdminShell>;
}
