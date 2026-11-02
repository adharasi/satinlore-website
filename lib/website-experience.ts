/** Consent-based, first-party homepage replay. The schema cannot accept form text or identity. */
export const EXPERIENCE_LAYOUT = "landing-20261102";
export const EXPERIENCE_CONSENT_VERSION = "replay-2026-11-02";
export const EXPERIENCE_SECTIONS = ["hero", "steps", "experience", "reading", "controls", "beta", "waitlist", "faq", "footer"] as const;
export const EXPERIENCE_RETENTION_DAYS = 30;
export const EXPERIENCE_MAX_DURATION = 600_000;
export const EXPERIENCE_MAX_EVENTS = 3_000;
export const EXPERIENCE_MAX_BATCHES = 120;
export const EXPERIENCE_BATCH_EVENTS = 64;
export const EXPERIENCE_BODY_BYTES = 20_000;
const DAY = 86_400_000;
const SESSION_COLUMNS = "id,layout,started_at,last_seen_at,expires_at,viewport_width,viewport_height,document_height,device,duration_ms,clicks,max_scroll,visible_ms,event_count";
const TOKEN = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const BOT = /bot\b|crawler|spider|slurp|preview|headless|curl\/|wget\/|python-requests|monitoring|uptimerobot|facebookexternalhit|lighthouse/i;
export type ExperienceViewport = { w: number; h: number; dh: number };
export const EXPERIENCE_TOGGLES = ["menu", "faq-0", "faq-1", "faq-2", "faq-3", "faq-4", "faq-5", "faq-6", "faq-7"] as const;
export type ExperienceEvent =
  | { t: number; k: "pointer" | "click"; x: number; y: number }
  | { t: number; k: "scroll"; y: number }
  | { t: number; k: "view"; section: typeof EXPERIENCE_SECTIONS[number]; ms: number }
  | ({ t: number; k: "viewport" } & ExperienceViewport)
  | { t: number; k: "visibility"; visible: boolean }
  | { t: number; k: "toggle"; target: typeof EXPERIENCE_TOGGLES[number]; open: boolean };
export type ExperienceSession = { id: string; layout: string; startedAt: number; lastSeenAt: number; expiresAt: number; durationMs: number; device: "mobile" | "tablet" | "desktop"; viewport: ExperienceViewport; clicks: number; maxScroll: number; visibleMs: number; eventCount: number };
export type ExperienceHeatmap = { layout: string; points: { x: number; y: number; clicks: number; moves: number }[]; sections: { key: string; visits: number; ms: number }[]; scroll: { depth: number; sessions: number }[]; coverage: { includedSessions: number; totalSessions: number; limit: number } };
export type ExperienceOverview = { days: number; from: number; retentionDays: number; summary: { sessions: number; clicks: number; visibleMs: number; averageDurationMs: number; averageMaxScroll: number }; sessions: ExperienceSession[]; total: number; page: number; pageSize: number; hasMore: boolean; heatmap: ExperienceHeatmap };
export class ExperienceError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.name = "ExperienceError"; this.status = status; } }
const invalid = () => new ExperienceError("This activity request is not valid.");
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
export const validExperienceId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
export function validateExperienceViewport(value: unknown): ExperienceViewport {
  if (!isRecord(value) || !exact(value, ["w", "h", "dh"]) || !integer(value.w, 100, 4000) || !integer(value.h, 100, 4000) || !integer(value.dh, Number(value.h), 60000)) throw invalid();
  return { w: value.w, h: value.h, dh: value.dh };
}
export function validateExperienceEvents(value: unknown): ExperienceEvent[] {
  if (!Array.isArray(value) || !value.length || value.length > EXPERIENCE_BATCH_EVENTS) throw invalid();
  let previous = -1;
  return value.map(item => {
    if (!isRecord(item) || !integer(item.t, 0, EXPERIENCE_MAX_DURATION) || item.t < previous) throw invalid();
    previous = item.t;
    if ((item.k === "pointer" || item.k === "click") && exact(item, ["t", "k", "x", "y"]) && integer(item.x, 0, 1000) && integer(item.y, 0, 1000)) return { t: item.t, k: item.k, x: item.x, y: item.y };
    if (item.k === "scroll" && exact(item, ["t", "k", "y"]) && integer(item.y, 0, 1000)) return { t: item.t, k: item.k, y: item.y };
    if (item.k === "view" && exact(item, ["t", "k", "section", "ms"]) && EXPERIENCE_SECTIONS.includes(item.section as typeof EXPERIENCE_SECTIONS[number]) && integer(item.ms, 0, 5000)) return { t: item.t, k: item.k, section: item.section as typeof EXPERIENCE_SECTIONS[number], ms: item.ms };
    if (item.k === "viewport" && exact(item, ["t", "k", "w", "h", "dh"])) return { t: item.t, k: "viewport", ...validateExperienceViewport({ w: item.w, h: item.h, dh: item.dh }) };
    if (item.k === "visibility" && exact(item, ["t", "k", "visible"]) && typeof item.visible === "boolean") return { t: item.t, k: item.k, visible: item.visible };
    if (item.k === "toggle" && exact(item, ["t", "k", "target", "open"]) && EXPERIENCE_TOGGLES.includes(item.target as typeof EXPERIENCE_TOGGLES[number]) && typeof item.open === "boolean") return { t: item.t, k: item.k, target: item.target as typeof EXPERIENCE_TOGGLES[number], open: item.open };
    throw invalid();
  });
}
export async function readExperienceJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw invalid();
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > EXPERIENCE_BODY_BYTES)) throw invalid();
  const reader = request.body?.getReader(); if (!reader) throw invalid();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > EXPERIENCE_BODY_BYTES) throw invalid(); chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isRecord(value)) throw invalid(); return value;
  } catch { throw invalid(); }
  finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
