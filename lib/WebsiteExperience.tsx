"use client";

import {useEffect, useRef, useState} from "react";
import {createBrowserExperienceRecorder, OPEN_PRIVACY_EVENT, PRIVACY_EVENT,
  type ExperienceRecorder, type ExperienceState} from "@/lib/experience-client";
import {browserPrivacySignalOff, COOKIE_CATEGORIES, COOKIE_CHOICE_SYNC_EVENT, cookieConsentCookies, readCookieConsent} from "@/lib/cookie-consent.mjs";
import {setPageAnalyticsAllowed} from "@/lib/SiteMetrics";
import "./website-experience.css";

type Choices = {analytics: boolean; experience: boolean};
const NONE: Choices = {analytics: false, experience: false};
const ALL: Choices = {analytics: true, experience: true};

/** Shared category choices; never grant undisclosed purposes through an old preference. */
export default function WebsiteExperience({compact = false}: {compact?: boolean}) {
  const [choice, setChoice] = useState<Choices | null>(null);
  const [draft, setDraft] = useState<Choices>(NONE);
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<ExperienceState>("off");
  const [message, setMessage] = useState("");
  const recorder = useRef<ExperienceRecorder | null>(null);
  const mounted = useRef(false);
  const localOff = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    const engine = createBrowserExperienceRecorder(value => { if (mounted.current) setState(value); });
    recorder.current = engine;
    const sync = () => {
      const next = readCookieConsent(document.cookie), off = browserPrivacySignalOff(navigator);
      setChoice(next); setDraft(next ? {analytics: next.analytics, experience: next.experience} : NONE);
      setBlocked(off); setReady(true);
      setPageAnalyticsAllowed(!!next?.analytics && !off && !localOff.current);
      // Local notification does not rebroadcast, avoiding a cross-tab event loop.
      window.dispatchEvent(new Event(COOKIE_CHOICE_SYNC_EVENT));
      if (next?.experience && !off && !localOff.current && location.pathname === "/") void engine.start();
      else if (engine.snapshot().canWithdraw) void engine.stop({withdraw: true});
    };
    const show = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const saved = readCookieConsent(document.cookie);
      setDraft(saved ? {analytics: saved.analytics, experience: saved.experience} : NONE);
      setOpen(true);
    };
    const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("satinlore-privacy-choice") : null;
    const changed = () => { sync(); channel?.postMessage("changed"); };
    if (channel) channel.onmessage = () => sync();
    window.addEventListener(PRIVACY_EVENT, changed); window.addEventListener(OPEN_PRIVACY_EVENT, show);
    window.addEventListener("pageshow", sync);
    sync();
    return () => {
      mounted.current = false; window.removeEventListener(PRIVACY_EVENT, changed); window.removeEventListener(OPEN_PRIVACY_EVENT, show); channel?.close();
      window.removeEventListener("pageshow", sync); void engine.stop({flush: true}); recorder.current = null;
    };
  }, []);
  useEffect(() => {
    if (!dialog.current) return;
    if (open && !dialog.current.open) dialog.current.showModal();
    else if (!open && dialog.current.open) dialog.current.close();
    recorder.current?.refreshVisibility();
  }, [open]);

  const close = () => { setOpen(false); opener.current?.focus({preventScroll: true}); };
  const manage = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraft(choice ? {...choice} : NONE); setOpen(true);
  };
  async function choose(next: Choices) {
    if (busy) return;
    setBusy(true); setMessage("");
    const effective = browserPrivacySignalOff(navigator) ? NONE : next;
    if (!effective.analytics) setPageAnalyticsAllowed(false);
    // Stop locally before any network request so refusing can never leave capture active.
    const removal = !effective.experience ? recorder.current?.stop({withdraw: true}) : null;
    try {
      for (const cookie of cookieConsentCookies(effective, location.protocol === "https:")) document.cookie = cookie;
      const saved = readCookieConsent(document.cookie);
      if (!saved || saved.analytics !== effective.analytics || saved.experience !== effective.experience) {
        localOff.current = true;
        setPageAnalyticsAllowed(false);
        await recorder.current?.stop({withdraw: true});
        setMessage("Your browser could not save this choice. Optional recording is stopped on this page. You can also use your browser’s privacy settings.");
        setOpen(true); return;
      }
      localOff.current = false; setPageAnalyticsAllowed(effective.analytics); setChoice(effective); setDraft(effective);
      const removed = await removal;
      window.dispatchEvent(new Event(PRIVACY_EVENT));
      if (!effective.experience && removed === false) {
        setMessage("Non-essential choices are saved and recording is off. Removal of this visit’s earlier recording could not be confirmed. Stored visits expire after 30 days.");
        setOpen(true); return;
      }
      close();
    } catch {
      localOff.current = true;
      setPageAnalyticsAllowed(false);
      await recorder.current?.stop({withdraw: true});
      setMessage("Your browser could not save this choice. Optional recording is stopped on this page. Please try again or use your browser’s privacy settings.");
      setOpen(true);
    } finally { if (mounted.current) setBusy(false); }
  }
  const actions = <div className="experience-choice-actions">
    <button className="experience-choice" type="button" disabled={busy} onClick={() => void choose(NONE)}>Reject non-essential cookies</button>
    <button className="experience-choice" type="button" disabled={busy || blocked} onClick={() => void choose(ALL)}>Accept all cookies</button>
  </div>;
  const notice = <>
    {blocked && <p className="experience-privacy-status" role="status">Your browser sends a privacy signal. Optional analytics and recordings stay off.</p>}
    {message && <p className="experience-privacy-status" role="status">{message}</p>}
    {choice?.experience && state === "unavailable" && <p className="experience-privacy-status" role="status">Website recording is unavailable for this visit. You can use the website as usual.</p>}
  </>;
  return <div className="website-experience" data-experience-mask>
    {compact ? <section className="experience-inline" aria-label="Cookie settings">
      <h3>Cookie settings</h3><p role="status">{!ready ? "Loading your cookie choices…" : blocked ? "Optional cookies and recordings are off because of your browser’s privacy signal." : !choice ? "Only essential tools are allowed until you choose." : !choice.analytics && !choice.experience ? "Non-essential cookies and recordings are rejected." : `Analytics ${choice.analytics ? "allowed" : "off"}. Website recordings ${choice.experience ? "allowed" : "off"}.`}</p>
      <button className="button" type="button" onClick={manage} disabled={!ready}>Manage cookie choices</button>
    </section> : ready && choice === null && !open ? <aside className="experience-banner" data-experience-consent-open="true" aria-label="Cookies on SatinLore">
      <h2>Cookies on SatinLore</h2>
      <p className="experience-purpose">We use essential cookies to run the website. With your permission, analytics and website recordings help us improve it.</p>
      <p className="experience-detail">You can accept all cookies, reject non-essential cookies or choose below. Your choice does not affect joining the waitlist.</p>
      {notice}{actions}<button className="experience-manage" type="button" onClick={manage} disabled={busy}>Manage choices</button>
      <p className="experience-detail"><a href="/privacy#measurement-choices">Cookie and privacy information</a></p>
    </aside> : null}
    <dialog className="experience-dialog" ref={dialog} onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)} data-experience-consent-open={open ? "true" : undefined} aria-labelledby="experience-choices-heading">
      <header><h2 id="experience-choices-heading">Cookie settings</h2><button className="experience-close" type="button" aria-label="Close cookie settings" onClick={close}>×</button></header>
      <p className="experience-purpose">Choose which optional tools we may use. Essential tools keep the site secure and remember your choices.</p>
      {notice}
      <div className="cookie-categories">{COOKIE_CATEGORIES.map(category => <section className="cookie-category" key={category.id}>
        <label className="cookie-category-toggle"><span>{category.label}</span><input type="checkbox" checked={category.id === "essential" || draft[category.id as keyof Choices]} disabled={!category.optional || busy || blocked} onChange={event => { const checked = event.currentTarget.checked; if (category.id === "analytics" || category.id === "experience") setDraft(previous => ({...previous, [category.id]: checked})); }} aria-label={category.optional ? `Allow ${category.label.toLowerCase()}` : "Essential cookies, always on"} /></label>
        {!category.optional && <span className="cookie-category-required">Always on</span>}
        <p>{category.description}</p><p className="experience-detail">Provider: {category.provider}. {category.duration}</p>
      </section>)}</div>
      <p className="experience-detail">Website recordings reconstruct the public homepage as it appeared and changed. Typed text, form contents and private areas are masked. They do not capture other windows, camera or sound. Recording is separate from waitlist, news and research consent.</p>
      <p className="experience-detail">Your choice is remembered for 180 days without a visitor ID. You can change it using Privacy choices. New purposes are explained before they are enabled. <a href="/privacy#measurement-choices">Read the privacy information</a></p>
      {actions}<div className="experience-settings-actions"><button className="experience-choice" type="button" disabled={busy} onClick={() => void choose(draft)}>Save my choices</button><button className="experience-done" type="button" onClick={close}>Close</button></div>
    </dialog>
    {compact && message && <p className="experience-message" role="status">{message}</p>}
  </div>;
}
