import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
const { trackPageView, readAnalyticsOverview } = await import(new URL("../lib/site-analytics.ts", import.meta.url).href);
const { purgeExpiredRecords } = await import(new URL("../lib/data-retention.ts", import.meta.url).href);
const DAY = 86400000;
const now = Date.UTC(2026, 10, 1, 12);
const salt = "synthetic-test-key-never-used-in-production";
const ip = "192.0.2.10";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.7390.122 Safari/537.36";
function page(path = "/", headers: Record<string, string> = {}) {
  return new Request("https://satinlore.com" + path, { headers: { "User-Agent": ua, "CF-Connecting-IP": ip, ...headers } });
}
function html() { return new Response("Synthetic page", { headers: { "Content-Type": "text/html" } }); }
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(name, directory), "utf8"));
  const driver = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql); let values: (string | number)[] = [];
      return {
        bind(...bound: (string | number)[]) { values = bound; return this; },
        run() { return statement.run(...values); },
        async first() { return statement.get(...values) || null; },
        async all() { return { results: statement.all(...values) }; },
      };
    },
    async batch(statements: { run: () => unknown }[]) {
      sqlite.exec("BEGIN");
      try { const result = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  } as unknown as D1Database;
  return { sqlite, driver };
}
function counts(sqlite: DatabaseSync, event: string) {
  return Number(sqlite.prepare("SELECT COALESCE(SUM(count),0) n FROM website_metrics WHERE event=?").get(event)!.n);
}

test("simultaneous repeat page views increment daily site and page estimates exactly once", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  await Promise.all(Array.from({ length: 50 }, (_, i) => trackPageView(driver, page("/?utm_source=" + (i % 2 ? "instagram" : "x"), { Referer: i % 2 ? "https://www.reddit.com/" : "https://x.com/" }), html(), salt, now)));
  assert.equal(counts(sqlite, "page_view"), 50);
  assert.equal(counts(sqlite, "unique_visitor"), 1);
  assert.equal(counts(sqlite, "unique_page_view"), 1);
  const codes = sqlite.prepare("SELECT * FROM website_daily_uniques ORDER BY page").all();
  assert.equal(codes.length, 2);
  assert.ok(codes.every(row => /^[a-f0-9]{64}$/.test(String(row.visitor_hash))));
  assert.notEqual(codes[0].visitor_hash, codes[1].visitor_hash);
  assert.ok(codes.every(row => row.expires_at === Date.UTC(2026, 10, 2, 0, 1)));
  assert.doesNotMatch(JSON.stringify(codes), /192\.0\.2|Mozilla|Chrome|Windows|instagram|reddit|synthetic/);
  const aggregate = sqlite.prepare("SELECT * FROM website_metrics WHERE event='unique_visitor'").get()!;
  assert.equal(aggregate.last_seen, Date.UTC(2026, 10, 1));
});

test("site estimates are distinct from per-page estimates and multi-day totals sum daily estimates", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  await trackPageView(driver, page(), html(), salt, now);
  await trackPageView(driver, page("/privacy"), html(), salt, now + 1);
  // Exact UA versions and untrusted user-provided IDs cannot change a browser-family estimate.
  await trackPageView(driver, page("/privacy?visitor_id=arbitrary", { "User-Agent": ua.replace("141.0.7390.122", "141.0.7390.200"), "X-Visitor-ID": "arbitrary" }), html(), salt, now + 2);
  assert.equal(counts(sqlite, "unique_visitor"), 1);
  assert.equal(counts(sqlite, "unique_page_view"), 2);
  const firstCode = sqlite.prepare("SELECT visitor_hash FROM website_daily_uniques WHERE day='2026-11-01' AND page='*'").get()!.visitor_hash;
  await trackPageView(driver, page(), html(), salt, now + DAY);
  const secondCode = sqlite.prepare("SELECT visitor_hash FROM website_daily_uniques WHERE day='2026-11-02' AND page='*'").get()!.visitor_hash;
  assert.notEqual(firstCode, secondCode);
  const result = await readAnalyticsOverview(driver, 7, now + DAY);
  assert.equal(result.totals.pageviews, 4);
  assert.equal(result.totals.uniqueVisitors, 2);
  assert.equal(result.totals.uniquePageviews, 3);
  assert.equal(result.daily.find((day: { day: string }) => day.day === "2026-11-01")!.uniqueVisitors, 1);
  assert.equal(result.daily.find((day: { day: string }) => day.day === "2026-11-01")!.uniquePageviews, 2);
  assert.deepEqual(result.pages, [{ label: "/", count: 2, uniqueViews: 2 }, { label: "/privacy", count: 2, uniqueViews: 1 }]);
  assert.equal(result.sources.reduce((sum: number, row: { count: number }) => sum + row.count, 0), 4);
  assert.doesNotMatch(JSON.stringify(result), /visitor_hash|192\.0\.2|arbitrary|Mozilla|synthetic/);
});

