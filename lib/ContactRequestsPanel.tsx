"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CONTACT_STATUSES, type ContactInbox, type ContactRequest, type ContactStatus } from "@/lib/contact-requests";
import "./contact-requests.css";

const categories: Record<string, string> = { question: "Questions", partner: "Partnerships", privacy: "Privacy", delete: "Leave the list" };
const statuses: Record<ContactStatus, string> = { new: "New", read: "Read", in_progress: "In progress", resolved: "Resolved" };
function date(value: number) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });
}

export default function ContactRequestsPanel() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [inbox, setInbox] = useState<ContactInbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ q: search, category, status, sort, page: String(page), limit: "50" });
      const result = await fetch(`/api/admin/requests?${params}`, { cache: "no-store" });
      const data = await result.json() as ContactInbox & { error?: string };
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) setInbox(null);
        throw new Error(data.error || "We could not load enquiries.");
      }
      if (sequence === requestSequence.current) {
        setInbox(data);
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
        if (page > lastPage) setPage(lastPage);
      }
    } catch (cause) {
      if (sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [search, category, status, sort, page]);
  useEffect(() => { void load(); return () => { requestSequence.current++; }; }, [load]);

  function applySearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSearch(query.trim()); setPage(1); }
  async function changeStatus(request: ContactRequest, next: ContactStatus) {
    if (saving) return;
    setSaving(request.id); setError(""); setNotice("");
    try {
      const result = await fetch("/api/admin/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: request.id, status: next }) });
      const data = await result.json() as { error?: string };
      if (!result.ok) throw new Error(data.error || "We could not save this status.");
      setNotice(`Enquiry marked ${statuses[next].toLowerCase()}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setSaving(null); }
  }

  return <section className="contact-inbox" aria-label="Contact enquiries" aria-busy={loading}>
    <div className="inbox-status-counts" aria-label="Enquiry status counts">{CONTACT_STATUSES.map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(status === value ? "all" : value); setPage(1); }}><strong>{inbox?.counts[value] ?? "—"}</strong><span>{statuses[value]}</span></button>)}</div>
    <form className="inbox-filters" onSubmit={applySearch}>
      <label className="inbox-search">Search email or message<input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} placeholder="Find an enquiry" /></label>
      <button className="button" type="submit" disabled={loading}>Search</button>
      <label>Category<select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="all">All categories</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option>{CONTACT_STATUSES.map(value => <option key={value} value={value}>{statuses[value]}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <button className="text-button" type="button" disabled={loading} onClick={() => { setNotice(""); void load(); }}>Refresh</button>
    </form>
    <p className="inbox-help">Contact notes do not add someone to the waitlist or give marketing consent. Notes expire 30 days after submission, including resolved notes. Times shown are London time.</p>
    {error && <p role="alert" className="form-error">{error} <button type="button" className="text-button" onClick={() => void load()}>Try again</button></p>}
    {notice && <p role="status" className="inbox-notice">{notice}</p>}
    <div className="inbox-results-heading"><p aria-live="polite">{loading ? "Loading enquiries…" : `${inbox?.total ?? 0} matching ${inbox?.total === 1 ? "enquiry" : "enquiries"}`}</p><p>Page {page}</p></div>
    {!loading && !error && inbox && !inbox.requests.length && <div className="inbox-empty"><h2>No enquiries match.</h2><p>Try another search or clear the filters. New contact-form submissions appear here.</p><button type="button" className="text-button" onClick={() => { setQuery(""); setSearch(""); setCategory("all"); setStatus("all"); setPage(1); }}>Clear filters</button></div>}
    <div className="inbox-messages">{inbox?.requests.map(request => <article className={`inbox-message inbox-message-${request.status}`} key={request.id}>
      <header><div><span className="inbox-badge">{categories[request.category] || request.category}</span><span className={`inbox-state inbox-state-${request.status}`}>{statuses[request.status]}</span><h2>{request.email}</h2><p><time dateTime={new Date(request.created_at).toISOString()}>{date(request.created_at)}</time>{request.related_count > 1 && <span> · {request.related_count} active notes from this email</span>}</p></div>
        <label>Enquiry status<select aria-label={`Status for enquiry from ${request.email} at ${date(request.created_at)}`} value={request.status} disabled={!!saving || loading} onChange={event => void changeStatus(request, event.target.value as ContactStatus)}>{CONTACT_STATUSES.map(value => <option value={value} key={value}>{statuses[value]}</option>)}</select></label>
      </header>
      <p className="inbox-message-body">{request.message}</p>
      <footer><span>{request.updated_at ? `Status updated ${date(request.updated_at)}` : "Awaiting review"}</span>{request.status === "new" && <button type="button" className="text-button" disabled={!!saving || loading} onClick={() => void changeStatus(request, "read")}>{saving === request.id ? "Saving…" : "Mark as read"}</button>}</footer>
    </article>)}</div>
    <nav className="inbox-pagination" aria-label="Enquiry pages"><button type="button" className="button" disabled={loading || page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>{inbox?.total ? `${Math.min((page - 1) * inbox.pageSize + 1, inbox.total)}–${Math.min(page * inbox.pageSize, inbox.total)} of ${inbox.total}` : "0 enquiries"}</span><button type="button" className="button" disabled={loading || !inbox?.hasMore} onClick={() => setPage(page + 1)}>Next</button></nav>
  </section>;
}
