"use client";

import WebsiteExperience from "@/lib/WebsiteExperience";

export default function MeasurementChoices() {
  return <aside id="measurement-choices" className="measurement-choices" aria-label="Cookie and website measurement choices">
    <p>Accept or reject non-essential cookies, or choose analytics and website recordings separately. Essential service and security tools stay available.</p>
    <WebsiteExperience compact />
  </aside>;
}
