import type { Metadata } from "next";
import PrivacyNotice from "@/lib/PrivacyNotice";
import { websitePrivacyNotice } from "@/lib/privacy-notices";

export const metadata: Metadata = {
  title: "Website Privacy Notice | SatinLore",
  description: "How SatinLore handles your information when you visit, join the waitlist or contact the team.",
  alternates: { canonical: "https://satinlore.com/privacy" },
};

export default function Privacy() {
  return <PrivacyNotice notice={websitePrivacyNotice} measurementChoices />;
}
