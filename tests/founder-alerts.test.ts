import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

// Exercise the actual helper and its real SQL. Only SES readiness, delivery,
// and the clock are replaced; no network or production database is used.
const helper = ts.transpileModule(readFileSync(new URL("../lib/founder-alerts.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type AlertInput = { firstName: string; email: string; createdAt: number };
type AlertSettings = { enabled: boolean; founderNotificationEmail: string };
type Notify = (db: unknown, settings: AlertSettings, id: string) => Promise<string>;

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE waitlist (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, first_name TEXT,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    founder_alert_state TEXT NOT NULL DEFAULT 'pending',
    founder_notified_at INTEGER, founder_alert_attempt_at INTEGER
  );
  CREATE TABLE crm_contacts (email TEXT PRIMARY KEY, stage TEXT NOT NULL);`);
  let now = 100_000_000;
  let ready = true;
  let fail = false;
  let afterSend: (() => void | Promise<void>) | undefined;
  const sent: AlertInput[] = [];
  const settings = { enabled: true, founderNotificationEmail: "team@satinlore.com" };
  const d1 = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      let parameters: SQLInputValue[] = [];
      return {
        bind(...values: SQLInputValue[]) { parameters = values; return this; },
        async first() { return statement.get(...parameters) ?? null; },
        async run() { const result = statement.run(...parameters); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
    },
  };
  const exported: { notifyFounder?: Notify } = {};
  const restrictedRequire = (specifier: string) => {
    if (specifier === "./email-readiness") return { emailCanSend: async () => ready };
    if (specifier === "./email-sender") return {
      sendFounderAlert: async (usedSettings: AlertSettings, input: AlertInput) => {
        assert.equal(usedSettings.founderNotificationEmail, "team@satinlore.com");
        if (fail) throw new Error("Simulated SES rejection");
        sent.push(input);
        if (afterSend) await afterSend();
        return "mock-message-id";
      },
    };
    throw new Error(`Unexpected dependency in founder-alerts test: ${specifier}`);
  };
  new Function("require", "exports", "Date", helper)(restrictedRequire, exported, { now: () => now });
  assert.equal(typeof exported.notifyFounder, "function");
  const notify = (id: string) => exported.notifyFounder!(d1, settings, id);
  const row = (id: string) => sqlite.prepare("SELECT * FROM waitlist WHERE id=?").get(id);
  function add(id: string, email = `${id}@example.test`, state = "pending", attempt: number | null = null, expires = now + 86_400_000) {
    sqlite.prepare("INSERT INTO waitlist (id,email,first_name,created_at,expires_at,founder_alert_state,founder_alert_attempt_at) VALUES (?,?,?,?,?,?,?)")
      .run(id, email, "Alex", now - 1, expires, state, attempt);
  }
  return {
    sqlite, sent, notify, row, add,
    get now() { return now; },
    set now(value: number) { now = value; },
    set ready(value: boolean) { ready = value; },
    set fail(value: boolean) { fail = value; },
    set afterSend(value: (() => void | Promise<void>) | undefined) { afterSend = value; },
    close: () => sqlite.close(),
  };
}

test("disabled SES preserves a durable pending alert without sending", async t => {
  const f = fixture(); t.after(f.close); f.ready = false; f.add("reader");
  assert.equal(await f.notify("reader"), "queued");
  assert.equal(f.row("reader")?.founder_alert_state, "pending");
  assert.equal(f.row("reader")?.founder_alert_attempt_at, null);
  assert.equal(f.sent.length, 0);
  f.ready = true;
  assert.equal(await f.notify("reader"), "sent");
  assert.equal(f.sent.length, 1);
});

test("blocked and expired records cannot generate founder alerts", async t => {
  const f = fixture(); t.after(f.close); f.add("blocked"); f.add("expired", "expired@example.test", "pending", null, f.now);
  f.sqlite.prepare("INSERT INTO crm_contacts (email,stage) VALUES (?,?)").run("blocked@example.test", "blocked");
  assert.equal(await f.notify("blocked"), "skipped");
  assert.equal(await f.notify("expired"), "skipped");
  assert.equal(await f.notify("missing"), "skipped");
  assert.equal(f.sent.length, 0);
  assert.equal(f.row("blocked")?.founder_alert_state, "pending");
});

test("one accepted alert suppresses repeat requests and other rows for that email", async t => {
  const f = fixture(); t.after(f.close); f.add("first", "same@example.test"); f.add("again", "same@example.test");
  assert.equal(await f.notify("first"), "sent");
  assert.equal(await f.notify("first"), "skipped");
  assert.equal(await f.notify("again"), "skipped");
  assert.equal(f.row("first")?.founder_notified_at, f.now);
  assert.equal(f.sent.length, 1);
});

test("concurrent duplicate email submissions share a single sending claim", async t => {
  const f = fixture(); t.after(f.close); f.add("first", "same@example.test"); f.add("second", "same@example.test");
  const results = await Promise.all([f.notify("first"), f.notify("second"), f.notify("first")]);
  assert.equal(results.filter(result => result === "sent").length, 1);
  assert.equal(results.filter(result => result === "skipped").length, 2);
  assert.equal(f.sent.length, 1);
});

test("delivery failure leaves a retryable row and successful retry records acceptance", async t => {
  const f = fixture(); t.after(f.close); f.add("reader"); f.fail = true;
  assert.equal(await f.notify("reader"), "failed");
  assert.equal(f.row("reader")?.founder_alert_state, "failed");
  assert.equal(f.row("reader")?.founder_notified_at, null);
  f.fail = false;
  assert.equal(await f.notify("reader"), "sent");
  assert.equal(f.row("reader")?.founder_alert_state, "sent");
  assert.equal(f.sent.length, 1);
});

test("fresh claims block duplicates and stale claims can be recovered after 15 minutes", async t => {
  const f = fixture(); t.after(f.close);
  f.add("fresh", "same@example.test", "sending", f.now - 899_999);
  f.add("duplicate", "same@example.test");
  assert.equal(await f.notify("fresh"), "skipped");
  assert.equal(await f.notify("duplicate"), "skipped");
  f.now += 2;
  assert.equal(await f.notify("fresh"), "sent");
  assert.equal(await f.notify("duplicate"), "skipped");
  assert.equal(f.sent.length, 1);
});

test("a stale worker cannot overwrite a newer claim's state after an accepted send", async t => {
  const f = fixture(); t.after(f.close); f.add("reader");
  f.afterSend = () => {
    f.sqlite.prepare("UPDATE waitlist SET founder_alert_state='sending',founder_alert_attempt_at=? WHERE id=?").run(f.now + 900_001, "reader");
  };
  await f.notify("reader");
  assert.equal(f.row("reader")?.founder_alert_state, "sending");
  assert.equal(f.row("reader")?.founder_notified_at, null);
  assert.equal(f.row("reader")?.founder_alert_attempt_at, f.now + 900_001);
});
