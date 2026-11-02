"use client";

import {useEffect, useRef, useState} from "react";
import {browserPrivacyOff, createBrowserExperienceRecorder, OPEN_PRIVACY_EVENT, PRIVACY_EVENT,
  replayChoice, replayPreferenceCookie, type ExperienceRecorder, type ExperienceState} from "@/lib/experience-client";
import "./website-experience.css";

/** Separate opt-in for retained interaction replays, independent of waitlist/research consent. */
export default function WebsiteExperience({compact = false}: {compact?: boolean}) {
  const [choice, setChoice] = useState<"on" | "off" | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ExperienceState>("off");
  const [message, setMessage] = useState("");
  const recorder = useRef<ExperienceRecorder | null>(null);
  const mounted = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    const engine = createBrowserExperienceRecorder(value => { if (mounted.current) setState(value); });
    recorder.current = engine;
    const sync = () => {
      const next = replayChoice(document.cookie), off = browserPrivacyOff(navigator, document.cookie);
      setChoice(next); setBlocked(off); setReady(true);
      if (next === "on" && !off && location.pathname === "/") void engine.start();
      else if (engine.snapshot().canWithdraw) void engine.stop({withdraw: true});
    };
    const show = () => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOpen(true); };
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
  async function choose(next: "on" | "off") {
    // Stop locally before any network deletion, so withdrawal cannot leave capture active.
    const removal = next === "off" ? recorder.current?.stop({withdraw: true}) : null;
    document.cookie = replayPreferenceCookie(next, location.protocol === "https:");
    if (replayChoice(document.cookie) !== next) {
      setMessage("Your browser could not save this choice. Optional replay stays off for this visit.");
      if (next === "on") await recorder.current?.stop({withdraw: true});
      return;
    }
    setChoice(next); setMessage("");
    window.dispatchEvent(new Event(PRIVACY_EVENT));
    if (next === "off") {
      const removed = await removal;
      if (mounted.current) {
        setMessage(removed === false ? "Replay is off. We could not confirm removal of this visit’s earlier replay. Stored visits expire after 30 days." :
          "Replay is off. Any earlier visits that cannot be linked to this visit still expire after 30 days.");
        if (removed === false) { setOpen(true); return; }
      }
    }
    close();
  }
  const controls = <>
    <p className="experience-purpose">Allow us to replay clicks, scrolling and pointer movements on this homepage to improve it? We keep these visits for up to 30 days.</p>
    <p className="experience-detail">This is an interaction replay, not a screen video. We do not record what you type, form contents, camera or sound. Your choice does not affect joining the waitlist.</p>
    {blocked && <p className="experience-privacy-status" role="status">Replay is off because website measurement is disabled or your browser sends a privacy signal.</p>}
    {message && <p className="experience-privacy-status" role="status">{message}</p>}
    {choice === "on" && state === "unavailable" && <p className="experience-privacy-status" role="status">Optional replay is unavailable for this visit. You can use the website as usual.</p>}
    <div className="experience-choice-actions"><button className="experience-choice" type="button" onClick={() => void choose("off")}>No thanks</button><button className="experience-choice" type="button" disabled={blocked} onClick={() => void choose("on")}>Allow replay</button></div>
    <p className="experience-detail">You can change your mind using Privacy choices. A preference cookie remembers the choice for 180 days and contains no visitor ID. <a href="/privacy#measurement-choices">More privacy choices</a></p>
  </>;
  return <div className="website-experience" data-experience-mask>
    {compact ? <section className="experience-inline" aria-label="Optional interaction replay">
      <h3>Optional interaction replay</h3><p role="status">{!ready ? "Loading your replay choice…" : blocked ? "Replay is off because of your privacy choice or browser signal." : choice === "on" ? "Optional homepage replay is allowed in this browser." : "Optional replay is off."}</p>
      <button className="button" type="button" onClick={() => { opener.current = document.activeElement as HTMLElement; setOpen(true); }} disabled={!ready}>Manage replay choice</button>
    </section> : ready && choice === null && !blocked && !open ? <aside className="experience-banner" data-experience-consent-open="true" aria-label="Optional website replay"><h2>Help us improve this page?</h2>{controls}</aside> : null}
    <dialog className="experience-dialog" ref={dialog} onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)} data-experience-consent-open={open ? "true" : undefined} aria-labelledby="experience-choices-heading">
      <header><h2 id="experience-choices-heading">Your replay choice</h2><button className="experience-close" type="button" aria-label="Close privacy choices" onClick={close}>×</button></header>
      {controls}<button className="experience-done" type="button" onClick={close}>Close</button>
    </dialog>
    {compact && message && <p className="experience-message" role="status">{message}</p>}
  </div>;
}
