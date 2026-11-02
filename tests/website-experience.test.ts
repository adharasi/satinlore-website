import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
const experience = await import(new URL("../lib/website-experience.ts", import.meta.url).href);
const { EXPERIENCE_LAYOUT, EXPERIENCE_CONSENT_VERSION, ExperienceError, validateExperienceEvents, validateExperienceViewport, readExperienceJson, experienceConsentAllowed, experienceSameOrigin, writeExperience, readExperienceOverview, readExperienceDetail, deleteExperienceSession, experienceFilters } = experience;
const origin = "https://satinlore.com", now = Date.UTC(2026, 10, 2, 12);
const start = { action: "start", v: 1, layout: EXPERIENCE_LAYOUT, viewport: { w: 1360, h: 900, dh: 9000 }, consent: true };
function request(body: unknown = start, extra: Record<string, string> = {}) { return new Request(origin + "/api/experience", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: "satinlore_consent=v2.1.1; satinlore_replay=on", "User-Agent": "Mozilla/5.0 Desktop", "CF-Connecting-IP": "192.0.2.10", ...extra }, body: JSON.stringify(body) }); }
function fixture() {
  const sqlite = new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON; CREATE TABLE rate_limits(key TEXT PRIMARY KEY,count INTEGER,expires_at INTEGER);");
  sqlite.exec(readFileSync(new URL("../drizzle/0009_website_experience.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../drizzle/0010_visual_website_replay.sql", import.meta.url), "utf8"));
  const driver = { prepare(sql: string) { let values: (string | number)[] = []; return { bind(...items: (string | number)[]) { values = items; return this; }, run() { return sqlite.prepare(sql).run(...values); }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; }, async batch(statements: { run: () => unknown }[]) { sqlite.exec("BEGIN"); try { const result = statements.map(item => item.run()); sqlite.exec("COMMIT"); return result; } catch(error) { sqlite.exec("ROLLBACK"); throw error; } } } as unknown as D1Database;
  return { sqlite, driver };
}
async function started(driver: D1Database, at = now) { return await writeExperience(driver, request(), start, "synthetic-salt", at) as { ok: boolean; sid: string; token: string; expiresAt: number; maxDurationMs: number }; }
const sample = [{ t: 1000, k: "pointer", x: 100, y: 200 }, { t: 1200, k: "click", x: 110, y: 220 }, { t: 1500, k: "scroll", y: 550 }, { t: 2000, k: "view", section: "hero", ms: 2000 }, { t: 2100, k: "toggle", target: "faq-0", open: true }] as const;
function append(session: { sid: string; token: string }, seq = 0, events: readonly unknown[] = sample) { return { action: "append", sid: session.sid, token: session.token, seq, events }; }

test("the activity schema accepts only fixed numeric geometry and coarse public enums", () => {
  assert.deepEqual(validateExperienceViewport(start.viewport), start.viewport);
  assert.deepEqual(validateExperienceEvents(sample), sample);
  for (const value of [{ ...start.viewport, email: "private@example.test" }, { w: 99, h: 900, dh: 9000 }, { w: 500, h: 900, dh: 800 }]) assert.throws(() => validateExperienceViewport(value));
  for (const value of [[{ t: 1, k: "click", x: 1, y: 2, text: "private" }], [{ t: 1, k: "input", value: "private@example.test" }], [{ t: 1, k: "view", section: "private-email", ms: 100 }], [{ t: 1, k: "toggle", target: "#private-field", open: true }], [{ t: 2, k: "scroll", y: 10 }, { t: 1, k: "scroll", y: 10 }], [{ t: 600001, k: "scroll", y: 1 }], Array.from({ length: 65 }, () => ({ t: 1, k: "click", x: 1, y: 1 }))]) assert.throws(() => validateExperienceEvents(value));
});
test("recording requires affirmative preference and honours browser privacy, global opt-out and bots", () => {
  assert.equal(experienceConsentAllowed(request()), true);
  for (const [cookie, allowed] of [["v2.0.0",false],["v2.1.0",false],["v2.0.1",true],["v2.1.1",true]] as const) assert.equal(experienceConsentAllowed(request(start,{Cookie:`satinlore_consent=${cookie}; satinlore_measurement=off`})),allowed);
  const refused: Record<string, string>[] = [{ Cookie: "" }, { Cookie: "satinlore_replay=off" }, { Cookie: "satinlore_replay=on; satinlore_measurement=off" }, { DNT: "1" }, { "Sec-GPC": "1" }, { "CF-Access-JWT-Assertion": "synthetic" }, { "User-Agent": "HeadlessChrome" }, { Purpose: "prefetch" }];
  for (const extra of refused) assert.equal(experienceConsentAllowed(request(start, extra)), false);
  assert.equal(experienceSameOrigin(request(), origin), true);
  assert.equal(experienceSameOrigin(request(start, { Origin: "https://elsewhere.example.test" }), origin), false);
  assert.equal(experienceSameOrigin(request(), "https://launch.satinlore.com"), false);
  assert.equal(experienceSameOrigin(request(start, { "Sec-Fetch-Site": "same-site" })), false);
});
test("JSON streaming is bounded and invalid UTF-8, extra payloads and content types fail before storage", async () => {
  assert.deepEqual(await readExperienceJson(request()), start);
  await assert.rejects(readExperienceJson(request(start, { "Content-Type": "text/plain" })), ExperienceError);
  await assert.rejects(readExperienceJson(request({ huge: "a".repeat(20001) })), ExperienceError);
  await assert.rejects(readExperienceJson(new Request(origin, { method: "POST", headers: { "Content-Type": "application/json" }, body: new Uint8Array([255]) })), ExperienceError);
  await assert.rejects(readExperienceJson(request(null)), ExperienceError);
});
test("real SQLite stores consent proof and a hash-only append credential without contact or network identity", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close());
  const session = await started(driver);
  assert.match(session.sid, /^[a-f0-9-]{36}$/); assert.match(session.token, /^[a-f0-9]{64}$/); assert.equal(session.maxDurationMs, 600000);
  const row = sqlite.prepare("SELECT * FROM website_experience_sessions").get()!;
  assert.equal(row.consent_version, EXPERIENCE_CONSENT_VERSION); assert.equal(row.consent_at, now); assert.equal(row.page, "/");
  assert.notEqual(row.token_hash, session.token); assert.match(String(row.token_hash), /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(row), /192\.0\.2|synthetic-salt|Mozilla|example\.test/);
  for (const body of [{ ...start, page: "/admin" }, { ...start, text: "Private text" }, { ...start, consent: false }, { ...start, layout: "other" }]) await assert.rejects(writeExperience(driver, request(body), body, "synthetic-salt", now));
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_sessions").get()?.n, 1);
});
test("append ownership, idempotency and sequence checks do not duplicate events or heatmap weight", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close()); const session = await started(driver), body = append(session);
  await assert.rejects(writeExperience(driver, request(), { ...body, token: "0".repeat(64) }, "synthetic-salt", now + 2500), /no longer/);
  await writeExperience(driver, request(), body, "synthetic-salt", now + 2500);
  assert.deepEqual(await writeExperience(driver, request(), body, "synthetic-salt", now + 2600), { ok: true, accepted: true, seq: 0, duplicate: true });
  await assert.rejects(writeExperience(driver, request(), append(session, 0, [{ t: 1000, k: "click", x: 1, y: 1 }]), "synthetic-salt", now + 2700), /changed/);
  await assert.rejects(writeExperience(driver, request(), append(session, 2), "synthetic-salt", now + 2800), /sequence/);
  const detail = await readExperienceDetail(driver, session.sid, now + 3000);
  assert.equal(detail.events.length, sample.length); assert.equal(detail.incomplete, false); assert.equal(detail.session.clicks, 1); assert.equal(detail.session.maxScroll, 55);
  const overview = await readExperienceOverview(driver, { days: 7, device: "all", page: 1 }, now + 3000);
  assert.equal(overview.summary.sessions, 1); assert.equal(overview.summary.clicks, 1); assert.equal(overview.summary.averageMaxScroll, 55);
  assert.equal(overview.heatmap.points.reduce((sum: number, point: { clicks: number }) => sum + point.clicks, 0), 1);
  assert.equal(overview.heatmap.sections.find((section: { key: string }) => section.key === "hero")?.ms, 2000);
  assert.doesNotMatch(JSON.stringify(detail), /token|hash|192\.0\.2|Mozilla/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_batches").get()?.n, 1);
});
test("withdrawal after cookie refusal and privacy signals removes replay and heatmap contributions", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close()); const session = await started(driver);
  await writeExperience(driver, request(), append(session), "synthetic-salt", now + 2500);
  const withdrawal = { action: "withdraw", sid: session.sid, token: session.token };
  await writeExperience(driver, request(withdrawal, { Cookie: "satinlore_replay=off", DNT: "1" }), withdrawal, undefined, now + 3000);
  await assert.rejects(readExperienceDetail(driver, session.sid, now + 3001), /expired|available/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_batches").get()?.n, 0);
  assert.equal((await readExperienceOverview(driver, { days: 7, device: "all", page: 1 }, now + 3001)).heatmap.points.length, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM rate_limits").get()?.n, 2, "Withdrawing does not reset abuse counters.");
});
test("duration, event and batch limits stay bounded and rate buckets do not consume signup limits", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close()); const session = await started(driver);
  await assert.rejects(writeExperience(driver, request(), append(session, 120), "synthetic-salt", now + 1));
  await assert.rejects(writeExperience(driver, request(), append(session), "synthetic-salt", now + 660001), /ended/);
  sqlite.prepare("UPDATE website_experience_sessions SET event_count=2999 WHERE id=?").run(session.sid);
  await assert.rejects(writeExperience(driver, request(), append(session), "synthetic-salt", now + 2), /limit/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_batches").get()?.n, 0);
  for (let index = 1; index < 20; index++) await started(driver);
  await assert.rejects(started(driver), /temporary limit/);
  assert.ok(sqlite.prepare("SELECT key FROM rate_limits").all().every(row => /^[a-f0-9]{64}$/.test(String(row.key))));
});
test("admin deletion and expiry exclude old replay events and retain unrelated sessions", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close()); const one = await started(driver), two = await started(driver, now + 1);
  await writeExperience(driver, request(), append(one), "synthetic-salt", now + 2500);
  await writeExperience(driver, request(), append(two), "synthetic-salt", now + 2500);
  assert.equal((await deleteExperienceSession(driver, one.sid)).deleted, true);
  assert.equal((await readExperienceOverview(driver, { days: 7, device: "all", page: 1 }, now + 3000)).total, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_batches WHERE session_id=?").get(two.sid)?.n, 1);
  sqlite.prepare("UPDATE website_experience_sessions SET expires_at=? WHERE id=?").run(now, two.sid);
  assert.equal((await readExperienceOverview(driver, { days: 7, device: "all", page: 1 }, now + 3000)).total, 0);
  await assert.rejects(readExperienceDetail(driver, two.sid, now + 3000));
  for (const params of ["days=999", "device=private", "page=-1"]) assert.throws(() => experienceFilters(new URLSearchParams(params)));
});

