import MarketingHome from "@/lib/MarketingHome";
import PageFrame from "@/lib/PageFrame";
import { isOwner } from "@/lib/waitlist-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "SatinLore · Masked page preview", robots: { index: false, follow: false } };

export default async function ExperiencePreview() {
  if (!await isOwner()) return <PageFrame title="Founder access only."><p>Sign in through Cloudflare Access to view the masked page preview.</p></PageFrame>;
  return <MarketingHome preview />;
}
