import type { Metadata } from "next";
import MarketingHome from "@/lib/MarketingHome";

export const metadata: Metadata = { title: "SatinLore · Beta waitlist", robots: { index: false, follow: true } };

export default function WaitlistPage() {
  return <MarketingHome />;
}
