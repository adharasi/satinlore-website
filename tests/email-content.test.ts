import assert from "node:assert/strict";
import test from "node:test";

const { buildConfirmationEmail, buildWelcomeEmail, emailPublicOrigin } = await import(new URL("../lib/email-content.ts", import.meta.url).href);
const token = "ab".repeat(32);
const manageToken = "cd".repeat(32);
const input = { publicOrigin: "https://satinlore.com", firstName: "Jane", confirmToken: token, manageToken };

test("confirmation uses separate fragment links and does not claim a confirmed signup", () => {
  const email = buildConfirmationEmail(input);
  assert.match(email.text, new RegExp(`/confirm#${token}`));
  assert.match(email.text, new RegExp(`/manage#${manageToken}`));
  assert.match(email.text, /24 hours/);
  assert.match(email.text, /confirm your email/);
  assert.doesNotMatch(email.text, /You're on the list/);
  assert.equal(email.headers[0].Name, "Auto-Submitted");
  assert.equal(email.headers[0].Value, "auto-generated");
  assert.doesNotMatch(email.subject, /[\r\n]/);
});

test("first names cannot inject HTML, attributes or mail headers", () => {
  const name = '<img src=x onerror="alert(1)"> & Jane';
  const email = buildConfirmationEmail({ ...input, firstName: name });
  assert.ok(email.html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Jane"));
  assert.ok(!email.html.includes(name));
  assert.equal(email.subject, buildConfirmationEmail(input).subject);
  assert.throws(() => buildConfirmationEmail({ ...input, firstName: "Jane\r\nBcc:other@example.com" }));
});

test("email links reject unsafe origins and malformed credentials", () => {
  for (const origin of ["http://satinlore.com", "javascript:alert(1)", "https://user:pass@satinlore.com", "https://satinlore.com/path", "https://satinlore.com?email=a@b.com", "https://satinlore.com#secret", " https://satinlore.com", "https://satinlore.\ncom"]) {
    assert.throws(() => emailPublicOrigin(origin), origin);
  }
  assert.equal(emailPublicOrigin("https://satinlore.com/"), "https://satinlore.com");
  for (const badToken of ["a".repeat(63), "a".repeat(65), "g".repeat(64), token + "\n", token + '?email=a@b.com']) {
    assert.throws(() => buildConfirmationEmail({ ...input, confirmToken: badToken }));
    assert.throws(() => buildWelcomeEmail({ ...input, manageToken: badToken }));
  }
});

test("welcome gives a working opt-out path without prices or launch promises", () => {
  const email = buildWelcomeEmail(input);
  assert.match(email.text, /You're on the list/);
  assert.match(email.text, /Change or stop these emails:/);
  assert.ok(email.html.includes(`href="https://satinlore.com/manage#${manageToken}"`));
  assert.ok(email.html.includes('href="https://satinlore.com/contact"'));
  assert.doesNotMatch(email.text, /£|\$|guarantee|next week|free plan|already live/i);
  assert.doesNotMatch(email.html, /<script|<img|utm_|email=/i);
});

test('founder alert identifies an unverified form submission without private link tokens', async () => {
  const { buildFounderAlertEmail }=await import(new URL('../lib/email-content.ts', import.meta.url).href);
  const result=buildFounderAlertEmail({publicOrigin:'https://satinlore.com',firstName:'Jane <b>',email:'reader@example.com',createdAt:1793200000000});
  assert.match(result.text,/reader@example.com/);
  assert.match(result.text,/Check the CRM/);
  assert.match(result.html,/Jane &lt;b&gt;/);
  assert.doesNotMatch(result.text,/\/confirm#|\/manage#|Lush|Ferri|paid place/);
  assert.match(result.text,/https:\/\/satinlore.com\/admin/);
  assert.throws(()=>buildFounderAlertEmail({publicOrigin:'https://satinlore.com',firstName:'Jane',email:'a@example.com\r\nBcc:b@example.com',createdAt:1793200000000}));
});
