import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
const analytics = await import(new URL("../lib/site-analytics.ts", import.meta.url).href);
const { metricSource, metricReferrer, metricDevice, measurementAllowed, pageMetric, ctaMetric, recordMetric, analyticsRateLimit, trackPageView, readAnalyticsOverview } = analytics;
const now = Date.UTC(2026, 10, 1, 12);
const origin = "https://satinlore.com";
function page(path = "/", headers: Record<string, string> = {}) { return new Request(origin + path, { headers: { "User-Agent": "Mozilla/5.0 Desktop", ...headers } }); }
function html(status = 200) { return new Response("<!doctype html><p>Synthetic page</p>", { status, headers: { "Content-Type": "text/html; charset=utf-8" } }); }
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE website_metrics(day TEXT,event TEXT,page TEXT,source TEXT,referrer TEXT,device TEXT,count INTEGER,last_seen INTEGER,PRIMARY KEY(day,event,page,source,referrer,device));
CREATE TABLE rate_limits(key TEXT PRIMARY KEY,count INTEGER,expires_at INTEGER);
CREATE TABLE waitlist(id TEXT PRIMARY KEY,email TEXT,source TEXT,created_at INTEGER,confirmed_at INTEGER,email_verified INTEGER,expires_at INTEGER);
CREATE TABLE questionnaire_responses(email TEXT PRIMARY KEY,submitted_at INTEGER,expires_at INTEGER);
CREATE TABLE contact_requests(id TEXT PRIMARY KEY,created_at INTEGER,expires_at INTEGER);`);
  const driver = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql); let values: (string | number)[] = [];
      return {
        bind(...bound: (string | number)[]) { values = bound; return this; },
        async run() { return statement.run(...values); },
        async first() { return statement.get(...values) || null; },
        async all() { return { results: statement.all(...values) }; },
      };
    },
  } as unknown as D1Database;
  return { sqlite, driver };
}

test("measurement buckets keep campaign identifiers, raw referrers and user agents out of stored dimensions", () => {
  assert.equal(metricSource("TWITTER"), "x");
  assert.equal(metricSource("reader@example.test"), "other");
  assert.equal(metricSource("campaign-with-private-code"), "other");
  assert.equal(metricSource("constructor"), "other");
  assert.equal(metricSource("__proto__"), "other");
  assert.equal(metricSource(undefined, "reddit"), "reddit");
  assert.equal(metricReferrer("https://www.reddit.com/r/synthetic?private=secret"), "reddit");
  assert.equal(metricReferrer("https://reddit.com.attacker.test/private"), "other");
  assert.equal(metricReferrer("https://satinlore.com/manage?token=private"), "internal");
  assert.equal(metricReferrer("mailto:private@example.test"), "other");
  assert.equal(metricDevice(new Headers({ "User-Agent": "Mozilla iPad" })), "tablet");
  assert.equal(metricDevice(new Headers({ "Sec-CH-UA-Mobile": "?1" })), "mobile");
  assert.equal(metricDevice(new Headers()), "unknown");
  const metric = pageMetric(page("/?utm_source=reader%40example.test&secret=value", { Referer: "https://unlisted.example.test/private?token=secret" }), html(), now)!;
  assert.deepEqual(metric, { day: "2026-11-01", event: "page_view", page: "/", source: "other", referrer: "other", device: "desktop" });
  assert.doesNotMatch(JSON.stringify(metric), /reader|secret|unlisted|Mozilla/);
});
test("only successful public page HTML is counted, with private routes, bots, prefetch and preferences excluded", () => {
  assert.ok(pageMetric(page(), html(), now));
  for (const path of ["/admin", "/admin/metrics", "/api/admin/crm", "/api/waitlist", "/confirm?token=secret", "/manage#secret", "/unknown"]) assert.equal(pageMetric(page(path), html(), now), null);
  const excludedHeaders: Record<string, string>[] = [{ DNT: "1" }, { "Sec-GPC": "1" }, { Cookie: "other=yes; satinlore_measurement=off" }, { "User-Agent": "Googlebot/2.1" }, { Purpose: "prefetch" }, { RSC: "1" }, { "next-router-prefetch": "1" }, { "CF-Access-JWT-Assertion": "synthetic" }];
  for (const headers of excludedHeaders) {
    assert.equal(measurementAllowed(page("/", headers)), false);
    assert.equal(pageMetric(page("/", headers), html(), now), null);
  }
  assert.equal(pageMetric(page("/", { "Sec-Fetch-Dest": "iframe" }), html(), now), null);
  assert.equal(pageMetric(page(), html(404), now), null);
  assert.equal(pageMetric(page(), new Response("{}", { headers: { "Content-Type": "application/json" } }), now), null);
  assert.equal(pageMetric(new Request(origin, { method: "POST" }), html(), now), null);
});
test("CTA input is bounded to the approved homepage actions and cannot become a data collection endpoint", () => {
  const body = { event: "cta_click", page: "/", surface: "hero", source: "instagram" };
  assert.equal(ctaMetric(page(), body, now)?.source, "instagram");
  for (const change of [{ page: "/manage" }, { event: "email_open" }, { surface: "private-email" }, { email: "reader@example.test" }, { source: "x".repeat(65) }]) assert.equal(ctaMetric(page(), { ...body, ...change }, now), null);
});
test("counter upserts aggregate actions without storing a visitor record and rate limits do not consume signup buckets", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  const request = page("/?utm_source=x", { "CF-Connecting-IP": "192.0.2.10" });
  await trackPageView(driver, request, html(), "synthetic-secret", now);
  await trackPageView(driver, request, html(), "synthetic-secret", now + 1);
  const row = sqlite.prepare("SELECT * FROM website_metrics").get()!;
  assert.equal(row.count, 2); assert.equal(row.source, "x");
  assert.equal(sqlite.prepare("SELECT COUNT(*) total FROM website_metrics").get()?.total, 1);
  assert.doesNotMatch(JSON.stringify(row), /192\.0\.2|synthetic-secret|Mozilla/);
  for (let i = 0; i < 120; i++) assert.equal(await analyticsRateLimit(driver, request, "synthetic-secret", "cta", now), true);
  assert.equal(await analyticsRateLimit(driver, request, "synthetic-secret", "cta", now), false);
  assert.equal(await analyticsRateLimit(driver, request, "synthetic-secret", "page", now), true);
  const buckets = sqlite.prepare("SELECT key,count FROM rate_limits").all();
  assert.equal(buckets.length, 2); assert.ok(buckets.every(b => /^[a-f0-9]{64}$/.test(String(b.key))));
});
test("admin analytics reconcile retained activity and dedupe repeat waitlist emails across days", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  const first = now - 2 * 86400000, later = now - 86400000, expiry = now + 86400000;
  await recordMetric(driver, pageMetric(page("/?utm_source=x"), html(), first)!, first);
  await recordMetric(driver, pageMetric(page("/?utm_source=x"), html(), first)!, first);
  await recordMetric(driver, ctaMetric(page(), { event: "cta_click", page: "/", surface: "beta", source: "x" }, later)!, later);
  sqlite.prepare("INSERT INTO waitlist VALUES(?,?,?,?,?,?,?)").run("one", "same@example.test", "twitter", first, later, 1, expiry);
  sqlite.prepare("INSERT INTO waitlist VALUES(?,?,?,?,?,?,?)").run("two", "same@example.test", "private-campaign", later, later, 1, expiry);
  sqlite.prepare("INSERT INTO waitlist VALUES(?,?,?,?,?,?,?)").run("expired", "old@example.test", "reddit", first, later, 1, now - 1);
  sqlite.prepare("INSERT INTO questionnaire_responses VALUES(?,?,?)").run("survey@example.test", later, expiry);
  sqlite.prepare("INSERT INTO contact_requests VALUES(?,?,?)").run("note", later, expiry);
  const result = await readAnalyticsOverview(driver, 7, now);
  assert.deepEqual(result.totals, { pageviews: 2, ctaClicks: 1, signups: 1, verified: 1, surveyResponses: 1, contacts: 1 });
  assert.equal(result.daily.length, 7); assert.equal(result.trackingSince, Date.UTC(2026, 9, 30));
  assert.deepEqual(result.sources, [{ label: "x", count: 2, signups: 1 }]);
  assert.equal(result.daily.reduce((sum: number, day: { signups: number }) => sum + day.signups, 0), 1);
  assert.doesNotMatch(JSON.stringify(result), /@|private-campaign/);
  assert.equal((await readAnalyticsOverview(driver, 365, now)).days, 30);
});
test("public counter endpoint rejects cross-origin and unexpected data, honors preferences, and fails quietly on database errors", async () => {
  const compiled = ts.transpileModule(readFileSync(new URL("../app/api/metrics/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let writes = 0;
  const exported: { POST?: (r: Request) => Promise<Response> } = {};
  new Function("require", "exports", compiled)((specifier: string) => {
    if (specifier === "@/lib/site-analytics") return { ...analytics, analyticsRateLimit: async () => true, recordMetric: async () => { writes++; throw new Error("Synthetic database failure"); } };
    if (specifier === "@/lib/waitlist-server") return { database: () => ({}), runtime: () => ({ ABUSE_SALT: "synthetic" }), response: (body: unknown, status = 200) => Response.json(body, { status }) };
    throw new Error("Unexpected dependency");
  }, exported);
  const request = (body: unknown, headers: Record<string, string> = {}) => new Request(origin + "/api/metrics", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const body = { event: "cta_click", page: "/", surface: "hero", source: "x" };
  assert.equal((await exported.POST!(request(body, { Origin: "https://foreign.example.test" }))).status, 400);
  assert.equal((await exported.POST!(request({ ...body, email: "private@example.test" }))).status, 400);
  assert.equal((await exported.POST!(request(body, { DNT: "1" }))).status, 204);
  assert.equal(writes, 0);
  assert.equal((await exported.POST!(request(body))).status, 204);
  assert.equal(writes, 1);
  assert.equal((await exported.POST!(request({ ...body, source: "x".repeat(2000) }))).status, 400);
});
test("page HTTP responses stay available when the asynchronous analytics write fails", async () => {
  const compiled = ts.transpileModule(readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { default?: { fetch: (r: Request, env: unknown, ctx: unknown) => Promise<Response> } } = {};
  new Function("require", "exports", compiled)((specifier: string) => {
    if (specifier === "vinext/server/fetch-handler") return { default: { fetch: async () => html() } };
    if (specifier === "../lib/site-analytics") return { trackPageView: async () => { throw new Error("Synthetic analytics failure"); } };
    if (specifier === "../lib/data-retention") return { purgeExpiredRecords: async () => undefined };
    if (specifier === "../lib/survey-email-jobs") return { processSurveyEmailJobs: async () => undefined };
    throw new Error("Unexpected dependency");
  }, exported);
  const pending: Promise<unknown>[] = [];
  const response = await exported.default!.fetch(page(), { DB: {}, ABUSE_SALT: "synthetic" }, { waitUntil(p: Promise<unknown>) { pending.push(p); } });
  assert.equal(response.status, 200); assert.equal(await response.text(), "<!doctype html><p>Synthetic page</p>");
  await Promise.all(pending);
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
});