export function experienceSameOrigin(request: Request, configuredOrigin?: string): boolean {
  const origin = new URL(request.url).origin;
  return request.headers.get("origin") === origin && (!configuredOrigin || origin === configuredOrigin)
    && !["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") || "");
}
export function experienceConsentAllowed(request: Request): boolean {
  const cookies = request.headers.get("cookie") || "";
  return cookies.split(";").some(item => item.trim() === "satinlore_replay=on")
    && !cookies.split(";").some(item => item.trim() === "satinlore_measurement=off")
    && request.headers.get("dnt") !== "1" && request.headers.get("sec-gpc") !== "1"
    && !request.headers.has("cf-access-jwt-assertion")
    && !BOT.test(request.headers.get("user-agent") || "")
    && !/prefetch|prerender/i.test([request.headers.get("purpose"), request.headers.get("sec-purpose")].join(" "));
}
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, "0")).join(""); }
function token() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join(""); }
function ownership(body: Record<string, unknown>, action: "append" | "withdraw") {
  if (!exact(body, action === "withdraw" ? ["action", "sid", "token"] : ["action", "sid", "token", "seq", "events"]) || body.action !== action || !validExperienceId(body.sid) || typeof body.token !== "string" || !TOKEN.test(body.token)) throw invalid();
  return { sid: body.sid, token: body.token };
}
async function experienceRate(db: D1Database, request: Request, salt: string | undefined, action: "start" | "append", now: number) {
  if (!salt) throw new ExperienceError("Activity storage is unavailable.", 503);
  const key = await digest(JSON.stringify(["satinlore-experience-rate-v1", salt, action, request.headers.get("cf-connecting-ip") || "local-preview", Math.floor(now / 3600000)]));
  const row = await db.prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(key, now + 7200000).first<{ count: number }>();
  if (!row || row.count > (action === "start" ? 20 : 800)) throw new ExperienceError("Activity capture has reached its temporary limit.", 429);
}
type StoredSession = { id: string; token_hash?: string; layout: string; started_at: number; last_seen_at: number; expires_at: number; viewport_width: number; viewport_height: number; document_height: number; device: "mobile" | "tablet" | "desktop"; duration_ms: number; clicks: number; max_scroll: number; visible_ms: number; event_count: number; next_seq?: number; last_t?: number; last_visible?: number };
function sessionView(row: StoredSession): ExperienceSession { return { id: row.id, layout: row.layout, startedAt: row.started_at, lastSeenAt: row.last_seen_at, expiresAt: row.expires_at, durationMs: row.duration_ms, device: row.device, viewport: { w: row.viewport_width, h: row.viewport_height, dh: row.document_height }, clicks: row.clicks, maxScroll: Math.round(row.max_scroll) / 10, visibleMs: row.visible_ms, eventCount: row.event_count }; }
export async function writeExperience(db: D1Database, request: Request, body: Record<string, unknown>, salt?: string, now = Date.now()) {
  if (body.action === "withdraw") {
    const own = ownership(body, "withdraw"); const hash = await digest(own.token);
    await db.batch([
      db.prepare("DELETE FROM website_experience_batches WHERE session_id IN (SELECT id FROM website_experience_sessions WHERE id=? AND token_hash=?)").bind(own.sid, hash),
      db.prepare("DELETE FROM website_experience_sessions WHERE id=? AND token_hash=?").bind(own.sid, hash),
    ]);
    return { ok: true, withdrawn: true };
  }
  if (!experienceConsentAllowed(request)) throw new ExperienceError("Activity recording is not enabled for this browser.", 403);
  if (body.action === "start") {
    if (!exact(body, ["action", "v", "layout", "viewport", "consent"]) || body.v !== 1 || body.layout !== EXPERIENCE_LAYOUT || body.consent !== true) throw invalid();
    const viewport = validateExperienceViewport(body.viewport);
    await experienceRate(db, request, salt, "start", now);
    const sid = crypto.randomUUID(), writeToken = token();
    const device = viewport.w <= 699 ? "mobile" : viewport.w <= 1099 ? "tablet" : "desktop";
    const expiresAt = now + EXPERIENCE_RETENTION_DAYS * DAY;
    await db.prepare("INSERT INTO website_experience_sessions(id,token_hash,page,layout,consent_version,consent_at,started_at,last_seen_at,expires_at,viewport_width,viewport_height,document_height,device) VALUES(?,?, '/',?,?,?,?,?,?,?,?,?,?)")
      .bind(sid, await digest(writeToken), EXPERIENCE_LAYOUT, EXPERIENCE_CONSENT_VERSION, now, now, now, expiresAt, viewport.w, viewport.h, viewport.dh, device).run();
    return { ok: true, sid, token: writeToken, expiresAt, maxDurationMs: EXPERIENCE_MAX_DURATION };
  }
  const own = ownership(body, "append");
  if (!integer(body.seq, 0, EXPERIENCE_MAX_BATCHES - 1)) throw invalid();
  const events = validateExperienceEvents(body.events), seq = body.seq;
  const payload = JSON.stringify(events), fingerprint = await digest(payload), ownHash = await digest(own.token);
  const session = await db.prepare(`SELECT ${SESSION_COLUMNS},next_seq,last_t,last_visible FROM website_experience_sessions WHERE id=? AND token_hash=? AND expires_at>?`).bind(own.sid, ownHash, now).first<StoredSession>();
  if (!session) throw new ExperienceError("This activity session is no longer available.", 404);
  const duplicate = await db.prepare("SELECT fingerprint FROM website_experience_batches WHERE session_id=? AND seq=?").bind(own.sid, seq).first<{ fingerprint: string }>();
  if (duplicate) {
    if (duplicate.fingerprint !== fingerprint) throw new ExperienceError("This activity batch changed after it was saved.", 409);
    return { ok: true, accepted: true, seq, duplicate: true };
  }
  if (now > session.started_at + EXPERIENCE_MAX_DURATION + 60000) throw new ExperienceError("This activity session has ended.", 410);
  if (seq !== session.next_seq || events[0].t < (session.last_t || 0) || session.event_count + events.length > EXPERIENCE_MAX_EVENTS) throw new ExperienceError("This activity batch is out of sequence or has reached its limit.", 409);
  await experienceRate(db, request, salt, "append", now);
  const last = events[events.length - 1].t;
  const clicks = events.filter(event => event.k === "click").length;
  const scroll = Math.max(session.max_scroll, ...events.filter((event): event is Extract<ExperienceEvent, { k: "scroll" }> => event.k === "scroll").map(event => event.y));
  // Integrate the visibility timeline rather than summing overlapping sections.
  // Hidden gaps never count, even if the next event arrives much later.
  let visible = 0, cursor = session.last_t || 0, lastVisible = session.last_visible !== 0;
  for (const event of events) {
    if (lastVisible) visible += event.t - cursor;
    cursor = event.t;
    if (event.k === "visibility") lastVisible = event.visible;
  }
  await db.batch([
    db.prepare("INSERT INTO website_experience_batches(session_id,seq,fingerprint,events,event_count,created_at) SELECT id,?,?,?,?,? FROM website_experience_sessions WHERE id=? AND token_hash=? AND next_seq=? AND event_count+?<=? ON CONFLICT(session_id,seq) DO NOTHING")
      .bind(seq, fingerprint, payload, events.length, now, own.sid, ownHash, seq, events.length, EXPERIENCE_MAX_EVENTS),
    db.prepare("UPDATE website_experience_sessions SET next_seq=next_seq+1,event_count=event_count+?,last_t=?,duration_ms=MAX(duration_ms,?),last_seen_at=?,clicks=clicks+?,max_scroll=MAX(max_scroll,?),visible_ms=visible_ms+?,last_visible=? WHERE id=? AND token_hash=? AND next_seq=? AND EXISTS(SELECT 1 FROM website_experience_batches WHERE session_id=? AND seq=? AND fingerprint=?)")
      .bind(events.length, last, last, now, clicks, scroll, visible, lastVisible ? 1 : 0, own.sid, ownHash, seq, own.sid, seq, fingerprint),
  ]);
  const saved = await db.prepare("SELECT fingerprint FROM website_experience_batches WHERE session_id=? AND seq=?").bind(own.sid, seq).first<{ fingerprint: string }>();
  if (saved?.fingerprint !== fingerprint) throw new ExperienceError("This activity batch is out of sequence.", 409);
  return { ok: true, accepted: true, seq };
}
export function experienceFilters(params: URLSearchParams) {
  const days = Number(params.get("days") || "7"); const device = params.get("device") || "all"; const page = Number(params.get("page") || "1");
  if (![7, 14, 30].includes(days) || !["all", "mobile", "tablet", "desktop"].includes(device) || !Number.isInteger(page) || page < 1 || page > 10000) throw new ExperienceError("Choose a valid date range, device and page.");
  return { days, device, page };
}
export async function readExperienceDetail(db: D1Database, id: string, now = Date.now()) {
  if (!validExperienceId(id)) throw invalid();
  const session = await db.prepare(`SELECT ${SESSION_COLUMNS} FROM website_experience_sessions WHERE id=? AND expires_at>?`).bind(id, now).first<StoredSession>();
  if (!session) throw new ExperienceError("This recording has expired or is no longer available.", 404);
  const batches = await db.prepare("SELECT seq,events FROM website_experience_batches WHERE session_id=? ORDER BY seq LIMIT ?").bind(id, EXPERIENCE_MAX_BATCHES).all<{ seq: number; events: string }>();
  const events: ExperienceEvent[] = []; let incomplete = false, expected = 0;
  for (const batch of batches.results) {
    try { if (batch.seq !== expected++) incomplete = true; events.push(...validateExperienceEvents(JSON.parse(batch.events))); }
    catch { incomplete = true; }
  }
  if (events.length !== session.event_count || events.length > EXPERIENCE_MAX_EVENTS) incomplete = true;
  return { session: sessionView(session), events: events.slice(0, EXPERIENCE_MAX_EVENTS), incomplete };
}
export async function deleteExperienceSession(db: D1Database, id: string) {
  if (!validExperienceId(id)) throw invalid();
  const found = await db.prepare("SELECT id FROM website_experience_sessions WHERE id=?").bind(id).first<{ id: string }>();
  await db.batch([db.prepare("DELETE FROM website_experience_batches WHERE session_id=?").bind(id), db.prepare("DELETE FROM website_experience_sessions WHERE id=?").bind(id)]);
  return { deleted: !!found };
}
export async function readExperienceOverview(db: D1Database, filters = { days: 7, device: "all", page: 1 }, now = Date.now()): Promise<ExperienceOverview> {
  const { days, device, page } = filters;
  const from = now - days * DAY, pageSize = 50, where = "started_at>=? AND expires_at>? AND layout=?" + (device === "all" ? "" : " AND device=?");
  const args: (string | number)[] = [from, now, EXPERIENCE_LAYOUT, ...(device === "all" ? [] : [device])];
  const totals = await db.prepare(`SELECT COUNT(*) sessions,COALESCE(SUM(clicks),0) clicks,COALESCE(SUM(visible_ms),0) visibleMs,COALESCE(AVG(duration_ms),0) averageDurationMs,COALESCE(AVG(max_scroll),0)/10.0 averageMaxScroll FROM website_experience_sessions WHERE ${where}`).bind(...args).first<ExperienceOverview["summary"]>();
  const summary = { sessions: Number(totals?.sessions || 0), clicks: Number(totals?.clicks || 0), visibleMs: Number(totals?.visibleMs || 0), averageDurationMs: Number(totals?.averageDurationMs || 0), averageMaxScroll: Number(totals?.averageMaxScroll || 0) };
  const rows = await db.prepare(`SELECT ${SESSION_COLUMNS} FROM website_experience_sessions WHERE ${where} ORDER BY started_at DESC,id LIMIT ? OFFSET ?`).bind(...args, pageSize, (page - 1) * pageSize).all<StoredSession>();
  const limit = 300;
  const recent = `WITH recent AS (SELECT id,max_scroll FROM website_experience_sessions WHERE ${where} ORDER BY started_at DESC,id LIMIT ${limit}), activity AS (SELECT recent.id session_id,j.value event FROM recent JOIN website_experience_batches b ON b.session_id=recent.id JOIN json_each(b.events) j)`;
  const points = await db.prepare(`${recent} SELECT MIN(39,CAST(json_extract(event,'$.x')/25 AS INTEGER))*25+12 x,MIN(39,CAST(json_extract(event,'$.y')/25 AS INTEGER))*25+12 y,SUM(CASE WHEN json_extract(event,'$.k')='click' THEN 1 ELSE 0 END) clicks,SUM(CASE WHEN json_extract(event,'$.k')='pointer' THEN 1 ELSE 0 END) moves FROM activity WHERE json_extract(event,'$.k') IN ('pointer','click') GROUP BY x,y ORDER BY y,x`).bind(...args).all<{ x: number; y: number; clicks: number; moves: number }>();
  const sectionRows = await db.prepare(`${recent} SELECT json_extract(event,'$.section') key,COUNT(DISTINCT session_id) visits,SUM(json_extract(event,'$.ms')) ms FROM activity WHERE json_extract(event,'$.k')='view' GROUP BY key`).bind(...args).all<{ key: string; visits: number; ms: number }>();
  const sectionMap = new Map(sectionRows.results.map(row => [row.key, row]));
  const depthRows = await db.prepare(`WITH recent AS (SELECT id,max_scroll FROM website_experience_sessions WHERE ${where} ORDER BY started_at DESC,id LIMIT ${limit}) SELECT COUNT(*) sessions,SUM(CASE WHEN max_scroll>=250 THEN 1 ELSE 0 END) d25,SUM(CASE WHEN max_scroll>=500 THEN 1 ELSE 0 END) d50,SUM(CASE WHEN max_scroll>=750 THEN 1 ELSE 0 END) d75,SUM(CASE WHEN max_scroll>=1000 THEN 1 ELSE 0 END) d100 FROM recent`).bind(...args).first<{ sessions: number; d25: number; d50: number; d75: number; d100: number }>();
  const included = Number(depthRows?.sessions || 0);
  return { days, from, retentionDays: EXPERIENCE_RETENTION_DAYS, summary, sessions: rows.results.map(sessionView), total: summary.sessions, page, pageSize, hasMore: page * pageSize < summary.sessions,
    heatmap: { layout: EXPERIENCE_LAYOUT, points: points.results, sections: EXPERIENCE_SECTIONS.map(key => ({ key, visits: Number(sectionMap.get(key)?.visits || 0), ms: Number(sectionMap.get(key)?.ms || 0) })), scroll: [{ depth: 0, sessions: included }, ...([25, 50, 75, 100] as const).map(depth => ({ depth, sessions: Number(depthRows?.[`d${depth}` as keyof NonNullable<typeof depthRows>] || 0) }))], coverage: { includedSessions: included, totalSessions: summary.sessions, limit } } };
}
