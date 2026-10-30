import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Compile the two real content modules so Node can resolve the extensionless
// application import. There are no mocked validation or rendering functions.
function compile(path: string, require: (specifier: string) => unknown) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported: Record<string, unknown> = {};
  new Function("require", "exports", source)(require, exported);
  return exported;
}

const emailContent = compile("../lib/email-content.ts", specifier => {
  throw new Error(`Unexpected email-content dependency: ${specifier}`);
});
const surveyContent = compile("../lib/survey-email.ts", specifier => {
  if (specifier === "./email-content") return emailContent;
  throw new Error(`Unexpected survey-email dependency: ${specifier}`);
});
type Email = { subject: string; text: string; html: string; headers: Array<{ Name: string; Value: string }> };
const buildSurveyEmail = surveyContent.buildSurveyEmail as (input: { publicOrigin: string; manageToken: string }) => Email;
const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfzV6Ys_OWhqLdm6Qocu2CHKsQNiyaag8b-OoEvne1A8LpK3A/viewform";
const manageToken = "cd".repeat(32);
const input = { publicOrigin: "https://satinlore.com", manageToken };

test("survey email keeps the branded responsive design and live questionnaire destination", () => {
  const email = buildSurveyEmail(input);
  assert.equal(surveyContent.SURVEY_FORM_URL, formUrl);
  assert.ok(email.text.includes(`Take the survey → ${formUrl}`));
  assert.ok(email.html.includes(`href="${formUrl}"`));
  assert.match(email.html, /SatinLore/);
  assert.match(email.html, /Your next chapter/);
  assert.match(email.html, /@media screen and \(max-width:640px\)/);
  assert.match(email.html, /max-width:640px/);
  assert.match(email.html, /#552937/);
  assert.match(email.html, /role="presentation"/);
  assert.match(email.html, /width=device-width,initial-scale=1/);
  assert.doesNotMatch(email.html, /__MANAGE_URL__|\{\{[^}]+\}\}|\[YOUR /i);
  assert.doesNotMatch(email.subject, /[\r\n]/);
});

test("survey rewards remain conditional and capped in both message formats", () => {
  const email = buildSurveyEmail(input);
  for (const message of [email.text, email.html.replace(/<[^>]*>/g, "")]) {
    assert.match(message, /chance to win one of ten US\$50 cash prizes\./i);
    assert.match(message, /if selected, earn up to US\$500 in total for agreed test tasks you finish\./i);
    assert.match(message, /chance to get free early access/i);
    assert.match(message, /Paid testing rewards your time, whatever your feedback\./);
    assert.match(message, /For adults 18\+/);
    assert.match(message, /Draw winners are picked at random\./);
    assert.match(message, /limited and not guaranteed\./);
    assert.match(message, /Story and toy questions are optional\./);
    assert.match(message, /your chance in the cash draw stays the same\./);
    assert.doesNotMatch(message, /Personal questions are optional|earn US\$500|guaranteed cash|positive review/i);
  }
  assert.match(email.subject, /chance to win US\$50/);
});

test("survey email has a visible private opt-out link without tracking or one-click claims", () => {
  const email = buildSurveyEmail(input);
  const manageUrl = `${input.publicOrigin}/manage#${manageToken}`;
  assert.ok(email.text.includes(`Change or stop these emails: ${manageUrl}`));
  assert.ok(email.html.includes(`href="${manageUrl}"`));
  assert.match(email.html, />Change or stop these emails<\/a>/);
  assert.ok(email.text.includes("https://satinlore.com/research-privacy"));
  assert.ok(email.html.includes('href="https://satinlore.com/research-privacy"'));
  const links = [...email.html.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1]));
  assert.ok(links.length >= 4);
  for (const link of links) {
    assert.ok(["satinlore.com", "docs.google.com"].includes(link.hostname));
    assert.equal(link.protocol, "https:");
    assert.equal(link.search, "");
    assert.equal(link.username, "");
    assert.equal(link.password, "");
  }
  assert.doesNotMatch(email.html, /<script\b|<img\b|<iframe\b|utm_|email=|EmailOctopus|HubSpot|Amazon SES|Powered by/i);
  assert.doesNotMatch(email.text + email.html, /one[- ]click unsubscribe/i);
  assert.deepEqual(email.headers, [{ Name: "Auto-Submitted", Value: "auto-generated" }]);
});

test("survey management links use the configured HTTPS origin and reject unsafe input", () => {
  const alternate = buildSurveyEmail({ publicOrigin: "https://launch.satinlore.com/", manageToken });
  assert.ok(alternate.text.includes(`https://launch.satinlore.com/manage#${manageToken}`));
  assert.ok(alternate.html.includes(`href="https://launch.satinlore.com/manage#${manageToken}"`));
  for (const publicOrigin of [
    "http://satinlore.com", "javascript:alert(1)", "https://user:pass@satinlore.com",
    "https://satinlore.com/path", "https://satinlore.com?email=reader@example.test",
    "https://satinlore.com#secret", " https://satinlore.com", "https://satinlore.\ncom",
  ]) assert.throws(() => buildSurveyEmail({ ...input, publicOrigin }), publicOrigin);
  for (const token of ["a".repeat(63), "a".repeat(65), "g".repeat(64), manageToken + "\n", manageToken + '?email=reader@example.test', '<a href="x">']) {
    assert.throws(() => buildSurveyEmail({ ...input, manageToken: token }));
  }
});
