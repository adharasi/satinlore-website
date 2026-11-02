"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ExperienceEvent, ExperienceSession } from "@/lib/website-experience";
import { fitViewport, replayAtForm, replayState } from "@/lib/experience-view";
import "./admin-experience.css";

const LAYOUT = "landing-20261102";
const sectionNames: Record<string, string> = { hero: "First impression", steps: "How it works", experience: "Story & rhythm", reading: "Reading pace", controls: "Personal controls", beta: "Beta programme", waitlist: "Waitlist", faq: "FAQs", footer: "Footer" };
type Heatmap = {
  points: { x: number; y: number; clicks: number; moves: number }[];
  sections: { key: string; visits: number; ms: number }[];
  scroll: { depth: number; sessions: number }[];
  coverage: { includedSessions: number; totalSessions: number; limit: number };
  layout: string;
};
type Overview = {
  days: number; from: number; retentionDays: number;
  summary: { sessions: number; clicks: number; visibleMs: number; averageDurationMs: number; averageMaxScroll: number };
  sessions: ExperienceSession[]; total: number; page: number; pageSize: number; hasMore: boolean; heatmap: Heatmap;
};
type Detail = { session: ExperienceSession; events: ExperienceEvent[]; incomplete: boolean };
type PreviewGeometry = { height: number; layout: string; sections: Record<string, { top: number; height: number }> };
type MapMode = "clicks" | "moves" | "time" | "scroll";
const integer = (value: number) => Math.max(0, Math.round(value)).toLocaleString("en-GB");
function duration(value: number) { const seconds = Math.max(0, Math.round(value / 1000)); return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`; }
function timestamp(value: number) { return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }); }
function elapsed(value: number) { const seconds = Math.floor(Math.max(0, value) / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
class AccessError extends Error {}
async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 403) throw new AccessError("Your sign-in needs checking. Reload this page through Cloudflare Access.");
  if (!response.headers.get("content-type")?.includes("application/json")) throw new AccessError("Your sign-in could not be checked. Reload this page through Cloudflare Access.");
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "The recordings could not be loaded. Please try again.");
  return data;
}

/** Public, masked markup only. Sandbox prevents scripts and form submission. */
function PagePreview({ width, height, fullPage = false, scroll = 0, expectedLayout = LAYOUT, events = [], at = 0, onGeometry, children }: {
  width: number; height: number; fullPage?: boolean; scroll?: number; expectedLayout?: string;
  events?: ExperienceEvent[]; at?: number; onGeometry?: (value: PreviewGeometry | null) => void; children?: (geometry: PreviewGeometry, scale: number) => React.ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement>(null);
  const [available, setAvailable] = useState(600);
  const [geometry, setGeometry] = useState<PreviewGeometry | null>(null);
  const [frameError, setFrameError] = useState("");
  const measure = useCallback(() => {
    try {
      const doc = frame.current?.contentDocument;
      const page = doc?.querySelector<HTMLElement>("[data-experience-layout]");
      if (!doc || !page) throw new Error();
      doc.documentElement.dataset.experiencePreview = fullPage ? "heatmap" : "replay";
      doc.documentElement.style.overflowY = "scroll";
      const sections: PreviewGeometry["sections"] = {};
      for (const section of doc.querySelectorAll<HTMLElement>("[data-experience-section]")) {
        const rect = section.getBoundingClientRect();
        sections[section.dataset.experienceSection || ""] = { top: rect.top + (doc.defaultView?.scrollY || 0), height: rect.height };
      }
      const result = { height: Math.max(height, doc.documentElement.scrollHeight, doc.body.scrollHeight), layout: page.dataset.experienceLayout || "", sections };
      setGeometry(previous => previous && JSON.stringify(previous) === JSON.stringify(result) ? previous : result);
      onGeometry?.(result); setFrameError("");
    } catch { setGeometry(null); onGeometry?.(null); setFrameError("The page preview is unavailable. Check your sign-in and reload."); }
  }, [height, onGeometry, fullPage]);
  useEffect(() => {
    const node = host.current; if (!node) return;
    const update = () => setAvailable(Math.max(1, node.clientWidth)); update();
    const observer = new ResizeObserver(update); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { measure(); }, [width, measure]);
  useEffect(() => {
    try {
      const doc = frame.current?.contentDocument; if (!doc || !geometry) return;
      // Only allowlisted public FAQ/menu state is reconstructed; no captured DOM is used.
      for (const item of doc.querySelectorAll<HTMLDetailsElement>("details[data-experience-faq]")) item.open = item.dataset.experienceFaq === "0";
      doc.querySelector("#nav")?.classList.remove("is-open");
      for (const event of events) {
        if (event.t > at) break;
        const toggle = event as ExperienceEvent & { k: string; target?: string; open?: boolean };
        if (toggle.k !== "toggle" || typeof toggle.open !== "boolean") continue;
        if (toggle.target === "menu") doc.querySelector("#nav")?.classList.toggle("is-open", toggle.open);
        else if (/^faq-[0-7]$/.test(toggle.target || "")) {
          const item = doc.querySelector<HTMLDetailsElement>(`details[data-experience-faq="${toggle.target!.slice(4)}"]`); if (item) item.open = toggle.open;
        }
      }
      const currentHeight = Math.max(height, doc.documentElement.scrollHeight, doc.body.scrollHeight);
      if (currentHeight !== geometry.height) measure();
      frame.current?.contentWindow?.scrollTo({ top: Math.max(0, currentHeight - height) * Math.max(0, Math.min(1000, scroll)) / 1000, left: 0, behavior: "instant" });
      const card = doc.querySelector<HTMLElement>("#beta-form"), floatingCta = doc.querySelector(".mobile-cta");
      if (!fullPage && card) floatingCta?.classList.toggle("is-at-form", replayAtForm(card.getBoundingClientRect(), { w: width, h: height }));
    } catch { /* A redirected or expired Access preview is never readable. */ }
  }, [scroll, geometry, width, height, events, at, measure, fullPage]);
  const sourceHeight = fullPage ? geometry?.height || height : height;
  const fit = fitViewport(width, sourceHeight, available, fullPage ? undefined : 620);
  const mismatch = !!geometry && geometry.layout !== expectedLayout;
  return <div ref={host} className={`experience-preview-host${fullPage ? " full-page" : ""}`}>
    {frameError ? <p role="alert" className="experience-preview-error">{frameError}</p> : null}
    {mismatch && <p role="alert" className="experience-preview-error">This recording uses an older page layout. The overlay is hidden to avoid showing a misleading position.</p>}
    <div className="experience-preview-scroll"><div className="experience-preview-stage" style={{ width: fit.width, height: fit.height }}>
      <iframe ref={frame} title={fullPage ? "Masked homepage heatmap preview" : "Masked homepage session replay"} src="/admin/experience/preview" sandbox="allow-same-origin" tabIndex={-1} inert aria-hidden="true" onLoad={measure} style={{ width, height: sourceHeight, transform: `scale(${fit.scale})` }} />
      {geometry && !mismatch && children?.(geometry, fit.scale)}
    </div></div>
  </div>;
}

function HeatmapView({ data, device }: { data: Heatmap; device: string }) {
  const [mode, setMode] = useState<MapMode>("clicks");
  const defaultWidth = device === "mobile" ? 390 : device === "tablet" ? 768 : 1440;
  const [width, setWidth] = useState(defaultWidth);
  useEffect(() => setWidth(defaultWidth), [defaultWidth]);
  const weighted = useMemo(() => data.points.map(point => ({ ...point, value: mode === "clicks" ? point.clicks : point.moves })).filter(point => point.value > 0).sort((a, b) => b.value - a.value).slice(0, 500), [data.points, mode]);
  const max = Math.max(1, ...weighted.map(point => point.value));
  const sectionMax = Math.max(1, ...data.sections.map(section => section.ms));
  return <section className="admin-card experience-map" aria-labelledby="experience-map-heading">
    <div className="admin-card-heading"><div><p className="admin-eyebrow">Heatmaps</p><h2 id="experience-map-heading">Where visitors spend time.</h2></div><label className="admin-field">Preview width<select value={width} onChange={event => setWidth(Number(event.target.value))}><option value="390">Phone · 390 px</option><option value="768">Tablet · 768 px</option><option value="1440">Desktop · 1440 px</option></select></label></div>
    <div className="experience-mode-tabs" role="group" aria-label="Heatmap view">{([["clicks", "Clicks"], ["moves", "Pointer movement"], ["time", "Time in view"], ["scroll", "Scroll reach"]] as const).map(([value, label]) => <button type="button" aria-pressed={mode === value} onClick={() => setMode(value)} key={value}>{label}</button>)}</div>
    <p className="admin-note experience-coverage">{integer(data.coverage.includedSessions)} of {integer(data.coverage.totalSessions)} eligible sessions shown{data.coverage.totalSessions > data.coverage.limit ? ` · most recent ${data.coverage.limit}` : ""}. {device === "all" ? "Choose a device type for a clearer comparison. " : ""}Coordinates are normalised; this is a reconstructed page, with form contents excluded. Fixed controls are hidden in this full-page map; their clicks can appear over page content. Inspect a replay to see those controls. {(mode === "clicks" || mode === "moves") && data.points.filter(point => (mode === "clicks" ? point.clicks : point.moves) > 0).length > 500 ? "The 500 strongest map cells are shown." : ""}</p>
    {!data.coverage.includedSessions ? <div className="experience-empty"><h3>No heatmap yet.</h3><p>Consenting homepage visits will build this view. Earlier visits cannot be recovered.</p></div> : <div className="experience-map-layout"><PagePreview width={width} height={900} fullPage expectedLayout={data.layout}>{(geometry, scale) => <div className="experience-heat-overlay" aria-hidden="true">
      {(mode === "clicks" || mode === "moves") && weighted.map((point, index) => <span key={`${point.x}-${point.y}-${index}`} className="experience-heat-dot" style={{ left: `${point.x / 10}%`, top: `${point.y / 10}%`, width: 22 + Math.sqrt(point.value / max) * 45, height: 22 + Math.sqrt(point.value / max) * 45, opacity: .25 + point.value / max * .65 }} />)}
      {mode === "time" && data.sections.map(section => { const area = geometry.sections[section.key]; return area && <div className="experience-time-band" key={section.key} style={{ top: area.top * scale, height: area.height * scale, opacity: .15 + section.ms / sectionMax * .65 }}><span>{sectionNames[section.key] || section.key} · {duration(section.ms)}</span></div>; })}
      {mode === "scroll" && data.scroll.map(row => <div className="experience-scroll-band" key={row.depth} style={{ top: `${Math.max(0, Math.min(99, row.depth))}%` }}><span>{row.depth}% reached · {integer(row.sessions)} sessions</span></div>)}
    </div>}</PagePreview><div className="experience-map-key">
      <h3>{mode === "time" ? "Time visible on screen" : mode === "scroll" ? "How far visitors reach" : mode === "clicks" ? "Click hotspots" : "Pointer movement"}</h3>
      <p>{mode === "time" ? "Visible page time can help compare sections. It does not prove that someone read or noticed the content." : mode === "scroll" ? "Look for the point where fewer sessions reach the next part of the page. This does not tell you why someone left." : mode === "clicks" ? "Brighter spots show more clicks. Repeated clicks can suggest a confusing control; inspect a replay before drawing a conclusion." : "Brighter spots show more pointer samples. Movement is not eye tracking, and touch visitors may have few samples."}</p>
      {(mode === "time" || mode === "scroll") ? <ul className="experience-section-list">{mode === "time" ? data.sections.map(row => <li key={row.key}><span>{sectionNames[row.key] || row.key}<small>{integer(row.visits)} session views</small></span><strong>{duration(row.ms)}</strong></li>) : data.scroll.map(row => <li key={row.depth}><span>Reached {row.depth}%</span><strong>{integer(row.sessions)}</strong></li>)}</ul> : <div className="experience-legend"><span className="experience-gradient" /><span>Fewer</span><span>More</span></div>}
      <p className="admin-note">No input values, messages, email addresses or research answers are recorded. Heatmaps use retained, opted-in sessions only.</p>
    </div></div>}
  </section>;
}

function ReplayView({ detail }: { detail: Detail }) {
  const [at, setAt] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1);
  const [geometry, setGeometry] = useState<PreviewGeometry | null>(null);
  const length = Math.max(0, Math.min(600000, detail.session.durationMs, Math.max(0, ...detail.events.map(event => event.t))));
  useEffect(() => { setAt(0); setPlaying(false); setGeometry(null); }, [detail.session.id]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = setInterval(() => { const now = performance.now(); const delta = Math.min(1000, now - last) * speed; last = now; setAt(value => { const next = Math.min(length, value + delta); if (next >= length) setPlaying(false); return next; }); }, 100);
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", hide);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", hide); };
  }, [playing, speed, length]);
  const snapshot = useMemo(() => replayState(detail.events, at, detail.session.viewport), [detail.events, detail.session.viewport, at]);
  const pointStyle = (point: { x: number; y: number }, scale: number, pageHeight: number): CSSProperties | null => {
    const top = point.y / 1000 * pageHeight - snapshot.scrollY / 1000 * Math.max(0, pageHeight - snapshot.viewport.h);
    const left = point.x / 1000 * snapshot.viewport.w;
    if (top < 0 || top > snapshot.viewport.h || left < 0 || left > snapshot.viewport.w) return null;
    return { left: left * scale, top: top * scale };
  };
  const clickEvents = detail.events.filter(event => event.k === "click");
  const mismatch = geometry && geometry.layout !== detail.session.layout;
  return <section className="experience-replay" aria-label="Session replay">
    <div className="experience-replay-heading"><div><h3>Reconstructed session replay</h3><p>{timestamp(detail.session.startedAt)} · {detail.session.device} · {detail.session.viewport.w} × {detail.session.viewport.h}</p></div><span className="experience-private-pill">Forms excluded</span></div>
    {detail.incomplete && <p className="experience-warning" role="status">Some batches did not arrive. This replay may have gaps.</p>}
    {mismatch && <p className="experience-warning" role="status">The page version has changed. Overlay positions are unavailable for this recording.</p>}
    <PagePreview width={snapshot.viewport.w} height={snapshot.viewport.h} scroll={snapshot.scrollY} expectedLayout={detail.session.layout} events={detail.events} at={at} onGeometry={setGeometry}>{(page, scale) => <div className="experience-replay-overlay" aria-hidden="true">
      {snapshot.visible && snapshot.pointer && (() => { const style = pointStyle(snapshot.pointer, scale, page.height); return style && <span className="experience-replay-pointer" style={style}><svg viewBox="0 0 24 28"><path d="M2 2v22l6-6 4 8 4-2-4-8 8-1z" /></svg></span>; })()}
      {snapshot.clicks.map((click, index) => { const style = pointStyle(click, scale, page.height); return style && <span key={`${click.t}-${index}`} className="experience-replay-click" style={{ ...style, opacity: 1 - click.ageMs / 600 }} />; })}
      {!snapshot.visible && <span className="experience-hidden-label">Visitor tab was hidden</span>}
    </div>}</PagePreview>
    <div className="experience-replay-controls"><button type="button" className="button" disabled={!length || !!mismatch || !geometry} onClick={() => { if (at >= length) setAt(0); setPlaying(value => !value); }}>{playing ? "Pause" : "Play"}</button><output>{elapsed(at)} / {elapsed(length)}</output><label>Speed<select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
    <label className="experience-scrubber">Replay position<input type="range" min="0" max={Math.max(1, length)} step="100" value={at} onChange={event => { setPlaying(false); setAt(Number(event.target.value)); }} disabled={!length} aria-valuetext={`${elapsed(at)} of ${elapsed(length)}`} /></label>
    {clickEvents.length > 0 && <div className="experience-event-markers" aria-label="Jump to a click">{clickEvents.slice(0, 30).map((event, index) => <button type="button" key={`${event.t}-${index}`} onClick={() => { setPlaying(false); setAt(event.t); }}>Click {index + 1}<span>{elapsed(event.t)}</span></button>)}</div>}
    <p className="admin-note">This replays shared clicks, movement and scrolling over the matching public page layout. It is not a screen recording, and it cannot show typed text, form answers or private pages.</p>
  </section>;
}

export default function AdminExperiencePanel() {
  const [days, setDays] = useState("7"), [device, setDevice] = useState("all"), [page, setPage] = useState(1);
  const [data, setData] = useState<Overview | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null), [detail, setDetail] = useState<Detail | null>(null), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState("");
  const [deleting, setDeleting] = useState(false), [notice, setNotice] = useState("");
  const sequence = useRef(0), detailSequence = useRef(0);
  const load = useCallback(async () => {
    const next = ++sequence.current; setLoading(true); setError(""); setData(null);
    try {
      const response = await fetch(`/api/admin/experience?${new URLSearchParams({ days, device, page: String(page) })}`, { cache: "no-store", headers: { "X-Requested-With": "XMLHttpRequest" } });
      const result = await readResponse<Overview>(response);
      if (next === sequence.current) { setData(result); if (page > 1 && !result.sessions.length) setPage(Math.max(1, Math.ceil(result.total / result.pageSize))); }
    } catch (cause) { if (next === sequence.current) { setError(cause instanceof Error ? cause.message : "Could not load website activity."); setSelected(null); setDetail(null); } }
    finally { if (next === sequence.current) setLoading(false); }
  }, [days, device, page]);
  useEffect(() => { void load(); return () => { sequence.current++; }; }, [load]);
  useEffect(() => { setSelected(null); setDetail(null); setDetailError(""); }, [days, device]);
  useEffect(() => {
    const next = ++detailSequence.current;
    if (!selected) { setDetail(null); setDetailLoading(false); return; }
    setDetailLoading(true); setDetailError(""); setDetail(null);
    void (async () => {
      try {
        const response = await fetch(`/api/admin/experience?id=${encodeURIComponent(selected)}`, { cache: "no-store", headers: { "X-Requested-With": "XMLHttpRequest" } });
        const result = await readResponse<Detail>(response);
        if (next === detailSequence.current) setDetail(result);
      } catch (cause) { if (next === detailSequence.current) { setDetailError(cause instanceof Error ? cause.message : "Could not load this replay."); if (cause instanceof AccessError) { setData(null); setSelected(null); setDetail(null); setError(cause.message); } } }
      finally { if (next === detailSequence.current) setDetailLoading(false); }
    })();
    return () => { detailSequence.current++; };
  }, [selected]);
  async function removeSelected() {
    if (!selected || deleting || !confirm("Delete this recording and its heatmap contributions? This cannot be undone.")) return;
    setDeleting(true); setDetailError("");
    try {
      const response = await fetch("/api/admin/experience", { method: "DELETE", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ id: selected }) });
      const result = await readResponse<{ deleted: boolean }>(response);
      setSelected(null); setDetail(null); setNotice(result.deleted ? "Recording removed, including its heatmap contributions." : "This recording has already expired or been removed."); await load();
    } catch (cause) { setDetailError(cause instanceof Error ? cause.message : "The recording could not be removed."); if (cause instanceof AccessError) { setData(null); setSelected(null); setDetail(null); setError(cause.message); } }
    finally { setDeleting(false); }
  }
  return <div className="experience-dashboard">
    <div className="admin-toolbar"><div className="experience-filters"><label className="admin-field">Date range<select value={days} onChange={event => { setDays(event.target.value); setPage(1); }}><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option></select></label><label className="admin-field">Device<select value={device} onChange={event => { setDevice(event.target.value); setPage(1); }}><option value="all">All devices</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select></label></div><button type="button" className="button" disabled={loading} onClick={() => void load()}>Refresh activity</button></div>
    {notice && <p className="experience-notice" role="status">{notice}</p>}
    {error && <div className="experience-error" role="alert"><p>{error}</p><button type="button" className="button" onClick={() => void load()}>Try again</button></div>}
    {loading && <p className="admin-empty" role="status">Loading shared website activity…</p>}
    {data && <>
      <div className="admin-stat-grid experience-stats"><div className="admin-stat"><span>Shared sessions</span><strong>{integer(data.summary.sessions)}</strong><small>Visitors who opted in</small></div><div className="admin-stat"><span>Clicks</span><strong>{integer(data.summary.clicks)}</strong><small>Outside form contents</small></div><div className="admin-stat"><span>Average session</span><strong>{duration(data.summary.averageDurationMs)}</strong><small>Recorded timeline length</small></div><div className="admin-stat"><span>Average scroll reach</span><strong>{Math.round(data.summary.averageMaxScroll)}%</strong><small>Of available scrolling</small></div></div>
      <HeatmapView data={data.heatmap} device={device} />
      <section className="admin-card experience-sessions" aria-labelledby="experience-sessions-heading"><div className="admin-card-heading"><div><p className="admin-eyebrow">Session replays</p><h2 id="experience-sessions-heading">Watch the journey.</h2></div><span>{integer(data.total)} retained sessions</span></div>
        {!data.sessions.length ? <div className="experience-empty"><h3>No shared sessions yet.</h3><p>Visitors can allow replays from the homepage privacy choice. Refusing does not affect the waitlist.</p></div> : <><div className="experience-session-list">{data.sessions.map(session => <button key={session.id} type="button" className={`experience-session-row${selected === session.id ? " is-selected" : ""}`} onClick={() => setSelected(session.id)} aria-pressed={selected === session.id}><span><strong>{timestamp(session.startedAt)}</strong><small>{session.device} · {session.viewport.w} × {session.viewport.h}</small></span><span><strong>{duration(session.durationMs)}</strong><small>{integer(session.clicks)} clicks · {Math.round(session.maxScroll)}% scroll</small></span><span aria-hidden="true">Play ↗</span></button>)}</div><div className="experience-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><span>Page {data.page}</span><button type="button" disabled={!data.hasMore || loading} onClick={() => setPage(value => value + 1)}>Next</button></div></>}
        {detailLoading && <p role="status" className="admin-empty">Loading this replay…</p>}
        {detailError && <p role="alert" className="experience-error">{detailError}</p>}
        {detail && <><ReplayView detail={detail} /><div className="experience-delete-row"><p className="admin-note">Retained until {new Date(detail.session.expiresAt).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}.</p><button type="button" className="experience-delete" disabled={deleting} onClick={() => void removeSelected()}>{deleting ? "Removing…" : "Delete recording"}</button></div></>}
      </section>
      <section className="admin-tracking-note"><h2>Understand patterns, without reading private details.</h2><p>These views cover opted-in homepage sessions retained for up to {data.retentionDays} days. They are separate from daily unique-visitor estimates, waitlist records and research answers. A session is not a distinct person. Time in view, pointer activity and repeated clicks are clues to investigate; they do not prove attention or explain why a person left.</p><p>Each replay is limited to ten minutes. Browser privacy signals, visitors who decline, unsupported browsers and missing batches can reduce coverage. No camera, microphone, screen video, input text, private link or form answer is captured.</p></section>
    </>}
  </div>;
}
