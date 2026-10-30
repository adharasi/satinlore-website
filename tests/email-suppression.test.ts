import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
const { marketingSuppressionHash, withMarketingSuppression } = await import(new URL("../lib/email-suppression.ts", import.meta.url).href);
const salt = "synthetic-only-abuse-salt-for-tests";

test("marketing suppression uses a keyed normalized digest without exposing email or collapsing aliases", async () => {
  const digest = await marketingSuppressionHash(" Reader+Books@Example.Test ", salt);
  assert.equal(digest, createHmac("sha256", salt).update("email-suppression:reader+books@example.test").digest("hex"));
  assert.notEqual(digest, await marketingSuppressionHash("reader@example.test", salt));
  assert.notEqual(digest, await marketingSuppressionHash("reader+books@example.test", salt + "different"));
  assert.equal(digest.includes("reader"), false);
  await assert.rejects(marketingSuppressionHash("reader@example.test", undefined), /not configured/);
});
test("CRM applies persistent marketing opt-out across all rows without rewriting consent", async t => {
  const sqlite = new DatabaseSync(":memory:"); t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE email_suppressions(email_hash TEXT,purpose TEXT,suppressed_at INTEGER,PRIMARY KEY(email_hash,purpose))");
  const hash = await marketingSuppressionHash("reader@example.test", salt);
  sqlite.prepare("INSERT INTO email_suppressions VALUES(?,?,?)").run(hash, "marketing", 1);
  const researchHash = await marketingSuppressionHash("other@example.test", salt);
  sqlite.prepare("INSERT INTO email_suppressions VALUES(?,?,?)").run(researchHash, "research", 1);
  let maximumBindings = 0;
  const db = { prepare(sql: string) { const statement = sqlite.prepare(sql); let parameters: SQLInputValue[] = []; return { bind(...values: SQLInputValue[]) { parameters = values; maximumBindings = Math.max(maximumBindings, values.length); return this; }, async all() { return { results: statement.all(...parameters) }; } }; } };
  const contacts = [{ email: "Reader@Example.Test", newsletter: 1, survey_marketing_consent: 1 }, { email: "other@example.test", newsletter: 0, survey_marketing_consent: 1 }, ...Array.from({ length: 210 }, (_, i) => ({ email: `synthetic${i}@example.test`, newsletter: 0, survey_marketing_consent: 0 }))];
  const result = await withMarketingSuppression(db, contacts, salt);
  assert.equal(result[0].marketing_suppressed, true); assert.equal(result[0].newsletter, 1); assert.equal(result[0].survey_marketing_consent, 1);
  assert.equal(result[1].marketing_suppressed, false);
  assert.equal(result.length, contacts.length);
  assert.ok(maximumBindings <= 91);
  assert.equal(contacts[0].newsletter, 1);
});
