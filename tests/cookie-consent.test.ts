import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const consent = await import(new URL("../lib/cookie-consent.mjs", import.meta.url).href);
const analytics = await import(new URL("../lib/site-analytics.ts", import.meta.url).href);
const {readCookieConsent, cookieCategoryAllowed, cookieConsentCookies, browserPrivacySignalOff, COOKIE_CATEGORIES, COOKIE_CONSENT_VERSION} = consent;

test("only a current explicit consent grants optional categories; old, malformed and ambiguous values stay off", () => {
  for (const cookie of ["", "satinlore_replay=on; satinlore_measurement=on", "satinlore_consent=v1.1.1", "satinlore_consent=v2.true.true", "satinlore_consent=v2.1.1.extra", "satinlore_consent=v2.1.1; satinlore_consent=v2.0.0"]) {
    assert.equal(readCookieConsent(cookie), null);
    assert.equal(cookieCategoryAllowed(cookie, "analytics"), false);
    assert.equal(cookieCategoryAllowed(cookie, "experience"), false);
  }
});
test("analytics and website recordings are independent and explicit choices replace compatibility preferences", () => {
  for (const analytics of [false, true]) for (const experience of [false, true]) {
    const cookie = `other=neutral; satinlore_consent=v2.${Number(analytics)}.${Number(experience)}; satinlore_measurement=off; satinlore_replay=off`;
    assert.deepEqual(readCookieConsent(cookie), {version: COOKIE_CONSENT_VERSION, analytics, experience});
    assert.equal(cookieCategoryAllowed(cookie, "analytics"), analytics);
    assert.equal(cookieCategoryAllowed(cookie, "experience"), experience);
  }
  assert.equal(cookieCategoryAllowed("satinlore_consent=v2.1.1", "advertising" as "analytics"), false);
});
test("preference cookies contain no identity, expire in 180 days and are written behind an authoritative version", () => {
  const cookies = cookieConsentCookies({analytics: false, experience: true});
  assert.equal(cookies.length, 3);
  assert.match(cookies[2], /^satinlore_consent=v2\.0\.1;/);
  assert.ok(cookies.every((cookie: string) => cookie.endsWith("; Secure") && cookie.includes("Max-Age=15552000") && cookie.includes("Path=/; SameSite=Lax")));
  assert.doesNotMatch(cookies.join(" "), /visitor|token|session|email|localStorage/);
  assert.equal(COOKIE_CATEGORIES.filter((category: {optional: boolean}) => category.optional).length, 2);
  assert.deepEqual(COOKIE_CATEGORIES.map((category: {id: string}) => category.id), ["essential", "analytics", "experience"]);
  assert.throws(() => cookieConsentCookies({analytics: "yes", experience: true} as unknown as {analytics: boolean; experience: boolean}));
  assert.equal(browserPrivacySignalOff({doNotTrack: "1"}), true);
  assert.equal(browserPrivacySignalOff({globalPrivacyControl: true}), true);
  assert.equal(browserPrivacySignalOff({doNotTrack: "0"}), false);
});

function client(cookie = "", privacy = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/SiteMetrics.tsx", import.meta.url), "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const docListeners = new Map<string, (event: unknown) => void>(), winListeners = new Map<string, () => void>();
  const document = {cookie, referrer: "https://www.reddit.com/r/neutral?private=REFERRER_CANARY", addEventListener: (name: string, callback: (event: unknown) => void) => docListeners.set(name, callback), removeEventListener: (name: string) => docListeners.delete(name)};
  const window = {location: {pathname: "/", search: "?utm_source=PRIVATE_SOURCE_CANARY&token=PRIVATE_TOKEN_CANARY"}, addEventListener: (name: string, callback: () => void) => winListeners.set(name, callback), removeEventListener: (name: string) => winListeners.delete(name)};
  const requests: Record<string, unknown>[] = [];
  let cleanup: (() => void) | undefined;
  class Element { closest() { return {dataset: {metricCta: "hero"}}; } }
  const exported: {default?: () => unknown; setPageAnalyticsAllowed?: (allowed: boolean) => void} = {};
  new Function("require", "exports", "window", "document", "navigator", "fetch", "Element", compiled)((name: string) => {
    if (name === "react") return {useEffect: (callback: () => () => void) => { cleanup = callback(); }};
    if (name === "@/lib/cookie-consent.mjs") return consent;
    if (name === "@/lib/site-analytics") return analytics;
    if (name === "@/lib/experience-client") return {PRIVACY_EVENT: "satinlore:privacy-choice"};
    throw new Error("Unexpected dependency: " + name);
  }, exported, window, document, {doNotTrack: "", ...privacy}, async (_url: string, options: {body: string}) => { requests.push(JSON.parse(options.body)); return new Response(null, {status: 204}); }, Element);
  exported.default!();
  return {document, requests, change: () => winListeners.get("satinlore:privacy-choice")?.(), sync: () => winListeners.get(consent.COOKIE_CHOICE_SYNC_EVENT)?.(), click: () => docListeners.get("click")?.({target: new Element()}), disable: () => exported.setPageAnalyticsAllowed!(false), allow: () => exported.setPageAnalyticsAllowed!(true), cleanup: () => cleanup?.(), docListeners, winListeners};
}
test("the actual analytics client counts the first accept once and never sends before consent or after rejection", () => {
  const app = client();
  app.click(); app.change(); assert.equal(app.requests.length, 0);
  app.document.cookie = "satinlore_consent=v2.1.1"; app.change(); app.change();
  assert.deepEqual(app.requests, [{event: "consent_page_view", page: "/", source: "other", referrer: "reddit"}]);
  app.document.cookie = "satinlore_consent=v2.0.0"; app.change(); app.click();
  app.document.cookie = "satinlore_consent=v2.1.0"; app.change();
  assert.equal(app.requests.length, 1, "Rejecting and accepting again cannot duplicate this pageview.");
  app.click(); assert.equal(app.requests[1].event, "cta_click");
  assert.doesNotMatch(JSON.stringify(app.requests), /CANARY|reddit\.com|token|private/);
  app.cleanup(); assert.equal(app.docListeners.size, 0); assert.equal(app.winListeners.size, 0);
});
test("an initially consented page is counted at the edge and privacy signals or a failed-save override stop new client events", () => {
  const already = client("satinlore_consent=v2.1.1"); already.change(); assert.equal(already.requests.length, 0);
  already.disable(); already.click(); assert.equal(already.requests.length, 0, "A read-only preference cookie cannot keep client analytics on after Reject.");
  for (const privacy of [{doNotTrack: "1"}, {globalPrivacyControl: true}]) {
    const app = client("", privacy); app.document.cookie = "satinlore_consent=v2.1.1"; app.change(); app.click(); assert.equal(app.requests.length, 0);
  }
  const replayOnly = client("satinlore_consent=v2.0.1"); replayOnly.change(); replayOnly.click(); assert.equal(replayOnly.requests.length, 0);
});
test("a category grant synchronised from another tab can count the current eligible page once without rebroadcasting", () => {
  const app = client("satinlore_consent=v2.0.0"); app.disable(); app.sync(); assert.equal(app.requests.length, 0);
  app.document.cookie = "satinlore_consent=v2.1.0"; app.allow(); app.sync(); app.sync();
  assert.equal(app.requests.length, 1); assert.equal(app.requests[0].event, "consent_page_view");
});
