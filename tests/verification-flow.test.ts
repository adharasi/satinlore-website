import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

// Execute the real routes and SQL, replacing only the Workers boundary,
// sender, settings, and clock. No real email or production record is used.
function compile(path: string) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const confirmSource = compile("../app/api/confirm/route.ts");
const manageSource = compile("../app/api/manage/route.ts");
const suppressionSource = compile("../lib/email-suppression.ts");
const suppression:Record<string,unknown> = {};
new Function("exports",suppressionSource)(suppression);
const validationSource = compile("../lib/waitlist-validation.ts");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const initialToken = "b".repeat(64);
const confirmationToken = "c".repeat(64);
const rotatedToken = "d".repeat(64);
type Row = Record<string, string | number | bigint | Uint8Array | null>;
type Statement = {
  bind(...values: SQLInputValue[]): Statement;
  first(): Promise<Row | null>;
  run(): Promise<{ success: boolean }>;
};
type Route = (request: Request) => Promise<Response>;

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE waitlist (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, first_name TEXT,
    token_hash TEXT NOT NULL, previous_token_hash TEXT, survey_token_hash TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    confirmation_hash TEXT, confirmation_expires_at INTEGER,
    confirmed_at INTEGER, expires_at INTEGER NOT NULL,
    email_state TEXT NOT NULL DEFAULT 'confirmation_sent', welcome_sent_at INTEGER,
    newsletter INTEGER NOT NULL DEFAULT 1, newsletter_consent_at INTEGER,
    model TEXT, phone TEXT, interest TEXT
  );
  CREATE TABLE crm_contacts (email TEXT PRIMARY KEY, stage TEXT NOT NULL, notes TEXT);
  CREATE TABLE email_suppressions(email_hash TEXT,purpose TEXT,suppressed_at INTEGER,PRIMARY KEY(email_hash,purpose));
  CREATE TABLE survey_email_jobs (email TEXT PRIMARY KEY);
  CREATE TABLE questionnaire_responses (email TEXT PRIMARY KEY);`);
  const now = 100_000_000;
  let tokenCalls = 0;
  let welcomeCalls = 0;
  const db = {
    prepare(sql: string): Statement {
      const statement = sqlite.prepare(sql);
      let parameters: SQLInputValue[] = [];
      return {
        bind(...values: SQLInputValue[]) { parameters = values; return this; },
        async first() { return statement.get(...parameters) as Row | undefined ?? null; },
        async run() { statement.run(...parameters); return { success: true }; },
      };
    },
    async batch(statements: Statement[]) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const validation: Record<string, unknown> = {};
  new Function("exports", validationSource)(validation);
  const server = {
    database: () => db,
    runtime: () => ({ABUSE_SALT:"synthetic-verification-test-abuse-salt"}),
    hash: async (value: string) => digest(value),
    newToken: () => { tokenCalls++; return rotatedToken; },
    cleanExpired: async () => {
      sqlite.prepare("DELETE FROM waitlist WHERE expires_at<=?").run(now);
      sqlite.exec("DELETE FROM crm_contacts WHERE NOT EXISTS (SELECT 1 FROM waitlist WHERE waitlist.email=crm_contacts.email)");
    },
    jsonBody: async (request: Request) => {
      assert.equal(request.headers.get("origin"), "https://satinlore.com");
      return request.json();
    },
    response: (body: unknown, status = 200) => Response.json(body, { status }),
    failed: (error: unknown) => { throw error; },
  };
  const restrictedRequire = (specifier: string) => {
    if (specifier === "@/lib/waitlist-validation") return validation;
    if (specifier === "@/lib/email-suppression") return suppression;
    if (specifier === "@/lib/waitlist-server") return server;
    if (specifier === "@/lib/email-settings") return { emailSettings: () => ({ enabled: true, welcomeEnabled: false }) };
    if (specifier === "@/lib/email-sender") return {
      emailIsReady: () => true,
      sendWelcome: async () => { welcomeCalls++; return "mock-message-id"; },
    };
    throw new Error(`Unexpected verification test dependency: ${specifier}`);
  };
  function load(source: string) {
    const exported: { POST?: Route } = {};
    new Function("require", "exports", "Date", source)(restrictedRequire, exported, { now: () => now });
    assert.equal(typeof exported.POST, "function");
    return exported.POST!;
  }
  const confirm = load(confirmSource);
  const manage = load(manageSource);
  function call(route: Route, body: unknown) {
    return route(new Request("https://satinlore.com/api/test", { method: "POST", headers: { "Origin": "https://satinlore.com", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  }
  function add(id = "reader", email = "reader@example.test", token = initialToken, confirmed = false) {
    sqlite.prepare("INSERT INTO waitlist (id,email,first_name,token_hash,email_verified,confirmation_hash,confirmation_expires_at,expires_at,model,phone,interest,newsletter,newsletter_consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, email, "Alex", digest(token), confirmed ? 1 : 0, digest(confirmationToken), now + 86_400_000, now + 30 * 86_400_000, "Any brand", "iPhone", "updates", 1, now - 1);
  }
  return {
    sqlite, now, add,
    confirm: (token = confirmationToken) => call(confirm, { token }),
    manage: (token: string, action = "get", extra: Record<string, unknown> = {}) => call(manage, { token, action, ...extra }),
    row: (id = "reader") => sqlite.prepare("SELECT * FROM waitlist WHERE id=?").get(id),
    get tokenCalls() { return tokenCalls; },
    get welcomeCalls() { return welcomeCalls; },
    close: () => sqlite.close(),
  };
}

test("welcome-off verification rotates hashed credentials without sending a welcome email", async t => {
  const f = fixture(); t.after(f.close); f.add();
  const result = await f.confirm();
  assert.equal(result.status, 200);
  const body = await result.json() as {ok:boolean;manageToken:string;welcomeSent:boolean};
  assert.equal(body.ok, true);
  assert.equal(body.manageToken, rotatedToken);
  assert.equal(body.welcomeSent, false);
  assert.equal(f.welcomeCalls, 0);
  const row = f.row()!;
  assert.equal(row.email_verified, 1);
  assert.equal(row.confirmed_at, f.now);
  assert.equal(row.email_state, "confirmed");
  assert.equal(row.welcome_sent_at, null);
  assert.equal(row.token_hash, digest(rotatedToken));
  assert.equal(row.previous_token_hash, digest(initialToken));
  assert.equal(row.confirmation_hash, digest(confirmationToken));
  const persisted = JSON.stringify(row);
  for (const raw of [initialToken, confirmationToken, rotatedToken]) assert.equal(persisted.includes(raw), false);
  assert.equal((await f.manage(rotatedToken)).status, 200);
  assert.equal((await f.manage(initialToken)).status, 200);
});

test("confirmation replay issues no new management credential or welcome email", async t => {
  const f = fixture(); t.after(f.close); f.add();
  await f.confirm();
  const replay = await f.confirm();
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { ok: true, alreadyConfirmed: true });
  assert.equal(f.tokenCalls, 1);
  assert.equal(f.welcomeCalls, 0);
  assert.equal(f.row()?.previous_token_hash, digest(initialToken));
});

test("original email management link can withdraw newsletter consent and delete all matching rows plus CRM", async t => {
  const f = fixture(); t.after(f.close); f.add();
  await f.confirm();
  f.add("duplicate", "reader@example.test", "e".repeat(64));
  f.add("other", "other@example.test", "f".repeat(64));
  f.sqlite.prepare("INSERT INTO crm_contacts VALUES (?,?,?)").run("reader@example.test", "invited", "Follow up");
  f.sqlite.prepare("INSERT INTO crm_contacts VALUES (?,?,?)").run("other@example.test", "new", "Keep this");
  const current = await f.manage(initialToken);
  assert.equal(current.status, 200);
  const profileBody = await current.json() as {profile:{model:string}};
  assert.equal(profileBody.profile.model, "Any brand");
  const unsubscribe = await f.manage(initialToken, "newsletter", { newsletter: false });
  assert.equal(unsubscribe.status, 200);
  assert.equal(f.row()?.newsletter, 0);
  assert.equal(f.row("duplicate")?.newsletter, 0);
  assert.equal(f.row("duplicate")?.newsletter_consent_at, null);
  assert.equal(f.row("other")?.newsletter, 1);
  const deletion = await f.manage(initialToken, "delete");
  assert.equal(deletion.status, 200);
  assert.deepEqual(await deletion.json(), { ok: true, deleted: true });
  assert.equal(f.row(), undefined);
  assert.equal(f.row("duplicate"), undefined);
  assert.equal(f.sqlite.prepare("SELECT * FROM crm_contacts WHERE email=?").get("reader@example.test"), undefined);
  assert.ok(f.row("other"));
  assert.ok(f.sqlite.prepare("SELECT * FROM crm_contacts WHERE email=?").get("other@example.test"));
});

test("previous-token hashes on unchecked rows cannot expose or change an address", async t => {
  const f = fixture(); t.after(f.close); f.add();
  const invalidPreviousToken = "a".repeat(64);
  f.sqlite.prepare("UPDATE waitlist SET previous_token_hash=? WHERE id='reader'").run(digest(invalidPreviousToken));
  assert.equal((await f.manage(invalidPreviousToken)).status, 404);
  assert.equal((await f.manage(invalidPreviousToken, "newsletter", { newsletter: false })).status, 404);
  assert.equal(f.row()?.newsletter, 1);
  await f.manage(invalidPreviousToken, "delete");
  assert.ok(f.row());
  assert.equal((await f.manage(initialToken)).status, 200);
});

test("expired entries reject both current and original management credentials", async t => {
  const f = fixture(); t.after(f.close); f.add(); await f.confirm();
  f.sqlite.prepare("UPDATE waitlist SET expires_at=? WHERE id='reader'").run(f.now);
  assert.equal((await f.manage(initialToken)).status, 404);
  assert.equal((await f.manage(rotatedToken)).status, 404);
  assert.equal((await f.manage(initialToken, "newsletter", { newsletter: false })).status, 404);
  assert.equal(f.row(), undefined);
});

test("expired confirmation links cannot verify a reader", async t => {
  const f = fixture(); t.after(f.close); f.add();
  f.sqlite.prepare("UPDATE waitlist SET confirmation_expires_at=? WHERE id='reader'").run(f.now);
  assert.equal((await f.confirm()).status, 410);
  assert.equal(f.row()?.email_verified, 0);
  assert.equal(f.row()?.previous_token_hash, null);
  assert.equal(f.tokenCalls, 0);
  assert.equal(f.welcomeCalls, 0);
});

test("survey private link can opt out and leave without deleting a separate survey or draw record", async t => {
  const f = fixture(); t.after(f.close); f.add("reader", "reader@example.test", initialToken, true);
  const surveyToken="e".repeat(64);
  f.sqlite.prepare("UPDATE waitlist SET survey_token_hash=? WHERE id='reader'").run(digest(surveyToken));
  f.sqlite.prepare("INSERT INTO questionnaire_responses(email) VALUES (?)").run("reader@example.test");
  f.sqlite.prepare("INSERT INTO survey_email_jobs(email) VALUES (?)").run("reader@example.test");
  f.sqlite.prepare("INSERT INTO crm_contacts(email,stage,notes) VALUES (?,?,?)").run("reader@example.test","new","Keep draw contact admin");
  assert.equal((await f.manage(surveyToken,"get")).status,200);
  assert.equal((await f.manage(surveyToken,"newsletter",{newsletter:false})).status,200);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM email_suppressions").get()?.n,1);
  assert.equal((await f.manage(surveyToken,"delete")).status,200);
  assert.equal(f.row(),undefined);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM survey_email_jobs").get()?.n,0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM questionnaire_responses").get()?.n,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM crm_contacts").get()?.n,1);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM email_suppressions").get()?.n,1);
});

test("a survey-token hash on an unchecked row grants no access and cannot clear a marketing opt-out", async t => {
  const f = fixture(); t.after(f.close); f.add();
  const token="e".repeat(64);
  f.sqlite.prepare("UPDATE waitlist SET survey_token_hash=? WHERE id='reader'").run(digest(token));
  f.sqlite.prepare("INSERT INTO email_suppressions VALUES (?,?,?)").run("synthetic-optout","marketing",f.now);
  assert.equal((await f.manage(token,"get")).status,404);
  assert.equal((await f.manage(token,"newsletter",{newsletter:true})).status,404);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM email_suppressions").get()?.n,1);
});
