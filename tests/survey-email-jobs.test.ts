import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

// Use the actual durable queue queries and every append-only migration. Only
// SES delivery/readiness and the wall clock are replaced with local fixtures.
const helper = ts.transpileModule(readFileSync(new URL("../lib/survey-email-jobs.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const migrationDirectory = new URL("../drizzle/", import.meta.url);
const migrations = readdirSync(migrationDirectory).filter(name => name.endsWith(".sql")).sort()
  .map(name => readFileSync(new URL(name, migrationDirectory), "utf8"));
const secret = "synthetic-survey-secret-not-for-production";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Sent = { email: string; manageToken: string };
type Summary = { sent: number; failed: number; skipped: number; disabled: boolean };
type Options = { enabled: boolean; tokenSecret: string };
type Process = (db: unknown, settings: unknown, options: Options) => Promise<Summary>;
type DeriveToken = (secret: string, waitlistId: string, createdAt: number) => Promise<string>;

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of migrations) sqlite.exec(migration);
  let now = 100_000_000;
  let ready = true;
  let fail = false;
  let afterSend: (() => void | Promise<void>) | undefined;
  let calls = 0;
  const sent: Sent[] = [];
  const settings = { enabled: true, welcomeEnabled: false, fromEmail: "team@satinlore.com", publicOrigin: "https://satinlore.com" };
  const d1 = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      let parameters: SQLInputValue[] = [];
      return {
        bind(...values: SQLInputValue[]) { parameters = values; return this; },
        async first() { return statement.get(...parameters) ?? null; },
        async all() { return { success: true, results: statement.all(...parameters) }; },
        async run() { const result = statement.run(...parameters); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
    },
  };
  const exported: { processSurveyEmailJobs?: Process; surveyManageToken?: DeriveToken; SURVEY_DELAY_MS?: number } = {};
  const restrictedRequire = (specifier: string) => {
    if (specifier === "./email-readiness") return { emailCanSend: async () => ready };
    if (specifier === "./email-sender") return {
      sendSurveyInvitation: async (usedSettings: typeof settings, input: Sent) => {
        assert.equal(usedSettings, settings);
        calls++;
        if (fail) throw new Error("Simulated SES rejection");
        sent.push(input);
        if (afterSend) await afterSend();
        return "mock-message-id";
      },
    };
    throw new Error(`Unexpected dependency in survey queue test: ${specifier}`);
  };
  new Function("require", "exports", "Date", helper)(restrictedRequire, exported, { now: () => now });
  assert.equal(typeof exported.processSurveyEmailJobs, "function");
  assert.equal(exported.SURVEY_DELAY_MS, 300_000);
  const process = (options: Partial<Options> = {}) => exported.processSurveyEmailJobs!(d1, settings, { enabled: true, tokenSecret: secret, ...options });
  const job = (email = "reader@example.test") => sqlite.prepare("SELECT * FROM survey_email_jobs WHERE email=?").get(email);
  const row = (id = "reader") => sqlite.prepare("SELECT * FROM waitlist WHERE id=?").get(id);
  function add(id = "reader", email = `${id}@example.test`, verified = false, expires = now + 86_400_000) {
    sqlite.prepare(`INSERT INTO waitlist (id,email,first_name,token_hash,previous_token_hash,created_at,expires_at,consent_version,email_verified,confirmed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, email, "Alex", hash(`current:${id}`), hash(`previous:${id}`), now - 1, expires, "synthetic-consent", verified ? 1 : 0, verified ? now : null);
  }
  function verify(id = "reader") {
    sqlite.prepare("UPDATE waitlist SET email_verified=1,confirmed_at=? WHERE id=?").run(now, id);
  }
  return {
    sqlite, sent, process, job, row, add, verify, deriveToken: exported.surveyManageToken!,
    get now() { return now; }, set now(value: number) { now = value; },
    get calls() { return calls; },
    set ready(value: boolean) { ready = value; }, set fail(value: boolean) { fail = value; },
    set afterSend(value: (() => void | Promise<void>) | undefined) { afterSend = value; },
    close: () => sqlite.close(),
  };
}

test("verification atomically queues one email five minutes later without a historical backfill", async t => {
  const f = fixture(); t.after(f.close);
  f.add("past", "past@example.test", true);
  f.add();
  assert.equal(f.job(), undefined);
  f.verify();
  assert.equal(f.job()?.waitlist_id, "reader");
  assert.equal(f.job()?.due_at, f.now + 300_000);
  assert.equal(f.job()?.next_attempt_at, f.now + 300_000);
  f.verify(); // Replayed verification does not enqueue another invitation.
  f.add("duplicate", "reader@example.test"); f.verify("duplicate");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM survey_email_jobs").get()?.count, 1);
  assert.equal(f.job()?.waitlist_id, "reader");
  assert.equal(f.job("past@example.test"), undefined);
});

test("durable processing never sends before five minutes and repeated ticks do not resend", async t => {
  const f = fixture(); t.after(f.close); f.add(); f.verify();
  f.now += 299_999;
  assert.equal((await f.process()).sent, 0);
  assert.equal(f.calls, 0);
  f.now++;
  assert.equal((await f.process()).sent, 1);
  assert.equal(f.job()?.state, "sent");
  assert.equal(f.job()?.sent_at, f.now);
  assert.equal(f.job()?.attempts, 1);
  f.now += 60_000;
  assert.equal((await f.process()).sent, 0);
  assert.equal(f.calls, 1);
});

test("concurrent cron ticks claim the same email once", async t => {
  const f = fixture(); t.after(f.close); f.add(); f.verify(); f.now += 300_000;
  const results = await Promise.all([f.process(), f.process(), f.process()]);
  assert.equal(results.reduce((sum, result) => sum + result.sent, 0), 1);
  assert.equal(f.calls, 1);
  assert.equal(f.job()?.attempts, 1);
});

test("disabled invites, missing link secret and unavailable SES retain pending work", async t => {
  const f = fixture(); t.after(f.close); f.add(); f.verify(); f.now += 300_000;
  assert.equal((await f.process({ enabled: false })).disabled, true);
  assert.equal((await f.process({ tokenSecret: "" })).disabled, true);
  f.ready = false;
  assert.equal((await f.process()).disabled, true);
  assert.equal(f.calls, 0);
  assert.equal(f.job()?.state, "pending");
  assert.equal(f.job()?.attempts, 0);
  f.ready = true;
  assert.equal((await f.process()).sent, 1);
});

test("blocked, expired, withdrawn and no-longer-verified recipients cannot be sent invitations", async t => {
  const f = fixture(); t.after(f.close);
  for (const id of ["blocked", "expired", "deleted", "unverified"]) { f.add(id); f.verify(id); }
  f.sqlite.prepare("INSERT INTO crm_contacts (email,stage,updated_at) VALUES (?,?,?)").run("blocked@example.test", "blocked", f.now);
  f.sqlite.prepare("UPDATE waitlist SET expires_at=? WHERE id='expired'").run(f.now);
  f.sqlite.exec("DELETE FROM waitlist WHERE id='deleted'; UPDATE waitlist SET email_verified=0 WHERE id='unverified'");
  f.now += 300_000;
  assert.equal((await f.process()).sent, 0);
  assert.equal(f.calls, 0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM survey_email_jobs WHERE state='cancelled'").get()?.count, 4);
});

test("SES errors retry only when due and stop after five total attempts", async t => {
  const f = fixture(); t.after(f.close); f.add(); f.verify(); f.now += 300_000; f.fail = true;
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.equal((await f.process()).failed, 1);
    assert.equal(f.job()?.state, "failed");
    assert.equal(f.job()?.attempts, attempt);
    assert.equal(f.job()?.sent_at, null);
    const retryAt = Number(f.job()?.next_attempt_at);
    assert.ok(retryAt > f.now);
    f.now = retryAt - 1;
    assert.equal((await f.process()).failed, 0);
    f.now++;
  }
  assert.equal(f.calls, 5);
  f.fail = false; f.now += 30 * 86_400_000;
  assert.equal((await f.process()).sent, 0);
  assert.equal(f.calls, 5);
});

test("retry acceptance reuses a stable private link and preserves both earlier manage links", async t => {
  const f = fixture(); t.after(f.close); f.add(); f.verify(); f.now += 300_000; f.fail = true;
  const current = f.row()?.token_hash;
  const previous = f.row()?.previous_token_hash;
  await f.process();
  const failedHash = f.row()?.survey_token_hash;
  assert.match(String(failedHash), /^[a-f0-9]{64}$/);
  f.fail = false; f.now = Number(f.job()?.next_attempt_at);
  assert.equal((await f.process()).sent, 1);
  assert.equal(f.row()?.survey_token_hash, failedHash);
  assert.equal(f.row()?.survey_token_hash, hash(f.sent[0].manageToken));
  assert.equal(f.row()?.token_hash, current);
  assert.equal(f.row()?.previous_token_hash, previous);
  const persisted = JSON.stringify({ waitlist: f.row(), job: f.job() });
  assert.ok(!persisted.includes(f.sent[0].manageToken), "raw link credentials must not be stored in D1");
  assert.ok(!persisted.includes(secret), "signing secrets must not be stored in D1");
});

test("fresh claims block sends and crashed claims become retryable after fifteen minutes", async t => {
  const f = fixture(); t.after(f.close); f.add(); f.verify(); f.now += 300_000;
  f.sqlite.prepare("UPDATE survey_email_jobs SET state='sending',attempts=1,attempt_at=?").run(f.now - 899_999);
  assert.equal((await f.process()).sent, 0);
  f.now += 2;
  assert.equal((await f.process()).sent, 1);
  assert.equal(f.job()?.attempts, 2);
  assert.equal(f.calls, 1);
});

test("an older worker cannot overwrite a newer claim after SES acceptance", async t => {
  const f = fixture(); t.after(f.close); f.add(); f.verify(); f.now += 300_000;
  f.afterSend = () => {
    f.sqlite.prepare("UPDATE survey_email_jobs SET state='sending',attempt_at=? WHERE email=?").run(f.now + 900_001, "reader@example.test");
  };
  await f.process();
  assert.equal(f.job()?.state, "sending");
  assert.equal(f.job()?.sent_at, null);
  assert.equal(f.job()?.attempt_at, f.now + 900_001);
});

test("each minute tick drains a bounded batch and later ticks continue remaining work", async t => {
  const f = fixture(); t.after(f.close);
  for (let i = 0; i < 11; i++) { f.add(`reader-${i}`); f.verify(`reader-${i}`); }
  f.now += 300_000;
  assert.equal((await f.process()).sent, 10);
  assert.equal((await f.process()).sent, 1);
  assert.equal(f.calls, 11);
});

test("management tokens are deterministic, scoped to a queue record and require a private secret", async t => {
  const f = fixture(); t.after(f.close);
  const token = await f.deriveToken(secret, "reader", f.now);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(await f.deriveToken(secret, "reader", f.now), token);
  assert.notEqual(await f.deriveToken(secret, "other", f.now), token);
  assert.notEqual(await f.deriveToken(secret, "reader", f.now + 1), token);
  assert.notEqual(await f.deriveToken(`${secret}-rotated`, "reader", f.now), token);
  await assert.rejects(f.deriveToken("short", "reader", f.now));
  await assert.rejects(f.deriveToken(secret, "", f.now));
  await assert.rejects(f.deriveToken(secret, "reader", Number.NaN));
});
