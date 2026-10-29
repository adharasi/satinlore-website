"use client";

import { useState, type FormEvent } from "react";
import { CONSENT_TEXT, NEWSLETTER_TEXT } from "@/lib/waitlist-validation";

const passages = [
  { text: "The rain tapped on the glass. She turned a page and let the day slip away.", label: "A soft start", level: 2 },
  { text: "A voice came from the door. She looked up and smiled. For a beat, neither one spoke.", label: "A small spark", level: 4 },
  { text: "He held out his hand. She closed her book and took it. The night was theirs, with no need to rush.", label: "A new turn", level: 6 },
];

function Arrow({ small = false }: { small?: boolean }) {
  return <svg width={small ? 15 : 19} height={small ? 15 : 19} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Mark() {
  return <svg className="brand-mark" width="30" height="34" viewBox="0 0 30 34" fill="none" aria-hidden="true"><path d="M24 3C12 3 5 9 5 16c0 7 10 7 10 12 0 3-4 4-9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M24 3c-2 7-8 11-13 13C4 19 3 25 6 31c13 0 20-7 20-14 0-5-5-6-9-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

function ReaderPreview() {
  const [active, setActive] = useState(1);
  return <div className="preview-scene">
    <div className="orbit orbit-one" aria-hidden="true" /><div className="orbit orbit-two" aria-hidden="true" />
    <span className="scene-note note-top">A different kind<br />of page-turner.</span>
    <div className="reader-phone">
      <div className="phone-top"><span>9:41</span><span className="phone-island" /><span>•••</span></div>
      <div className="reader-nav"><span>‹</span><span>Satinlore</span><span className="reader-type">Aa</span></div>
      <div className="reader-story"><p className="chapter-kicker">A night of their own</p><h2>Just one<br /><em>more page.</em></h2>
        <div className="preview-passages">{passages.map((passage, index) => <button type="button" key={index} className={`passage ${active === index ? "active" : ""}`} onClick={() => setActive(index)} aria-pressed={active === index}><span>{passage.text}</span></button>)}</div>
      </div>
      <div className="reader-controls"><div className="reader-level-top"><span><span className="status-dot" /> Strength</span><span>{passages[active].level}<small> / 10</small></span></div><div className="level-track"><span style={{ width: `${passages[active].level * 10}%` }} /></div><p>{passages[active].label}</p></div>
    </div>
    <div className="preview-caption"><span className="tiny-star" aria-hidden="true">✧</span><span>Tap a line. Watch the level change.<br /><strong>A sneak peek. No toy is linked.</strong></span></div>
    <span className="scene-note note-bottom">Just read.<br />Feel it unfold.</span>
  </div>;
}

function WaitlistForm() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState("form");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setError(""); setBusy(true);
    try {
      const sourceValue = new URLSearchParams(window.location.search).get("utm_source") || "direct";
      const source = /^[a-zA-Z0-9_-]{1,64}$/.test(sourceValue) ? sourceValue : "direct";
      const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName, email, adult, consent, newsletter, company, source }) });
      const data = await response.json() as { ok?: boolean; error?: string; state?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "We could not save your place. Please try again.");
      setState(data.state === "check_email" ? "check_email" : "saved");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }
  if (state !== "form") return <div className="signup-success" aria-live="polite"><div className="success-mark" aria-hidden="true">✓</div><p className="eyebrow">Your next chapter</p>
    <h3>{state === "check_email" ? "Check your inbox." : `Thanks, ${firstName.trim()}.`}</h3>
    <p>{state === "check_email" ? "Tap the link in our email to save your spot. If you do not see it, check your spam folder." : "We’ve saved your name and email. We’ll ask you to check your inbox before we send you news."}</p>
    <p>You can leave the list at any time.</p>
    <button type="button" className="text-button" onClick={() => { setState("form"); setError(""); }}>Back to the form <Arrow small /></button>
  </div>;
  return <form onSubmit={submit} className="waitlist-form">
    <label className="field" htmlFor="waitlist-name">First name<input id="waitlist-name" name="given-name" type="text" autoComplete="given-name" placeholder="Your first name" value={firstName} onChange={event => setFirstName(event.target.value)} required maxLength={60} /></label>
    <label className="field" htmlFor="waitlist-email">Email address<input id="waitlist-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label>
    <div className="honeypot" aria-hidden="true"><label htmlFor="company">Company<input id="company" name="company" value={company} onChange={event => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
    <label className="check-field"><input type="checkbox" required checked={adult} onChange={event => setAdult(event.target.checked)} /><span>I am 18 or over.</span></label>
    <label className="check-field"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{CONSENT_TEXT}</span></label>
    <label className="check-field optional-check"><input type="checkbox" checked={newsletter} onChange={event => setNewsletter(event.target.checked)} /><span>{NEWSLETTER_TEXT} <small>Your choice</small></span></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="button submit-button" type="submit" disabled={busy}>{busy ? "Saving your place…" : "Join the list"}<Arrow /></button>
    <p className="form-fineprint">Free to join. No card needed. Read our <a href="/privacy">privacy note</a>.</p>
  </form>;
}

