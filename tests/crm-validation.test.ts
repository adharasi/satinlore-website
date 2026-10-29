import assert from "node:assert/strict";
import test from "node:test";

const { validCrmNotes, validCrmRecordId, validCrmStage } = await import(new URL("../lib/crm-validation.ts", import.meta.url).href);

test("CRM stages stay in the supported founder workflow", () => {
  for (const stage of ["new", "contacted", "invited", "testing", "completed", "blocked"]) assert.equal(validCrmStage(stage), true);
  for (const stage of ["verified", "paid", "<script>", "NEW", null, {}]) assert.equal(validCrmStage(stage), false);
});

test("CRM notes support readable lines while rejecting oversized text and controls", () => {
  assert.equal(validCrmNotes("  Invite next week.\r\nAsked for a demo.  "), "Invite next week.\nAsked for a demo.");
  assert.equal(validCrmNotes(""), "");
  assert.equal(validCrmNotes("a".repeat(1000)), "a".repeat(1000));
  for (const value of [null, {}, 123, "a".repeat(1001), "note\u0000", "note\tvalue", "note\u007f"]) assert.equal(validCrmNotes(value), null);
});

test("CRM record IDs accept existing opaque IDs without accepting paths or query syntax", () => {
  assert.equal(validCrmRecordId("b5608010-73be-420b-a5cb-907722d92aa6"), true);
  assert.equal(validCrmRecordId("qa_crm_1"), true);
  for (const value of [null, {}, "", "a".repeat(65), "a/b", "a?b", "a' OR 1=1", "a\n"]) assert.equal(validCrmRecordId(value), false);
});
