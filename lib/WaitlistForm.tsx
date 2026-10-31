"use client";

import { useState, type FormEvent } from "react";
import { CONSENT_TEXT, NEWSLETTER_TEXT } from "@/lib/waitlist-validation";

function Arrow({ small = false }: { small?: boolean }) {
  return <svg width={small ? 15 : 19} height={small ? 15 : 19} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}


export default function WaitlistForm() {
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
  return <form onSubmit={submit} aria-label="Beta waitlist" className="waitlist-form">
    <label className="field" htmlFor="waitlist-name">First name<input id="waitlist-name" name="given-name" type="text" autoComplete="given-name" placeholder="Your first name" value={firstName} onChange={event => setFirstName(event.target.value)} required maxLength={60} /></label>
    <label className="field" htmlFor="waitlist-email">Email address<input id="waitlist-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label>
    <div className="honeypot" aria-hidden="true"><label htmlFor="company">Company<input id="company" name="company" value={company} onChange={event => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
    <label className="check-field"><input type="checkbox" required checked={adult} onChange={event => setAdult(event.target.checked)} /><span>I am 18 or over.</span></label>
    <label className="check-field"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{CONSENT_TEXT}</span></label>
    <label className="check-field optional-check"><input type="checkbox" checked={newsletter} onChange={event => setNewsletter(event.target.checked)} /><span>{NEWSLETTER_TEXT} <small>Your choice</small></span></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="button submit-button" type="submit" disabled={busy}>{busy ? "Saving your place…" : "Join the beta waitlist"}<Arrow /></button>
    <p className="form-fineprint">Free to join. No card needed. Read our <a href="/privacy">privacy note</a>.</p>
  </form>;
}