export default function Home() {
  return <><a href="#main" className="skip-link">Skip to content</a><header className="site-header site-shell"><a href="/" className="brand" aria-label="Satinlore home"><Mark /><span>Satinlore</span></a><nav aria-label="Main navigation"><a href="#how-it-works" className="nav-how">The idea</a><a href="#early-access" className="nav-cta">Join early access <Arrow small /></a></nav></header>
    <main id="main"><section className="hero site-shell"><div className="hero-copy"><p className="eyebrow"><span className="status-dot" /> A new way to read · Coming soon</p><h1>Your stories.<br />A new way<br />to <em>feel them.</em></h1><p className="hero-description">Get lost in the story. Feel each twist and turn.</p><p className="hero-detail">Satinlore makes your toy match the story and the speed you read. It all happens on its own. Just read, relax, and enjoy.</p><a href="#early-access" className="button hero-button">Join early access <Arrow /></a><p className="hero-footnote">Free to join. For adults 18+.</p></div><ReaderPreview /></section>
      <section className="editorial-strip"><div className="site-shell"><span className="strip-line" /><p>Bring your own story.<br className="mobile-break" /> Let the reading set the pace.</p><span className="strip-line" /></div></section>
      <section id="how-it-works" className="how-section site-shell"><div className="section-heading"><p className="eyebrow">How it will feel</p><h2>A little closer<br />to the <em>story.</em></h2><p>Less to do. More to feel.</p></div><div className="how-steps"><article><span className="step-number">01</span><h3>Pick a story</h3><p>Start with a story you love. Settle in and make time for yourself.</p></article><article><span className="step-number">02</span><h3>Let it follow</h3><p>Your toy follows the story as you read. The feel builds and fades on its own, right with the words.</p></article><article><span className="step-number">03</span><h3>Make it your own</h3><p>Keep it soft or turn it up. Pause or stop at any time. It’s always your call.</p></article></div></section>
      <section id="early-access" className="early-section"><div className="early-inner site-shell"><div className="early-copy"><p className="eyebrow">Be here for the first chapter</p><h2>Try it.<br />Shape it.<br /><em>Get paid.</em></h2><p>Join the waitlist for a chance to help us test SatinLore. If picked, you can earn up to US$500 cash. Tell us what works and what could be better.</p><div className="offer-note"><span aria-hidden="true">✧</span><div><strong>Up to US$500 in total for the test tasks you finish.</strong></div></div><p>Have a toy you love? Still looking? You’re welcome here.</p><a className="text-link" href="#questions">Have a question? <span aria-hidden="true">↓</span></a></div><div className="signup-panel"><p className="panel-label">Join the waitlist</p><WaitlistForm /></div></div></section>
      <section id="questions" className="faq-section site-shell"><div className="section-heading"><p className="eyebrow">Before you turn the page</p><h2>A few<br /><em>questions.</em></h2></div><div className="faq-list"><details><summary>How does it work?</summary><p>Your toy follows the story and the speed you read. The feel changes on its own. You can turn it up, keep it soft, or pause at any time.</p></details><details><summary>Do I need a certain toy to join?</summary><p>No. You can join with any toy, or none yet. Tell us what you use to help choose which toys to add first.</p></details><details><summary>Is it free to join?</summary><p>Yes. It’s free to join, and you don’t need a card. We’ll share any prices before you choose a plan.</p></details><details><summary>When can I try it?</summary><p>We’re bringing Satinlore to life. Join the list to hear when it’s ready and get a chance to try it early.</p></details><details><summary>Can I get paid to test it?</summary><p>If picked, you can earn up to US$500 cash in total for the test tasks you finish. Tell us what works and what could be better.</p></details></div></section>
      <section className="closing-line site-shell"><p>Some stories are worth<br /><em>slowing down for.</em></p><a href="#early-access" className="text-button">Be here for the first chapter <Arrow /></a></section></main>
    <footer className="site-footer site-shell"><a href="/" className="brand footer-brand"><Mark /><span>Satinlore</span></a><p>Feel the story unfold.</p><nav aria-label="Footer navigation"><a href="/privacy">Privacy</a><a href="/contact">Contact</a><span>18+</span></nav><small>© {new Date().getFullYear()} Satinlore. Coming soon.</small></footer></>;
}
