"use client";

import SiteMetrics from "@/lib/SiteMetrics";
import WebsiteExperience from "@/lib/WebsiteExperience";
import { OPEN_PRIVACY_EVENT } from "@/lib/experience-client";
import { LAUNCH_LAYOUT } from "@/lib/experience-layout.mjs";
import { READER_BILLING_URL, READER_LOGIN_URL, READER_SIGNUP_URL } from "@/lib/launch-marketing";
import "@/app/launch.css";

export default function LaunchHome({ billing = false, preview = false }: { billing?: boolean; preview?: boolean }) {
  const link = (href: string) => preview ? undefined : href;
  return <div className="launch-page" data-experience-layout={LAUNCH_LAYOUT} inert={preview}>
    {!preview && <SiteMetrics />}
    <a className="skip" href={link("#main")}>Skip to content</a>
      <header className="wrap topbar">
        <a className="wordmark" href={link("#main")}>SatinLore</a>
        <nav aria-label="Main navigation"><ul>
          <li><a href={link("#how-it-works")}>How it works</a></li>
          <li><a href={link("#setup")}>Toy setup</a></li>
          <li><a href={link("#guides")}>Guides</a></li>
          <li><a href={link("#pricing")}>Pricing</a></li>
        </ul></nav>
        <a className="login" href={link(READER_LOGIN_URL)}>Sign in</a>
      </header>
      <main id="main" className="wrap">
        <section data-experience-section="hero" className="hero" aria-labelledby="hero-title">
          <img className="hero-photo" src="/images/landing/after-hours.webp" alt="" width="1536" height="1024" fetchPriority="high" />
          <div>
            <h1 id="hero-title">Read it. <em>Feel it.</em></h1>
            <p className="hero-copy">Add a story. SatinLore changes the rhythm and strength of a compatible toy to match the story as you read.</p>
            <div className="actions">
              <a className="button primary" data-metric-cta="hero" href={link(READER_SIGNUP_URL)}>Create an account</a>
              <a className="button" href={link("#how-it-works")}>See how it works</a>
            </div>
            <p className="age">For adults 18+</p>
          </div>
          <figure className="reader" aria-label="Example of the SatinLore reader">
            <p className="reader-name">The Last Train</p>
            <p className="passage">Rain tapped on the station roof. The last train was already late.</p>
            <p className="passage"><mark>Her hand found his on the bench. He turned his palm to meet hers.</mark></p>
            <div className="trace" aria-hidden="true">
              {[20, 30, 24, 42, 57, 44, 64, 86, 66, 54, 40, 31].map((height, index) => <i key={index} style={{height: height + "%"}} />)}
            </div>
            <div className="preview-controls" aria-hidden="true"><span>Pause</span><span>Stop</span></div>
            <figcaption>Reading and playback controls in SatinLore.</figcaption>
          </figure>
        </section>
        <section data-experience-section="steps" className="section" id="how-it-works" aria-labelledby="how-title">
          <h2 id="how-title">From page to pulse</h2>
          <ol className="steps">
            <li><h3>Add a story</h3><p>Paste your text, upload a file or import a public AO3 link.</p></li>
            <li><h3>Connect your toy</h3><p>Pair a compatible toy. Try a short check and set how strong it can go.</p></li>
            <li><h3>Read</h3><p>Start when you’re ready. The rhythm changes with the story. Pause or stop from the reader.</p></li>
          </ol>
        </section>
        <section data-experience-section="guides" className="section" id="guides" aria-labelledby="guides-title">
          <h2 id="guides-title">Get ready to read</h2>
          <ul className="guide-list">
            <li><h3><a href={link("#ao3")}>Import from AO3</a></h3><p>Open a public work or chapter in the reader.</p></li>
            <li><h3><a href={link("#setup")}>Set up Lovense</a></h3><p>Pair your toy and check that it starts and stops.</p></li>
            <li><h3><a href={link("#controls")}>Use the reading controls</a></h3><p>Set your limit and change the strength as you read.</p></li>
          </ul>
        </section>
        <section data-experience-section="controls" className="section two-col" aria-labelledby="setup-title">
          <div>
            <h2 id="setup-title">Bring your story. Keep control.</h2>
            <p className="intro">A new story stays in your browser session until you choose to save it. To keep it for later, save it on this browser or to your account.</p>
          </div>
          <div>
            <article className="guide-detail" id="ao3"><h3>Import a public AO3 link</h3><p>Copy the work or chapter link. In SatinLore, select <strong>Add a story</strong>, then <strong>Use a link</strong>. If the work needs a login, you can bring text you have permission to use or upload its saved AO3 HTML file.</p></article>
            <article className="guide-detail" id="setup"><h3>Pair a compatible toy</h3><p>Connect your toy in Lovense Remote. In SatinLore, choose <strong>Toy setup</strong> and follow the steps. Pick your toy and use the short check. Your setup lists the movements it can control.</p></article>
            <article className="guide-detail" id="controls"><h3>Set the strength as you read</h3><p>Choose your highest level before you start. Use the reading controls to go lower or higher within that limit. Pause or Stop whenever you want.</p></article>
          </div>
        </section>
        <section data-experience-section="faq" className="section two-col faq" id="faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Before you start</h2>
          <div>
            <details data-experience-faq="0" open><summary>What does SatinLore do?</summary><p>It’s a reader for stories you bring. Connect a compatible toy, and SatinLore matches its rhythm and strength to the story as you read.</p></details>
            <details data-experience-faq="1"><summary>Do I set each vibration myself?</summary><p>No. SatinLore changes the pattern for you. You can lower or raise the strength, pause or stop.</p></details>
            <details data-experience-faq="2"><summary>Which toys work?</summary><p>Use a compatible connected toy for playback. The Lovense setup guide explains how to check which movements your connection supports.</p></details>
            <details data-experience-faq="3"><summary>Can I read without a toy?</summary><p>Yes. Open your story and read it in your browser. You need a compatible toy for synced playback.</p></details>
            <details data-experience-faq="4"><summary>Where do I get stories?</summary><p>Bring stories you wrote or have permission to use. Paste the text, upload a supported file or import a public AO3 link.</p></details>
          </div>
        </section>
        <section data-experience-section="pricing" className="section two-col" id="pricing" aria-labelledby="pricing-title">
          <div>
            <span id="waitlist" aria-hidden="true" /><span id="early-access" aria-hidden="true" />
            <h2 id="pricing-title">Start reading for free</h2>
            <p className="intro">Create an account to bring your stories and save the ones you want to keep.</p>
            <div className="actions">
              <a className="button primary" data-metric-cta="controls" href={link(READER_SIGNUP_URL)}>Create an account</a>
              {billing && <a className="button" href={link(READER_BILLING_URL)}>Plans and billing</a>}
            </div>
            <p className="age">Already on the early access list? <a href={link("/waitlist#waitlist")}>Visit the waitlist</a>.</p>
          </div>
          <div className="plan">
            <h3>SatinLore Monthly</h3>
            <p className="price"><strong>$9.99</strong> USD per month</p>
            <p>Includes 200 AI credits each paid month for story analysis. Renews until you cancel.</p>
            {!billing && <p className="plan-note">Paid plans will be available when billing opens.</p>}
            <ul><li>100 top-up credits for $4.99</li><li>200 top-up credits for $9.49</li><li>400 top-up credits for $17.99</li></ul>
            <p className="plan-note">Use your monthly credits first. Any left expire at the end of that paid month. Top-up credits carry over.</p>
          </div>
        </section>
      </main>
      <footer data-experience-section="footer"><div className="wrap footer">
        <a className="wordmark" href={link("#main")}>SatinLore</a>
        <a href={link("/privacy")}>Privacy</a>
        <a href={link("/contact")}>Contact</a>
        {preview ? <span>Privacy choices</span> : <button type="button" data-experience-mask onClick={() => window.dispatchEvent(new Event(OPEN_PRIVACY_EVENT))}>Privacy choices</button>}
        <a href={link("#faq")}>FAQ</a>
        <span>Adults 18+</span>
      </div></footer>
    {!preview && <WebsiteExperience />}
  </div>;
}
