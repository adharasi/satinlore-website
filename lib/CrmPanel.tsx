"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CRM_STAGES, type CrmStage } from "@/lib/crm-validation";

export type CrmContact = {
  id: string;
  first_name: string | null;
  email: string;
  email_verified: number;
  email_state: string;
  founder_alert_state: string;
  founder_notified_at: number | null;
  model: string | null;
  phone: string | null;
  interest: string | null;
  source: string;
  newsletter: number;
  consent_version: string;
  created_at: number;
  confirmed_at: number | null;
  stage: CrmStage;
  notes: string;
  updated_at: number | null;
};

const stageLabels: Record<CrmStage, string> = { new: "New", contacted: "Contacted", invited: "Invited", testing: "Testing", completed: "Completed", blocked: "Blocked" };
function date(value: number | null) { return value ? new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "—"; }

export default function CrmPanel({ initialContacts }: { initialContacts: CrmContact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [stage, setStage] = useState<CrmStage>("new");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = contacts.find(contact => contact.id === selectedId);
  const visible = useMemo(() => contacts.filter(contact => {
    const term = search.trim().toLowerCase();
    return (!term || [contact.first_name, contact.email, contact.model, contact.phone, contact.source, contact.notes].some(value => value?.toLowerCase().includes(term)))
      && (filter === "all" || (filter === "checked" ? !!contact.email_verified : !contact.email_verified))
      && (stageFilter === "all" || contact.stage === stageFilter);
  }), [contacts, search, filter, stageFilter]);

  function edit(contact: CrmContact) {
    setSelectedId(contact.id); setStage(contact.stage); setNotes(contact.notes); setMessage(""); setError("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const result = await fetch("/api/admin/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, stage, notes }) });
      const data = await result.json() as { error?: string; contact?: { stage: CrmStage; notes: string; updated_at: number } };
      if (!result.ok || !data.contact) throw new Error(data.error || "Could not save this reader’s notes.");
      const saved = data.contact;
      setContacts(current => current.map(contact => contact.email === selected.email ? { ...contact, ...saved } : contact));
      setNotes(saved.notes); setMessage("Stage and notes saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <section>
    <h2>Your reader CRM</h2>
    <p>One row per email. Checked entries take priority over later unchecked requests. The latest 250 readers are shown here; exports include all current readers.</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, margin: "22px 0" }}>
      <label className="field">Find a reader<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, toy, source or note" /></label>
      <label className="field">Email status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All readers</option><option value="checked">Checked emails</option><option value="waiting">Not checked yet</option></select></label>
      <label className="field">CRM stage<select value={stageFilter} onChange={event => setStageFilter(event.target.value)}><option value="all">All stages</option>{CRM_STAGES.map(value => <option key={value} value={value}>{stageLabels[value]}</option>)}</select></label>
    </div>
    {selected && <form onSubmit={save} style={{ padding: 20, background: "#fffdf8", border: "1px solid #d9c9be", borderRadius: 8, marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Notes for {selected.first_name || "this reader"}</h3>
      <p>{selected.email} · {selected.email_verified ? "Email checked" : "Email not checked"}</p>
      <p>Joined: {date(selected.created_at)} · Checked: {date(selected.confirmed_at)}<br />Consent record: {selected.consent_version} · Tips and offers: {selected.newsletter ? "Opted in" : "Not opted in"}</p>
      <label className="field">Stage<select value={stage} onChange={event => setStage(event.target.value as CrmStage)}>{CRM_STAGES.map(value => <option key={value} value={value}>{stageLabels[value]}</option>)}</select></label>
      <label className="field">Private notes<textarea rows={4} value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} placeholder="For example: Asked for a demo; follow up next week." /></label>
      <p>Use these notes for contact and test admin only. Do not add stories, sexual preferences, payment details or other intimate information. A CRM stage does not change consent or email verification. Use Blocked after a hard bounce, complaint or request to stop contact. Blocked readers are left out of the checked-reader export.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save stage and notes"}</button><button className="text-button" type="button" disabled={busy} onClick={() => { setSelectedId(""); setError(""); setMessage(""); }}>Close notes</button></div>
      {message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    </form>}
    <p role="status">{visible.length} {visible.length === 1 ? "reader" : "readers"} shown.</p>
    <div style={{ overflowX: "auto" }}><table><thead><tr>{["Reader", "Email state", "Toy / phone", "Source / interest", "Stage", "Joined", "Notes"].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{visible.map(contact => <tr key={contact.id}>
        <td><strong>{contact.first_name || "—"}</strong><br />{contact.email}</td>
        <td>{contact.email_verified ? "Checked" : contact.email_state || "Waiting"}<br /><small>Founder alert: {contact.founder_alert_state === "sent" ? "Accepted by SES" : contact.founder_alert_state}</small></td>
        <td>{contact.model || "Not shared"}<br />{contact.phone || "Not shared"}</td>
        <td>{contact.source}<br />{contact.interest || "Not shared"}</td>
        <td>{stageLabels[contact.stage] || "New"}</td>
        <td style={{ whiteSpace: "nowrap" }}>{new Date(contact.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</td>
        <td><button className="text-button" type="button" onClick={() => edit(contact)} aria-label={`Edit notes for ${contact.email}`}>Edit notes{contact.notes ? " · saved" : ""}</button></td>
      </tr>)}</tbody>
    </table></div>
    {!contacts.length && <p>No readers yet. New sign-ups will appear here once the form is used.</p>}
    {!!contacts.length && !visible.length && <p>No readers match these filters.</p>}
  </section>;
}
