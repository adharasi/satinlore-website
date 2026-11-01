/** First-party daily counters, with separately stored, short-lived pseudonymous dedupe keys. */
export const METRIC_PAGES = ["/", "/privacy", "/contact", "/research-privacy"] as const;
export const CTA_SURFACES = ["header", "hero", "beta", "controls", "mobile"] as const;
const SOURCES = ["direct", "x", "instagram", "reddit", "tiktok", "youtube", "facebook", "linkedin", "email", "search", "other"] as const;
const REFERRERS = ["direct", "internal", "x", "instagram", "reddit", "tiktok", "youtube", "facebook", "linkedin", "search", "other"] as const;
const DEVICES = ["mobile", "tablet", "desktop", "unknown"] as const;
export type MetricPage = typeof METRIC_PAGES[number];
export type MetricSource = typeof SOURCES[number];
export type MetricReferrer = typeof REFERRERS[number];
export type MetricDevice = typeof DEVICES[number];
export type MetricRecord = { day: string; event: "page_view" | "cta_click"; page: MetricPage; source: MetricSource; referrer: MetricReferrer; device: MetricDevice };
const DAY = 86400000;
const BOT = /bot\b|crawler|spider|slurp|preview|headless|curl\/|wget\/|python-requests|monitoring|uptimerobot|facebookexternalhit|lighthouse/i;
const sourceAliases: Record<string, MetricSource> = {
  direct: "direct", twitter: "x", x: "x", "twitter.com": "x", "x.com": "x", instagram: "instagram", ig: "instagram",
  reddit: "reddit", tiktok: "tiktok", youtube: "youtube", yt: "youtube", facebook: "facebook", fb: "facebook",
  linkedin: "linkedin", email: "email", newsletter: "email", google: "search", bing: "search", duckduckgo: "search", search: "search",
};
export function metricSource(value: unknown, fallback: MetricSource = "direct"): MetricSource {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || value.length > 64) return "other";
  const key = value.trim().toLowerCase();
  return Object.hasOwn(sourceAliases, key) ? sourceAliases[key] : "other";
}
function hostMatches(host: string, domain: string) { return host === domain || host.endsWith("." + domain); }
export function metricReferrer(raw: string | null, ownHost = "satinlore.com"): MetricReferrer {
  if (!raw) return "direct";
  let host: string;
  try { const parsed = new URL(raw); if (!["https:", "http:"].includes(parsed.protocol)) return "other"; host = parsed.hostname.toLowerCase(); }
  catch { return "other"; }
  if ([ownHost, "satinlore.com", "www.satinlore.com", "launch.satinlore.com"].includes(host)) return "internal";
  if (["x.com", "twitter.com", "t.co"].some(domain => hostMatches(host, domain))) return "x";
  if (hostMatches(host, "instagram.com")) return "instagram";
  if (["reddit.com", "redd.it"].some(domain => hostMatches(host, domain))) return "reddit";
  if (hostMatches(host, "tiktok.com")) return "tiktok";
  if (["youtube.com", "youtu.be"].some(domain => hostMatches(host, domain))) return "youtube";
  if (["facebook.com", "fb.com", "fb.me"].some(domain => hostMatches(host, domain))) return "facebook";
  if (["linkedin.com", "lnkd.in"].some(domain => hostMatches(host, domain))) return "linkedin";
  if (["google.com", "google.co.uk", "bing.com", "duckduckgo.com", "search.yahoo.com", "ecosia.org", "search.brave.com"].some(domain => hostMatches(host, domain))) return "search";
  return "other";
}
export function metricDevice(headers: Headers): MetricDevice {
  const agent = headers.get("user-agent") || "";
  if (/ipad|tablet|kindle|silk/i.test(agent) || (/android/i.test(agent) && !/mobile/i.test(agent))) return "tablet";
  if (headers.get("sec-ch-ua-mobile") === "?1" || /mobile|iphone|ipod/i.test(agent)) return "mobile";
  return agent ? "desktop" : "unknown";
}
export function measurementAllowed(request: Request): boolean {
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return false;
  if ((request.headers.get("cookie") || "").split(";").some(cookie => cookie.trim() === "satinlore_measurement=off")) return false;
  if (request.headers.has("cf-access-jwt-assertion")) return false;
  const agent = request.headers.get("user-agent") || "";
  if (BOT.test(agent)) return false;
  if (/prefetch|prerender/i.test([request.headers.get("purpose"), request.headers.get("sec-purpose"), request.headers.get("x-purpose")].join(" "))) return false;
  if (request.headers.has("next-router-prefetch") || request.headers.get("rsc") === "1") return false;
  return true;
}
export function pageMetric(request: Request, result: Response, now = Date.now()): MetricRecord | null {
  if (!measurementAllowed(request) || request.method !== "GET" || result.status < 200 || result.status >= 300 || !result.headers.get("content-type")?.toLowerCase().startsWith("text/html")) return null;
  if (request.headers.get("sec-fetch-dest") && request.headers.get("sec-fetch-dest") !== "document") return null;
  const url = new URL(request.url);
  if (!METRIC_PAGES.includes(url.pathname as MetricPage)) return null;
  return requestMetric(request, "page_view", url.pathname as MetricPage, url.searchParams.get("utm_source"), now);
}
function requestMetric(request: Request, event: MetricRecord["event"], page: MetricPage, source: unknown, now: number): MetricRecord {
  const referrer = metricReferrer(request.headers.get("referer"), new URL(request.url).hostname);
  const fallback = referrer === "internal" ? "direct" : referrer as MetricSource;
  return { day: new Date(now).toISOString().slice(0, 10), event, page, source: metricSource(source, fallback), referrer, device: metricDevice(request.headers) };
}
export function ctaMetric(request: Request, body: unknown, now = Date.now()): MetricRecord | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some(key => !["event", "page", "surface", "source"].includes(key))) return null;
  if (data.event !== "cta_click" || data.page !== "/" || !CTA_SURFACES.includes(data.surface as typeof CTA_SURFACES[number])) return null;
  if (data.source !== undefined && (typeof data.source !== "string" || data.source.length > 64)) return null;
  return requestMetric(request, "cta_click", "/", data.source, now);
}
export const INCREMENT_METRIC_SQL = `INSERT INTO website_metrics(day,event,page,source,referrer,device,count,last_seen)
VALUES(?,?,?,?,?,?,1,?) ON CONFLICT(day,event,page,source,referrer,device) DO UPDATE SET count=website_metrics.count+1,last_seen=excluded.last_seen`;
function metricStatement(db: D1Database, metric: MetricRecord, now: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metric.day) || !["page_view", "cta_click"].includes(metric.event) || !METRIC_PAGES.includes(metric.page) || !SOURCES.includes(metric.source) || !REFERRERS.includes(metric.referrer) || !DEVICES.includes(metric.device)) throw new Error("Invalid metric");
  return db.prepare(INCREMENT_METRIC_SQL).bind(metric.day, metric.event, metric.page, metric.source, metric.referrer, metric.device, now);
}
export async function recordMetric(db: D1Database, metric: MetricRecord, now = Date.now()) {
  await metricStatement(db, metric, now).run();
}
/** Only a broad family is used in memory; neither it nor the full UA is stored in dedupe records. */
function browserFamily(headers: Headers) {
  const agent = headers.get("user-agent") || "";
  if (!agent) return "unknown";
  if (/edg(?:e|a|ios)?\//i.test(agent)) return "edge";
  if (/opr\/|opera/i.test(agent)) return "opera";
  if (/samsungbrowser\//i.test(agent)) return "samsung";
  if (/firefox\/|fxios\//i.test(agent)) return "firefox";
  if (/chrome\/|crios\//i.test(agent)) return "chrome";
  if (/safari\//i.test(agent)) return "safari";
  return "other";
}
async function uniqueStatements(db: D1Database, request: Request, metric: MetricRecord, salt?: string) {
  // CF-Connecting-IP is set by our Cloudflare edge. Never use client-submitted IDs, X-Forwarded-For or URL values.
  const ip = request.headers.get("cf-connecting-ip");
  if (!salt || !ip || ip.length > 45 || !/^[\da-f:.]+$/i.test(ip)) return [];
  const encoder = new TextEncoder();
  const importKey = (raw: ArrayBuffer) => crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const rootKey = await importKey(encoder.encode(salt).buffer);
  const dailyKey = await importKey(await crypto.subtle.sign("HMAC", rootKey, encoder.encode(`satinlore:daily-uniques:v1:${metric.day}`)));
  // One minute covers in-flight waitUntil writes at midnight; scheduled cleanup removes expired keys.
  const expiresAt = Date.parse(metric.day + "T00:00:00Z") + DAY + 60000;
  const family = browserFamily(request.headers);
  return Promise.all(["*", metric.page].map(async scope => {
    // Separate scope inputs avoid storing a common code that could connect a person's page visits.
    const input = JSON.stringify([scope, ip, family, metric.device]);
    const digest = await crypto.subtle.sign("HMAC", dailyKey, encoder.encode(input));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return db.prepare("INSERT INTO website_daily_uniques(day,page,visitor_hash,expires_at) VALUES(?,?,?,?) ON CONFLICT(day,page,visitor_hash) DO NOTHING").bind(metric.day, scope, hash, expiresAt);
  }));
}
/** Independent short-lived abuse bucket: never consumes a signup/contact attempt. */
export async function analyticsRateLimit(db: D1Database, request: Request, salt: string | undefined, kind: "page" | "cta", now = Date.now()) {
  if (!salt) return false;
  const input = `${salt}:analytics:${kind}:${request.headers.get("cf-connecting-ip") || "local-preview"}:${Math.floor(now / 3600000)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const row = await db.prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(key, now + 7200000).first<{ count: number }>();
  return !!row && row.count <= 120;
}
export async function trackPageView(db: D1Database, request: Request, result: Response, salt?: string, now = Date.now()) {
  const metric = pageMetric(request, result, now);
  if (metric && await analyticsRateLimit(db, request, salt, "page", now)) {
    // D1 batches are transactional. Only newly inserted dedupe keys fire the aggregate-count trigger.
    await db.batch([metricStatement(db, metric, now), ...await uniqueStatements(db, request, metric, salt)]);
  }
}

export type AnalyticsCounts = { pageviews: number; uniqueVisitors: number; uniquePageviews: number; ctaClicks: number; signups: number; verified: number; surveyResponses: number; contacts: number };
export type AnalyticsOverview = {
  days: number; from: number; trackingSince: number | null; totals: AnalyticsCounts;
  daily: ({ day: string } & AnalyticsCounts)[];
  sources: { label: string; count: number; signups: number }[];
  referrers: { label: string; count: number }[]; devices: { label: string; count: number }[]; pages: { label: string; count: number; uniqueViews: number }[];
};
const emptyCounts = (): AnalyticsCounts => ({ pageviews: 0, uniqueVisitors: 0, uniquePageviews: 0, ctaClicks: 0, signups: 0, verified: 0, surveyResponses: 0, contacts: 0 });
const sourceCase = "CASE lower(trim(source)) " + Object.entries(sourceAliases).map(([value, category]) => `WHEN '${value}' THEN '${category}'`).join(" ") + " WHEN '' THEN 'direct' ELSE 'other' END";
export async function readAnalyticsOverview(db: D1Database, requestedDays = 30, now = Date.now()): Promise<AnalyticsOverview> {
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const today = Math.floor(now / DAY) * DAY;
  const from = today - (days - 1) * DAY;
  const fromDay = new Date(from).toISOString().slice(0, 10);
  const todayDay = new Date(today).toISOString().slice(0, 10);
  const daily: AnalyticsOverview["daily"] = Array.from({ length: days }, (_, i) => ({ day: new Date(from + i * DAY).toISOString().slice(0, 10), ...emptyCounts() }));
  const dayMap = new Map(daily.map(day => [day.day, day]));
  const metricRows = await db.prepare("SELECT day,event,SUM(count) count FROM website_metrics WHERE day>=? AND day<=? GROUP BY day,event").bind(fromDay, todayDay).all<{ day: string; event: string; count: number }>();
  for (const row of metricRows.results) {
    const day = dayMap.get(row.day); if (!day) continue;
    if (row.event === "page_view") day.pageviews = Number(row.count);
    if (row.event === "unique_visitor") day.uniqueVisitors = Number(row.count);
    if (row.event === "unique_page_view") day.uniquePageviews = Number(row.count);
    if (row.event === "cta_click") day.ctaClicks = Number(row.count);
  }
  const activityQueries: [keyof Pick<AnalyticsCounts, "signups" | "verified" | "surveyResponses" | "contacts">, string][] = [
    ["signups", "WITH actions AS(SELECT email,MIN(created_at) happened_at FROM waitlist WHERE created_at>=? AND created_at<=? AND expires_at>? GROUP BY email) SELECT date(happened_at/1000,'unixepoch') day,COUNT(*) count FROM actions GROUP BY day"],
    ["verified", "WITH actions AS(SELECT email,MIN(confirmed_at) happened_at FROM waitlist WHERE email_verified=1 AND confirmed_at>=? AND confirmed_at<=? AND expires_at>? GROUP BY email) SELECT date(happened_at/1000,'unixepoch') day,COUNT(*) count FROM actions GROUP BY day"],
    ["surveyResponses", "SELECT date(submitted_at/1000,'unixepoch') day,COUNT(*) count FROM questionnaire_responses WHERE submitted_at>=? AND submitted_at<=? AND expires_at>? GROUP BY day"],
    ["contacts", "SELECT date(created_at/1000,'unixepoch') day,COUNT(*) count FROM contact_requests WHERE created_at>=? AND created_at<=? AND expires_at>? GROUP BY day"],
  ];
  for (const [key, sql] of activityQueries) {
    const rows = await db.prepare(sql).bind(from, now, now).all<{ day: string; count: number }>();
    for (const row of rows.results) { const day = dayMap.get(row.day); if (day) day[key] = Number(row.count); }
  }
  const totals = emptyCounts();
  for (const day of daily) for (const key of Object.keys(totals) as (keyof AnalyticsCounts)[]) totals[key] += day[key];
  const sourceRows = await db.prepare("SELECT source label,SUM(count) count FROM website_metrics WHERE day>=? AND day<=? AND event='page_view' GROUP BY source ORDER BY count DESC,source").bind(fromDay, todayDay).all<{ label: string; count: number }>();
  const signupSources = await db.prepare(`WITH first_signup AS(SELECT email,source,MIN(created_at) happened_at FROM waitlist WHERE created_at>=? AND created_at<=? AND expires_at>? GROUP BY email) SELECT ${sourceCase} label,COUNT(*) count FROM first_signup GROUP BY label`).bind(from, now, now).all<{ label: string; count: number }>();
  const sourceMap = new Map(sourceRows.results.map(row => [row.label, { label: row.label, count: Number(row.count), signups: 0 }]));
  for (const row of signupSources.results) { const value = sourceMap.get(row.label) || { label: row.label, count: 0, signups: 0 }; value.signups = Number(row.count); sourceMap.set(row.label, value); }
  const breakdown = async (column: "referrer" | "device" | "page") => (await db.prepare(`SELECT ${column} label,SUM(count) count FROM website_metrics WHERE day>=? AND day<=? AND event='page_view' GROUP BY ${column} ORDER BY count DESC,${column}`).bind(fromDay, todayDay).all<{ label: string; count: number }>()).results.map(row => ({ label: row.label, count: Number(row.count) }));
  const pageUniques = await db.prepare("SELECT page label,SUM(count) count FROM website_metrics WHERE day>=? AND day<=? AND event='unique_page_view' GROUP BY page").bind(fromDay, todayDay).all<{ label: string; count: number }>();
  const pageUniqueMap = new Map(pageUniques.results.map(row => [row.label, Number(row.count)]));
  const pages = (await breakdown("page")).map(row => ({ ...row, uniqueViews: pageUniqueMap.get(row.label) || 0 }));
  const earliest = await db.prepare("SELECT MIN(day) day FROM website_metrics").first<{ day: string | null }>();
  return { days, from, trackingSince: earliest?.day ? Date.parse(earliest.day + "T00:00:00Z") : null, totals, daily, sources: [...sourceMap.values()].sort((a, b) => b.count - a.count || b.signups - a.signups || a.label.localeCompare(b.label)), referrers: await breakdown("referrer"), devices: await breakdown("device"), pages };
}