test("public and admin routes enforce consent, origin and owner checks without leaking storage failures", async () => {
  const compile = (name: string) => ts.transpileModule(readFileSync(new URL(name, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let writes = 0, reads = 0, owner = false;
  const publicExports: { POST?: (request: Request) => Promise<Response> } = {};
  new Function("require", "exports", compile("../app/api/experience/route.ts"))((name: string) => {
    if (name === "@/lib/website-experience") return { ...experience, writeExperience: async () => { writes++; return { ok: true }; } };
    if (name === "@/lib/waitlist-server") return { database: () => ({}), runtime: () => ({ PUBLIC_SITE_ORIGIN: origin, ABUSE_SALT: "synthetic" }), response: (body: unknown, status = 200) => Response.json(body, { status }) };
    throw new Error(name);
  }, publicExports);
  assert.equal((await publicExports.POST!(request(start, { Origin: "https://foreign.example.test" }))).status, 403); assert.equal(writes, 0);
  assert.equal((await publicExports.POST!(request())).status, 200); assert.equal(writes, 1);
  const admin: { GET?: (request: Request) => Promise<Response>; DELETE?: (request: Request) => Promise<Response> } = {};
  new Function("require", "exports", compile("../app/api/admin/experience/route.ts"))((name: string) => {
    if (name === "@/lib/website-experience") return { ...experience, readExperienceOverview: async () => { reads++; return {}; }, deleteExperienceSession: async () => { writes++; return { deleted: true }; } };
    if (name === "@/lib/waitlist-server") return { database: () => ({}), isOwner: async () => owner, response: (body: unknown, status = 200) => Response.json(body, { status }) };
    throw new Error(name);
  }, admin);
  assert.equal((await admin.GET!(new Request(origin + "/api/admin/experience"))).status, 403); assert.equal(reads, 0);
  assert.equal((await admin.DELETE!(request({ id: crypto.randomUUID() }))).status, 403); assert.equal(writes, 1);
  owner = true;
  assert.equal((await admin.GET!(new Request(origin + "/api/admin/experience?days=7"))).status, 200); assert.equal(reads, 1);
  assert.equal((await admin.DELETE!(request({ id: crypto.randomUUID() }, { Origin: "https://foreign.example.test" }))).status, 403); assert.equal(writes, 1);
});


test("visible duration excludes hidden gaps and heatmap edge coordinates stay on the canvas", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close()); const session = await started(driver);
  await writeExperience(driver, request(), append(session, 0, [
    { t: 1000, k: "click", x: 1000, y: 1000 },
    { t: 2000, k: "visibility", visible: false },
  ]), "synthetic-salt", now + 2000);
  await writeExperience(driver, request(), append(session, 1, [
    { t: 12000, k: "visibility", visible: true },
    { t: 15000, k: "view", section: "hero", ms: 3000 },
    { t: 15000, k: "view", section: "steps", ms: 3000 },
  ]), "synthetic-salt", now + 15000);
  const detail = await readExperienceDetail(driver, session.sid, now + 16000);
  assert.equal(detail.session.durationMs, 15000);
  assert.equal(detail.session.visibleMs, 5000, "Overlapping view intervals do not double-count visible time; hidden gaps are excluded.");
  const overview = await readExperienceOverview(driver, { days: 7, device: "all", page: 1 }, now + 16000);
  assert.equal(overview.heatmap.points[0].x, 987); assert.equal(overview.heatmap.points[0].y, 987);
  assert.equal(overview.summary.visibleMs, 5000);
});


test("concurrent identical append retries commit one batch and one set of counters", async t => {
  const { sqlite, driver } = fixture(); t.after(() => sqlite.close()); const session = await started(driver);
  const body = append(session);
  await Promise.all([writeExperience(driver, request(), body, "synthetic-salt", now + 2500), writeExperience(driver, request(), body, "synthetic-salt", now + 2500)]);
  const detail = await readExperienceDetail(driver, session.sid, now + 3000);
  assert.equal(detail.session.eventCount, sample.length);
  assert.equal(detail.session.clicks, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM website_experience_batches").get()?.n, 1);
});
