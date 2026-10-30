import type { Metadata } from "next";
import PrivacyNotice from "@/lib/PrivacyNotice";
import { researchPrivacyNotice } from "@/lib/privacy-notices";

export const metadata: Metadata = {
  title: "Research Privacy Notice | SatinLore",
  description: "How SatinLore handles questionnaire answers, research choices, prize entries and paid testing.",
  alternates: { canonical: "https://satinlore.com/research-privacy" },
  robots: { index: false, follow: false, noarchive: true },
};

export default function ResearchPrivacy() {
  return <PrivacyNotice notice={researchPrivacyNotice} />;
}
