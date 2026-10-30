"use client";

import { useMemo, useState, type FormEvent } from "react";
import { SURVEY_FIELDS, type SurveyAnswers } from "@/lib/survey";
import { CRM_STAGES, type CrmStage } from "@/lib/crm-validation";

export type CrmContact = {
  id: string;
  waitlist_id: string | null;
  survey_response_id: string | null;
  survey_submitted_at: number | null;
  survey_received_at: number | null;
  survey_schema_version: string | null;
  survey_answers_json: string | null;
  survey_sensitive_consent: number | null;
  survey_contact_consent: number | null;
  survey_marketing_consent: number | null;
  survey_prize_draw: number | null;
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
  marketing_suppressed: boolean;
  consent_version: string | null;
  created_at: number;
  confirmed_at: number | null;
  stage: CrmStage;
  notes: string;
  updated_at: number | null;
};

const stageLabels: Record<CrmStage, string> = { new: "New", contacted: "Contacted", invited: "Invited", testing: "Testing", completed: "Completed", blocked: "Blocked" };
function surveyAnswers(contact: CrmContact): SurveyAnswers {
  try { return contact.survey_answers_json ? JSON.parse(contact.survey_answers_json) as SurveyAnswers : {}; } catch { return {}; }
}
function date(value: number | null) { return value ? new Date(value).toLocaleString("en-GB", { timeZone: "Europe/London" }) : "—"; }

