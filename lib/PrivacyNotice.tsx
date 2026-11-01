import PageFrame from "@/lib/PageFrame";
import type { PrivacyNoticeData } from "@/lib/privacy-notices";
import MeasurementChoices from "@/lib/MeasurementChoices";

// Only the published notice's contact address and regulator link become links.
// Source text remains plain React text, never raw HTML.
function NoticeText({ text }: { text: string }) {
  return <>{text.split(/(team@satinlore\.com|https:\/\/ico\.org\.uk\/make-a-complaint\/)/).map((part, index) => {
    if (part === "team@satinlore.com") {
      return <a href="mailto:team@satinlore.com" key={index}>{part}</a>;
    }
    if (part === "https://ico.org.uk/make-a-complaint/") {
      return <a href={part} key={index}>{part}</a>;
    }
    return part;
  })}</>;
}

export default function PrivacyNotice({ notice, measurementChoices = false }: { notice: PrivacyNoticeData; measurementChoices?: boolean }) {
  return <PageFrame title={notice.title}>
    <article className="privacy-notice">
      <p className="privacy-notice-date">{notice.date}</p>
      {notice.intro.map(paragraph => <p key={paragraph}><NoticeText text={paragraph} /></p>)}
      {notice.sections.map((section, index) => <section key={section.heading} aria-labelledby={`notice-section-${index}`}>
        <h2 id={`notice-section-${index}`}>{section.heading}</h2>
        {section.paragraphs.map(paragraph => <p key={paragraph}><NoticeText text={paragraph} /></p>)}
        {measurementChoices && section.heading === "Cookies and similar tools" && <MeasurementChoices />}
      </section>)}
      <p><strong>{notice.signoff}</strong></p>
    </article>
  </PageFrame>;
}
