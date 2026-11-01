"use client";
import { useState } from "react";
import type { AnalyticsOverview } from "@/lib/site-analytics";

const metrics = [
  { key: "pageviews", label: "Page views", detail: "Public pages loaded", href: "#traffic-breakdown" },
  { key: "ctaClicks", label: "Waitlist CTA clicks", detail: "Clicks on join links", href: "#activity-trend" },
  { key: "signups", label: "Waitlist sign-ups", detail: "Distinct emails joined", href: "/admin/readers" },
  { key: "verified", label: "Emails confirmed", detail: "Ownership checked", href: "/admin/readers" },
  { key: "surveyResponses", label: "Questionnaires", detail: "Responses received", href: "/admin/readers" },
  { key: "contacts", label: "Contact messages", detail: "Notes received", href: "/admin/messages" },
] as const;
type MetricKey = typeof metrics[number]["key"];
const number = (value: number) => value.toLocaleString("en-GB");
function dayLabel(day: string) { return new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }); }
function Breakdown({ title, rows, empty, signup = false }: { title: string; rows: { label: string; count: number; signups?: number }[]; empty: string; signup?: boolean }) {
  const max = Math.max(1, ...rows.map(row => row.count));
  return <section className="admin-card admin-breakdown"><div className="admin-card-heading"><h2>{title}</h2><span>Page views{signup ? " / sign-ups" : ""}</span></div>{rows.length ? <ul>{rows.map(row => <li key={row.label}><div><strong>{row.label || "Direct / unknown"}</strong><span>{number(row.count)}{signup && row.signups !== undefined ? ` / ${number(row.signups)}` : ""}</span></div><div className="admin-bar-track" aria-hidden="true"><span style={{ width: `${row.count / max * 100}%` }} /></div></li>)}</ul> : <p className="admin-empty">{empty}</p>}</section>;
}
export default function AdminMetricsPanel({ data }: { data: AnalyticsOverview }) {
  const [metric, setMetric] = useState<MetricKey>("pageviews");
  const [selected, setSelected] = useState("");
  const active = metrics.find(item => item.key === metric)!;
  const max = Math.max(1, ...data.daily.map(day => day[metric]));
  const chosen = data.daily.find(day => day.day === selected);
  return <>
    <div className="admin-stat-grid">{metrics.map(item => <a className="admin-stat" href={item.href} key={item.key}><span>{item.label}</span><strong>{number(data.totals[item.key])}</strong><small>{item.detail} <span aria-hidden="true">↗</span></small></a>)}</div>
    <section className="admin-card admin-trend" id="activity-trend"><div className="admin-card-heading"><div><p className="admin-eyebrow">Activity over time</p><h2>See what is moving.</h2></div><label className="admin-field">Show<select value={metric} onChange={event => { setMetric(event.target.value as MetricKey); setSelected(""); }}>{metrics.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label></div>
      <p className="admin-chart-caption" role="status">{chosen ? `${dayLabel(chosen.day)}: ${number(chosen[metric])} ${active.label.toLowerCase()}.` : `${number(data.totals[metric])} ${active.label.toLowerCase()} in the last ${data.days} days. Choose a bar to inspect a day.`}</p>
      <div className="admin-chart-scroll"><div className="admin-chart" role="group" aria-label={`${active.label} per day`}>{data.daily.map(day => <button key={day.day} type="button" className={`admin-chart-day${selected === day.day ? " is-selected" : ""}`} onClick={() => setSelected(day.day)} aria-label={`${dayLabel(day.day)}: ${number(day[metric])} ${active.label.toLowerCase()}`} aria-pressed={selected === day.day} title={`${dayLabel(day.day)} · ${number(day[metric])}`}><span className="admin-chart-column"><span style={{ height: `${day[metric] / max * 100}%`, minHeight: day[metric] ? 3 : 0 }} /></span><span className="admin-chart-date">{dayLabel(day.day)}</span></button>)}</div></div>
      <p className="admin-note">These are actions in this period, not a journey tracked for each person. Page views and CTA clicks can repeat. Daily counts use UTC. Reader counts use retained records.</p>
    </section>
    <div className="admin-breakdown-grid" id="traffic-breakdown"><Breakdown title="Traffic sources" rows={data.sources} signup empty="Source totals will appear as visitors arrive." /><Breakdown title="Referrals" rows={data.referrers} empty="No referral activity recorded yet." /><Breakdown title="Devices" rows={data.devices} empty="Device totals will appear as visitors arrive." /><Breakdown title="Pages" rows={data.pages} empty="Page totals will appear as visitors arrive." /></div>
    <section className="admin-tracking-note"><h2>Simple, private measurement.</h2><p>Traffic tracking uses daily totals. It does not use analytics cookies or visitor IDs, and does not store IP addresses, email addresses or full referral links.</p><p>{data.trackingSince ? `Traffic data is available from ${new Date(data.trackingSince).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}.` : "Traffic recording starts with this release. Earlier visits cannot be recovered."} Browser privacy signals and common bots are excluded. Historical counts may fall as records expire; contact messages are retained for 30 days.</p></section>
  </>;
}