export default function CrmPanel({ initialContacts }: { initialContacts: CrmContact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [surveyFilter, setSurveyFilter] = useState("all");
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
      && (surveyFilter === "all" || (surveyFilter === "done" ? !!contact.survey_response_id : surveyFilter === "missing" ? !contact.survey_response_id : !contact.waitlist_id))
      && (stageFilter === "all" || contact.stage === stageFilter);
  }), [contacts, search, filter, surveyFilter, stageFilter]);

  function edit(contact: CrmContact) {
    setSelectedId(contact.id); setStage(contact.stage); setNotes(contact.notes); setMessage(""); setError("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const result = await fetch("/api/admin/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, kind: selected.waitlist_id ? "waitlist" : "survey", stage, notes }) });
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
    <p>One row per email, with the waitlist and the latest survey joined together. Survey-only readers keep their own row until they join the waitlist with the same address. The latest 250 readers are shown. Email checks and each kind of consent stay separate.</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, margin: "22px 0" }}>
      <label className="field">Find a reader<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, toy, source or note" /></label>
      <label className="field">Email status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All readers</option><option value="checked">Checked emails</option><option value="waiting">Not checked yet</option></select></label>
      <label className="field">Survey<select value={surveyFilter} onChange={event => setSurveyFilter(event.target.value)}><option value="all">All readers</option><option value="done">Survey received</option><option value="missing">No survey yet</option><option value="surveyOnly">Survey only</option></select></label>
      <label className="field">CRM stage<select value={stageFilter} onChange={event => setStageFilter(event.target.value)}><option value="all">All stages</option>{CRM_STAGES.map(value => <option key={value} value={value}>{stageLabels[value]}</option>)}</select></label>
    </div>
    {selected && <form onSubmit={save} style={{ padding: 20, background: "#fffdf8", border: "1px solid #d9c9be", borderRadius: 8, marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Reader details for {selected.first_name || "this reader"}</h3>
      <p>{selected.email} · {selected.email_verified ? "Email checked" : "Email not checked"}</p>
      <p>Waitlist: {selected.waitlist_id ? "Joined" : "Not joined"} · Checked: {date(selected.confirmed_at)}<br />Waitlist consent record: {selected.consent_version || "None"} · Waitlist tips and offers: {selected.marketing_suppressed ? "Suppressed by email opt-out" : selected.newsletter ? "Opted in" : "Not opted in"}</p>
      {selected.survey_response_id && <section aria-label="Questionnaire response" style={{ borderTop: "1px solid #d9c9be", paddingTop: 14, marginBottom: 24 }}>
        <h3>Questionnaire</h3><p>Submitted: {date(selected.survey_submitted_at)} · Form version: {selected.survey_schema_version}</p>
        <p>Story and toy consent: {selected.survey_sensitive_consent ? "Yes" : "No"}<br />Research and test emails: {selected.survey_contact_consent ? "Yes" : "No"}<br />Survey news and launch offers: {selected.marketing_suppressed ? "Suppressed by email opt-out" : selected.survey_marketing_consent ? "Yes" : "No"}<br />Cash draw entry: {selected.survey_prize_draw ? "Yes" : "No"}</p>
        {selected.marketing_suppressed && <p>An email opt-out overrides saved news checkbox choices. Survey retries cannot remove this opt-out. Research contact and draw entry stay separate.</p>}
        <p>Send survey changes or withdrawal requests to team@satinlore.com so they can be handled against the right record. Research consent and draw entry are handled apart.</p><p>A survey email address is self-reported. Use the checked status above to see if ownership was confirmed. Consent to research emails is separate from launch offers.</p>
        <details><summary>View reading and test answers</summary><dl style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: "10px 18px" }}>{SURVEY_FIELDS.filter(field => !["email", "adult", "sensitiveConsent", "contactConsent", "marketingConsent", "prizeDraw"].includes(field.key)).map(field => {
          if ("sensitive" in field && field.sensitive && !selected.survey_sensitive_consent) return null;
          const value = surveyAnswers(selected)[field.key];
          return <div key={field.key} style={{ display: "contents" }}><dt style={{ overflowWrap: "anywhere" }}>{field.label}{"sensitive" in field && field.sensitive ? " (private research)" : ""}</dt><dd style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{Array.isArray(value) ? value.join(", ") || "Not shared" : value || "Not shared"}</dd></div>;
        })}</dl></details>
      </section>}
      {!selected.survey_response_id && <p>No questionnaire received for this address yet.</p>}
      <label className="field">Stage<select value={stage} onChange={event => setStage(event.target.value as CrmStage)}>{CRM_STAGES.map(value => <option key={value} value={value}>{stageLabels[value]}</option>)}</select></label>
      <label className="field">Private notes<textarea rows={4} value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} placeholder="For example: Asked for a demo; follow up next week." /></label>
      <p>Use these notes for contact and test admin only. Do not add stories, sexual preferences, payment details or other intimate information. A CRM stage does not change consent or email verification. Use Blocked after a hard bounce, complaint or request to stop contact. Blocked readers are left out of the checked-reader export.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save stage and notes"}</button><button className="text-button" type="button" disabled={busy} onClick={() => { setSelectedId(""); setError(""); setMessage(""); }}>Close notes</button></div>
      {message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
    </form>}
    <p role="status">{visible.length} {visible.length === 1 ? "reader" : "readers"} shown.</p>
    <div style={{ overflowX: "auto" }}><table><thead><tr>{["Reader", "Email state", "Toy / phone", "Source / interest", "Survey", "Stage", "Joined", "Notes"].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{visible.map(contact => <tr key={contact.id}>
        <td><strong>{contact.first_name || "—"}</strong><br />{contact.email}</td>
        <td>{contact.email_verified ? "Checked" : contact.waitlist_id ? contact.email_state || "Waiting" : "Not checked (survey only)"}{contact.waitlist_id && <><br /><small>Founder alert: {contact.founder_alert_state === "sent" ? "Accepted by SES" : contact.founder_alert_state}</small></>}</td>
        <td>{contact.model || "Not shared"}<br />{contact.phone || "Not shared"}</td>
        <td>{contact.source}<br />{contact.interest || "Not shared"}</td>
        <td>{contact.survey_response_id ? "Received" : "Not yet"}<br /><small>{contact.survey_response_id ? `Test emails: ${contact.survey_contact_consent ? "Yes" : "No"}` : ""}</small></td>
        <td>{stageLabels[contact.stage] || "New"}</td>
        <td style={{ whiteSpace: "nowrap" }}>{new Date(contact.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</td>
        <td><button className="text-button" type="button" onClick={() => edit(contact)} aria-label={`Edit notes for ${contact.email}`}>View / edit{contact.notes ? " · saved" : ""}</button></td>
      </tr>)}</tbody>
    </table></div>
    {!contacts.length && <p>No readers yet. Waitlist sign-ups and synced questionnaires will appear here.</p>}
    {!!contacts.length && !visible.length && <p>No readers match these filters.</p>}
  </section>;
}
