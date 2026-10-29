import assert from "node:assert/strict";
import test from "node:test";
const { emailCheckFailure } = await import(new URL("../lib/email-check-error.ts", import.meta.url).href);

test("email diagnostics explain permissions and credentials without exposing AWS error details", () => {
  for (const [name, code] of [["AccessDeniedException", "ses_access_denied"], ["SignatureDoesNotMatch", "ses_credentials_rejected"], ["TimeoutError", "ses_check_retry"]]) {
    const error = Object.assign(new Error("synthetic-private-credential and account details"), { name });
    const result = emailCheckFailure(error);
    assert.equal(result.code, code);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-private-credential|account details/);
  }
});

test("unknown exceptions and arbitrary exception names never reach the owner response", () => {
  for (const error of [null, "synthetic-private-credential", { name: "AccessDeniedException", message: "synthetic-private-credential" }, Object.assign(new Error("synthetic-private-credential"), { name: "synthetic-private-credential" }), Object.assign(new Error("secret"), { name: "__proto__" })]) {
    const result = emailCheckFailure(error);
    assert.equal(result.code, "ses_check_failed");
    assert.doesNotMatch(JSON.stringify(result), /synthetic-private-credential|__proto__/);
  }
});
