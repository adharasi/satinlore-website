import PageFrame from "@/lib/PageFrame";
import { CONSENT_TEXT, NEWSLETTER_TEXT, CONSENT_VERSION } from "@/lib/waitlist-validation";
export default function Privacy() {
 return <PageFrame title="Your details. Your choice.">
  <p><strong>Privacy note · 28 October 2026</strong></p>

  <h2>What we ask for</h2>
  <p>We ask for your first name and email. You must say that you are 18 or over. We also keep a record of the words you agreed to and the date you joined.</p>
  <p>You may choose to tell us which toy and phone you own. We may also ask what news you want to hear. You can skip these questions.</p>
  <p>If you join through a shared link, we may keep its source name. For example, it may say that you came from X. We do not ask for your stories or private details about your sex life.</p>
  <h2>How we use your details</h2>
  <p>We use your details to run the list and send the news you asked for. Your first name helps us greet you. Your toy and phone choices help us plan what to build. The founder gets a short email when a new signup is saved. It includes your name and email, but no toy answers.</p>
  <p>The founder may keep short notes and a test stage to manage invites and follow-ups. These are private. They are removed with your entry if you leave the list.</p>
  <p>We may check that your email’s mail service is set up. We do not share your full email in this check. When email sending is ready, we send a link to your inbox. You must use that link before we mark your email as checked.</p>
  <p>We do this with your consent. A list for an adult product may show a private interest. That is why we ask you to agree before joining. You can leave at any time.</p>
  <blockquote>{CONSENT_TEXT}</blockquote>
  <p>A second box is your choice: “{NEWSLETTER_TEXT}” You do not have to tick it to join. Our current record of these words is {CONSENT_VERSION}.</p>
  <h2>Who can see it</h2>
  <p>The founder can see the list. Cloudflare hosts this site and its data. Amazon SES sends emails when the sender account is set up. These firms may process data outside the UK. Their terms set out how they protect it.</p>
  <p>We do not sell the list. We do not share it with toy brands or story writers. We do not use ad pixels or tools that record your screen here.</p>
  <h2>How long we keep it</h2>
  <p>New sign-ups that have not checked their email last for up to 30 days. Once you check your email, your entry lasts for up to 180 days. Older entries from our first form may also last up to 180 days.</p>
  <p>Old entries are cleared the next time the list tools run. We remove details sooner if you ask us to, or if the project stops. Notes sent through our contact form last for up to 30 days, unless we need more time to deal with your request.</p>
  <p>We keep short-lived counts to help block spam. We do not store your full IP address in our list. Our hosts may keep their own logs to keep the site safe.</p>
  <h2>How to leave</h2>
  <p>Our emails include a link to change your choices or leave the list. Keep that link private. Anyone who has it can use it. If you lose it, use the <a href="/contact">contact form</a>. We may ask you to prove that the email is yours.</p>
  <p>You can ask us to show, fix, copy or remove your data. You can ask us to stop some uses of it. Leaving the list does not change uses that were lawful before you left.</p>
  <p>You can also <a href="https://ico.org.uk/make-a-complaint/">raise a concern with the UK’s data watchdog</a>. We will update this note if we change how we use your data. Joining the list does not sign you up for a paid plan.</p>
 </PageFrame>;
}
