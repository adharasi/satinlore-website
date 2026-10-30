import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
const surveyModule = await import(new URL("../lib/survey.ts", import.meta.url).href);
const { authenticateSurvey, normalizeSurvey, SURVEY_FORM_ID, SURVEY_SCHEMA_VERSION, SurveyError, UPSERT_SURVEY_SQL, surveyBindings } = surveyModule;
const { CRM_CONTACTS_SQL } = await import(new URL("../lib/crm-query.ts", import.meta.url).href);

const now = Date.UTC(2026, 9, 30, 12);
const secret = "synthetic-only-secret-".repeat(3);
function payload(extra: Record<string, unknown> = {}) {
  return { formId: SURVEY_FORM_ID, schemaVersion: SURVEY_SCHEMA_VERSION, responseId: "synthetic_response_1", submittedAt: new Date(now).toISOString(), answers: {
    "614059161": "Yes", "724509485": " Reader@Example.Test ", "388196135": "United Kingdom",
    "1636108674": "Most days", "663259038": "Mostly screen", "1632549206": "iPhone", "570311130": ["Kindle"],
    "1592794838": "10–20 minutes", "1648945763": "25–34", "1975676399": "Woman",
    "1017609352": "No, skip these questions", "1705000425": "Paid tests", "1125137244": "Maybe",
    "145764606": "Yes", "540649580": "Yes", "766322174": [], ...extra,
  } };
}
function signed(body: unknown, timestamp = now, signatureOverride?: string) {
  const raw = JSON.stringify(body); const timestampString = String(timestamp);
  return new Request("https://satinlore.com/api/integrations/questionnaire", { method: "POST", headers: { "Content-Type": "application/json", "X-SatinLore-Timestamp": timestampString, "X-SatinLore-Signature": signatureOverride || createHmac("sha256", secret).update(`${timestampString}.${raw}`).digest("hex") }, body: raw });
}

