"use client";
import { useState } from "react";
import type { AnalyticsOverview } from "@/lib/site-analytics";

const metrics = [
  { key: "pageviews", label: "Page views", detail: "Public pages loaded", href: "#traffic-breakdown" },
  { key: "uniqueVisitors", label: "Daily unique visitors", detail: "Estimates summed across days", href: "#activity-trend" },
  { key: "uniquePageviews", label: "Daily unique page views", detail: "Once per page, each day", href: "#traffic-breakdown" },
  { key: "ctaClicks", label: "Waitlist CTA clicks", detail: "Clicks on join links", href: "#activity-trend" },
  { key: "signups", label: "Waitlist sign-ups", detail: "Distinct emails joined", href: "/admin/readers" },
  { key: "verified", label: "Emails confirmed", detail: "Ownership checked", href: "/admin/readers" },
  { key: "surveyResponses", label: "Questionnaires", detail: "Responses received", href: "/admin/readers" },
  { key: "contacts", label: "Contact messages", detail: "Notes received", href: "/admin/messages" },
] as const;
type MetricKey = typeof metrics[number]["key"];
const number = (value: number) => value.toLocaleString("en-GB");
function dayLabel(day: string) { return new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }); }
function Breakdown({ title, rows, empty, signup = false, unique = false }: { title: string; rows: { label: string; count: number; signups?: number; uniqueViews?: number }[]; empty: string; signup?: boolean; unique?: boolean }) {
  const max = Math.max(1, ...rows.map(row => row.count));
  return <section className="admin-card admin-breakdown"><div className="admin-card-heading"><h2>{title}</h2><span>Page views{signup ? " / sign-ups" : unique ? " / daily uniques" : ""}</span></div>{rows.length ? <ul>{rows.map(row => <li key={row.label}><div><strong>{row.label || "Direct / unknown"}</strong><span>{number(row.count)}{signup && row.signups !== undefined ? ` / ${number(row.signups)}` : unique && row.uniqueViews !== undefined ? ` / ${number(row.uniqueViews)}` : ""}</span></div><div className="admin-bar-track" aria-hidden="true"><span style={{ width: `${row.count / max * 100}%` }} /></div></li>)}</ul> : <p className="admin-empty">{empty}</p>}{unique && <p className="admin-note">Daily estimates summed across this period. A visitor can count on several pages.</p>}</section>;
}
export default function AdminMetricsPanel({ data }: { data: AnalyticsOverview }) {
  const [metric, setMetric] = useState<MetricKey>("pageviews");
  const [selected, setSelected] = useState("");
  const active = metrics.find(item => item.key === metric)!;
  const max = Math.max(1, ...data.daily.map(day => day[metric]));
  const chosen = data.daily.find(day => day.day === selected);
  const uniqueMetric = metric === "uniqueVisitors" || metric === "uniquePageviews";
  return <>
    <div className="admin-stat-grid admin-overview-stats">{metrics.map(item => <a className="admin-stat" href={item.href} key={item.key}><span>{item.label}</span><strong>{number(data.totals[item.key])}</strong><small>{item.detail} <span aria-hidden="true">↗</span></small></a>)}</div>
    <section className="admin-card admin-trend" id="activity-trend"><div className="admin-card-heading"><div><p className="admin-eyebrow">Activity over time</p><h2>See what is moving.</h2></div><label className="admin-field">Show<select value={metric} onChange={event => { setMetric(event.target.value as MetricKey); setSelected(""); }}>{metrics.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label></div>
      <p className="admin-chart-caption" role="status">{chosen ? `${dayLabel(chosen.day)}: ${number(chosen[metric])} ${active.label.toLowerCase()}.` : `${number(data.totals[metric])} ${active.label.toLowerCase()}${uniqueMetric ? ", summed across" : " in"} the last ${data.days} days. Choose a bar to inspect a day.`}</p>
      <div className="admin-chart-scroll"><div className="admin-chart" role="group" aria-label={`${active.label} per day`}>{data.daily.map(day => <button key={day.day} type="button" className={`admin-chart-day${selected === day.day ? " is-selected" : ""}`} onClick={() => setSelected(day.day)} aria-label={`${dayLabel(day.day)}: ${number(day[metric])} ${active.label.toLowerCase()}`} aria-pressed={selected === day.day} title={`${dayLabel(day.day)} · ${number(day[metric])}`}><span className="admin-chart-column"><span style={{ height: `${day[metric] / max * 100}%`, minHeight: day[metric] ? 3 : 0 }} /></span><span className="admin-chart-date">{dayLabel(day.day)}</span></button>)}</div></div>
      <p className="admin-note">Daily unique visitors estimate browsers once per UTC day; daily unique page views count each page once per day. Period totals add those daily estimates, so they are not unique people over {data.days} days. Shared networks and changes of browser or network can affect estimates. Page views and CTA clicks can repeat. Reader counts use retained records.</p>
    </section>
    <div className="admin-breakdown-grid" id="traffic-breakdown"><Breakdown title="Traffic sources" rows={data.sources} signup empty="Source totals will appear as visitors arrive." /><Breakdown title="Referrals" rows={data.referrers} empty="No referral activity recorded yet." /><Breakdown title="Devices" rows={data.devices} empty="Device totals will appear as visitors arrive." /><Breakdown title="Pages" rows={data.pages} unique empty="Page totals will appear as visitors arrive." /></div>
    <section className="admin-tracking-note"><h2>Simple, private measurement.</h2><p>Daily totals are kept for up to 90 days. Unique estimates use protected daily codes that expire just after UTC midnight; there are no analytics cookies or lasting visitor IDs. Raw network addresses, full browser strings, email addresses and private referral links are not stored in measurement records. Daily unique estimates start with this update; earlier unique visits cannot be recovered.</p><p>{data.trackingSince ? `Traffic data is available from ${new Date(data.trackingSince).toLocaleDateString("en-GB", { timeZone: "UTC" })}.` : "Traffic recording starts with the first eligible public visit. Earlier visits cannot be recovered."} Browser privacy signals and common bots are excluded. Historical counts may fall as records expire; contact messages are retained for 30 days.</p></section>
  </>;
}