test("different network or broad browser family can change an estimate without retaining raw inputs", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  await trackPageView(driver, page(), html(), salt, now);
  await trackPageView(driver, page("/", { "CF-Connecting-IP": "2001:db8::1" }), html(), salt, now);
  await trackPageView(driver, page("/", { "User-Agent": "Mozilla/5.0 Firefox/144.0" }), html(), salt, now);
  assert.equal(counts(sqlite, "unique_visitor"), 3);
  assert.doesNotMatch(JSON.stringify(sqlite.prepare("SELECT * FROM website_daily_uniques").all()), /2001:db8|Firefox|Mozilla|192\.0\.2/);
});

test("missing trusted edge inputs preserve ordinary views and do not invent a unique visitor", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  for (const address of ["", "invalid", "192.0.2.1, 192.0.2.2"]) {
    await trackPageView(driver, page("/", { "CF-Connecting-IP": address, "X-Forwarded-For": ip, "X-Visitor-ID": "synthetic" }), html(), salt, now);
  }
  assert.equal(counts(sqlite, "page_view"), 3);
  assert.equal(counts(sqlite, "unique_visitor"), 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_daily_uniques").get()!.n, 0);
  await trackPageView(driver, page(), html(), undefined, now);
  assert.equal(counts(sqlite, "page_view"), 3); // Existing measurement rate limiter requires the runtime salt.
});

test("privacy signals, opted-out browsers, bots, private pages and prefetch produce no dedupe records", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  const requests = [page("/", { DNT: "1" }), page("/", { "Sec-GPC": "1" }), page("/", { Cookie: "satinlore_measurement=off" }), page("/", { "User-Agent": "Googlebot/2.1" }), page("/", { Purpose: "prefetch" }), page("/", { "CF-Access-JWT-Assertion": "synthetic" }), page("/admin"), page("/manage?token=synthetic"), page("/api/metrics")];
  for (const request of requests) await trackPageView(driver, request, html(), salt, now);
  assert.equal(counts(sqlite, "page_view"), 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_daily_uniques").get()!.n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM rate_limits").get()!.n, 0);
});

test("expiry cleanup removes previous-day dedupe keys after the midnight grace while retaining daily totals", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  const midnight = Date.UTC(2026, 10, 2);
  await trackPageView(driver, page(), html(), salt, midnight - 1);
  await purgeExpiredRecords(driver, midnight + 59999);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_daily_uniques").get()!.n, 2);
  await trackPageView(driver, page(), html(), salt, midnight + 1);
  await purgeExpiredRecords(driver, midnight + 60000);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_daily_uniques").get()!.n, 2);
  assert.equal(sqlite.prepare("SELECT MIN(day) day FROM website_daily_uniques").get()!.day, "2026-11-02");
  assert.equal(counts(sqlite, "unique_visitor"), 2);
  assert.equal(counts(sqlite, "unique_page_view"), 2);
  assert.ok(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='queue_survey_after_verification'").get());
  assert.ok(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='website_daily_uniques_expiry_idx'").get());
});

test("a failed unique insert rolls back both aggregate counters and dedupe keys in the D1 batch", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  sqlite.exec("CREATE TRIGGER synthetic_failure BEFORE INSERT ON website_daily_uniques WHEN NEW.page='/' BEGIN SELECT RAISE(ABORT,'Synthetic failure'); END");
  await assert.rejects(trackPageView(driver, page(), html(), salt, now), /Synthetic failure/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_metrics").get()!.n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_daily_uniques").get()!.n, 0);
});
