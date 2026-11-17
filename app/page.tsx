import type { Metadata } from "next";
import LaunchHome from "@/lib/LaunchHome";
import MarketingHome from "@/lib/MarketingHome";
import { marketingLaunch } from "@/lib/launch-marketing";
import { runtime } from "@/lib/waitlist-server";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!marketingLaunch(runtime()).launch) return { alternates: { canonical: "/" } };
  const title = "SatinLore | Stories that sync with your toy";
  const description = "Bring your own story. SatinLore changes the rhythm and strength of a compatible toy to match the story as you read. For adults 18+.";
  return {
    title, description, alternates: { canonical: "/" },
    openGraph: { title, description, type: "website", url: "/", images: ["/images/landing/after-hours.webp"] },
  };
}

export default function Home() {
  const current = marketingLaunch(runtime());
  return current.launch ? <LaunchHome billing={current.billing} /> : <MarketingHome />;
}