test("final survey normalizes email without changing aliases and separates consent", () => {
  const result = normalizeSurvey(payload({ "724509485": " Alex+Reading@Example.Test ", "766322174": ["Yes"], "145764606": "No" }), now)!;
  assert.equal(result.email, "alex+reading@example.test");
  assert.equal(result.contactConsent, false); assert.equal(result.marketingConsent, true); assert.equal(result.prizeDraw, true);
  assert.equal(result.sensitiveConsent, false);
});
test("intimate answers are discarded when the reader skips sensitive research", () => {
  const result = normalizeSurvey(payload({ "1772532114": ["Synthetic genre"], "1394596703": "Synthetic model", "1980452728": ["Synthetic brand"] }), now)!;
  assert.equal(result.answers.genres, undefined); assert.equal(result.answers.toyModels, undefined); assert.equal(result.answers.toyBrands, undefined);
  const agreed = normalizeSurvey(payload({ "1017609352": "Yes, I agree", "1980452728": ["Lovense"] }), now)!;
  assert.deepEqual(agreed.answers.toyBrands, ["Lovense"]);
});
test("underage exit is ignored without storing an email; missing required answers fail", () => {
  assert.equal(normalizeSurvey(payload({ "614059161": "No" }), now), null);
  assert.throws(() => normalizeSurvey(payload({ "145764606": undefined }), now), SurveyError);
  assert.throws(() => normalizeSurvey({ ...payload(), schemaVersion: "unknown" }, now), SurveyError);
});
test("webhook authenticates exact body and rejects altered, stale, unsigned, oversized requests", async () => {
  assert.equal((await authenticateSurvey(signed(payload()), secret, now))?.email, "reader@example.test");
  await assert.rejects(authenticateSurvey(signed(payload(), now, "0".repeat(64)), secret, now), /signature/);
  await assert.rejects(authenticateSurvey(signed(payload(), now - 300001), secret, now), /signature/);
  await assert.rejects(authenticateSurvey(signed(payload()), undefined, now), /not configured/);
  await assert.rejects(authenticateSurvey(signed({ ...payload(), excess: "x".repeat(110000) }), secret, now), /too large/);
  const altered = signed(payload());
  const replacement = new Request(altered.url, { method: "POST", headers: altered.headers, body: JSON.stringify(payload({ "540649580": "No" })) });
  await assert.rejects(authenticateSurvey(replacement, secret, now), /signature/);
});

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE waitlist(id TEXT PRIMARY KEY,email TEXT,first_name TEXT,email_verified INTEGER,email_state TEXT,founder_alert_state TEXT,founder_notified_at INTEGER,model TEXT,phone TEXT,interest TEXT,source TEXT,newsletter INTEGER,consent_version TEXT,created_at INTEGER,confirmed_at INTEGER,expires_at INTEGER);
CREATE TABLE crm_contacts(email TEXT PRIMARY KEY,stage TEXT,notes TEXT,updated_at INTEGER);
CREATE TABLE questionnaire_responses(email TEXT PRIMARY KEY,response_id TEXT NOT NULL UNIQUE,submitted_at INTEGER NOT NULL,received_at INTEGER NOT NULL,schema_version TEXT NOT NULL,answers_json TEXT NOT NULL,sensitive_consent INTEGER NOT NULL,contact_consent INTEGER NOT NULL,marketing_consent INTEGER NOT NULL,prize_draw INTEGER NOT NULL,expires_at INTEGER NOT NULL);`);
  return db;
}
test("same email merges with a verified waitlist row; survey-only readers remain visible and unchecked", t => {
  const db = fixture(); t.after(() => db.close());
  const survey = normalizeSurvey(payload(), now)!;
  db.prepare(UPSERT_SURVEY_SQL).get(...surveyBindings(survey, now));
  let rows = db.prepare(CRM_CONTACTS_SQL).all(now, now, now);
  assert.equal(rows.length, 1); assert.equal(rows[0].email_verified, 0); assert.equal(rows[0].waitlist_id, null);
  db.prepare("INSERT INTO waitlist(id,email,first_name,email_verified,email_state,source,newsletter,created_at,confirmed_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run("waitlist_1", "reader@example.test", "Alex", 1, "confirmed", "direct", 0, now - 1000, now - 500, now + 100000);
  rows = db.prepare(CRM_CONTACTS_SQL).all(now, now, now);
  assert.equal(rows.length, 1); assert.equal(rows[0].waitlist_id, "waitlist_1"); assert.equal(rows[0].email_verified, 1);
  assert.equal(rows[0].survey_response_id, "synthetic_response_1"); assert.equal(rows[0].survey_contact_consent, 1); assert.equal(rows[0].newsletter, 0);
});
test("newest survey replaces old answers and consent without duplicate cash draw entries", t => {
  const db = fixture(); t.after(() => db.close());
  const first = normalizeSurvey(payload({ "1017609352": "Yes, I agree", "1980452728": ["Lovense"], "766322174": ["Yes"] }), now)!;
  assert.ok(db.prepare(UPSERT_SURVEY_SQL).get(...surveyBindings(first, now)));
  assert.equal(db.prepare(UPSERT_SURVEY_SQL).get(...surveyBindings(first, now + 1)), undefined);
  const latest = normalizeSurvey({ ...payload({ "145764606": "No", "540649580": "No" }), responseId: "synthetic_response_2", submittedAt: new Date(now + 1000).toISOString() }, now + 1000)!;
  assert.ok(db.prepare(UPSERT_SURVEY_SQL).get(...surveyBindings(latest, now + 1000)));
  assert.equal(db.prepare(UPSERT_SURVEY_SQL).get(...surveyBindings(first, now + 2000)), undefined);
  const row = db.prepare("SELECT * FROM questionnaire_responses").get()!;
  assert.equal(db.prepare("SELECT COUNT(*) total FROM questionnaire_responses").get()?.total, 1);
  assert.equal(row.contact_consent, 0); assert.equal(row.marketing_consent, 0); assert.equal(row.prize_draw, 0);
  assert.equal(JSON.parse(String(row.answers_json)).toyBrands, undefined);
});
test("webhook persists signed responses, rejects changed-email response edits, and ignores unsigned requests", async t => {
  const db = fixture(); t.after(() => db.close());
  const compiled = ts.transpileModule(readFileSync(new URL("../app/api/integrations/questionnaire/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported: { POST?: (request: Request) => Promise<Response> } = {};
  const driver = { prepare(sql: string) { const statement = db.prepare(sql); let values: (string | number)[] = []; return { bind(...bound: (string | number)[]) { values = bound; return this; }, async first() { return statement.get(...values) || null; } }; } };
  const restrictedRequire = (specifier: string) => {
    if (specifier === "@/lib/survey") return surveyModule;
    if (specifier === "@/lib/waitlist-server") return { database: () => driver, runtime: () => ({ QUESTIONNAIRE_WEBHOOK_SECRET: secret }), response: (body: unknown, status = 200) => Response.json(body, { status }) };
    throw new Error(`Unexpected module ${specifier}`);
  };
  new Function("require", "exports", "Date", compiled)(restrictedRequire, exported, { now: () => now });
  const route = exported.POST!;
  assert.equal((await route(signed(payload()))).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM questionnaire_responses").get()?.total, 1);
  assert.equal((await route(signed(payload({ "724509485": "different@example.test" })))).status, 409);
  assert.equal(db.prepare("SELECT email FROM questionnaire_responses").get()?.email, "reader@example.test");
  assert.equal((await route(signed(payload(), now, "0".repeat(64)))).status, 401);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM questionnaire_responses").get()?.total, 1);
});

test("founder can save a survey-only contact's stage without changing consent; unauthenticated updates fail", async t => {
  const db = fixture(); t.after(() => db.close());
  db.prepare(UPSERT_SURVEY_SQL).get(...surveyBindings(normalizeSurvey(payload(), now)!, now));
  const compiled = ts.transpileModule(readFileSync(new URL("../app/api/admin/crm/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const validation = await import(new URL("../lib/crm-validation.ts", import.meta.url).href);
  let owner = false;
  const driver = { prepare(sql: string) { const statement = db.prepare(sql); let values: (string | number)[] = []; return { bind(...bound: (string | number)[]) { values = bound; return this; }, async first() { return statement.get(...values) || null; } }; } };
  const exported: { POST?: (request: Request) => Promise<Response> } = {};
  const restrictedRequire = (specifier: string) => {
    if (specifier === "@/lib/crm-validation") return validation;
    if (specifier === "@/lib/waitlist-server") return { database: () => driver, isOwner: async () => owner, jsonBody: (request: Request) => request.json(), response: (body: unknown, status = 200) => Response.json(body, { status }), failed: (error: unknown) => { throw error; } };
    throw new Error(`Unexpected module ${specifier}`);
  };
  new Function("require", "exports", "Date", compiled)(restrictedRequire, exported, { now: () => now });
  const call = () => exported.POST!(new Request("https://satinlore.com/api/admin/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "survey", id: "synthetic_response_1", stage: "invited", notes: "Invite for a test." }) }));
  assert.equal((await call()).status, 403);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM crm_contacts").get()?.total, 0);
  owner = true;
  assert.equal((await call()).status, 200);
  const row = db.prepare("SELECT * FROM crm_contacts").get()!;
  assert.equal(row.email, "reader@example.test"); assert.equal(row.stage, "invited");
  const survey = db.prepare("SELECT * FROM questionnaire_responses").get()!;
  assert.equal(survey.marketing_consent, 0); assert.equal(survey.contact_consent, 1);
});
