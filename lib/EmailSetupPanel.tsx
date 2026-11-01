"use client";
import { useState } from "react";
type SendingStatus = { configured?: boolean; sendingEnabled?: boolean; productionAccessEnabled?: boolean; identityVerified?: boolean; error?: string };
export default function EmailSetupPanel({ sendingEnabled, surveyEnabled, welcomeEnabled }: { sendingEnabled: boolean; surveyEnabled: boolean; welcomeEnabled: boolean }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SendingStatus | null>(null);
  const [busy, setBusy] = useState(false);
  async function check() {
    if (busy) return;
    setBusy(true); setError(""); setMessage(""); setStatus(null);
    try {
      const result = await fetch("/api/admin/email-status", { cache: "no-store" });
      const data = await result.json() as SendingStatus;
      if (!result.ok) throw new Error(data.error || "The sending check could not finish.");
      setStatus(data); setMessage(data.configured && data.sendingEnabled && data.productionAccessEnabled && data.identityVerified ? "Sender checks passed. Email is ready to send." : "One or more sender checks need attention. Review the status below.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function send(path: string) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ send: true }) });
      const data = await result.json() as { error?: string; sent?: number; failed?: number };
      if (!result.ok) throw new Error(data.error || "The batch could not finish.");
      setMessage(`Accepted: ${data.sent || 0}. Failed: ${data.failed || 0}. Use the button again for the next batch of up to five.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <>
    <section className="admin-card"><div className="admin-card-heading"><div><p className="admin-eyebrow">Current operations</p><h2>Email flows</h2></div><button type="button" className="button" disabled={busy} onClick={check}>{busy ? "Working…" : "Check sender status"}</button></div><ul className="admin-flow-list"><li><div><strong>Inbox confirmation & founder alerts</strong><span>New waitlist sign-ups use the existing confirmation flow.</span></div><span className={`admin-pill ${sendingEnabled ? "is-on" : ""}`}>{sendingEnabled ? "Enabled" : "Paused"}</span></li><li><div><strong>Questionnaire invitation</strong><span>Queued five minutes after verification; checked each minute.</span></div><span className={`admin-pill ${sendingEnabled && surveyEnabled ? "is-on" : ""}`}>{sendingEnabled && surveyEnabled ? "Enabled" : "Paused"}</span></li><li><div><strong>Immediate welcome email</strong><span>Separate from the delayed questionnaire invitation.</span></div><span className={`admin-pill ${welcomeEnabled ? "is-on" : ""}`}>{welcomeEnabled ? "Enabled" : "Off"}</span></li></ul>
    {status && <dl className="admin-sender-checks">{[["Sender configuration", status.configured], ["Account sending", status.sendingEnabled], ["Production access", status.productionAccessEnabled], ["Sender verified", status.identityVerified]].map(([label, ready]) => <div key={String(label)}><dt>{label}</dt><dd>{ready ? "Passed" : "Needs attention"}</dd></div>)}</dl>}{message && <p className="admin-feedback" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}</section>
    <section className="admin-card"><h2>Recover waiting messages</h2><p className="admin-muted">These buttons send a batch of up to five eligible messages. Use them only when you want to retry waiting confirmations or founder alerts.</p><div className="admin-action-row"><button type="button" className="button" disabled={busy} onClick={() => send("/api/admin/send-pending")}>Send waiting confirmations</button><button type="button" className="button" disabled={busy} onClick={() => send("/api/admin/send-alerts")}>Send queued founder alerts</button></div><p className="admin-note">Accepted means the email provider accepted the message; it does not prove inbox delivery. Questionnaire invitation retries run automatically. Founder-alert retries use the button above.</p></section>
  </>;
}
