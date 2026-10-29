import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
const { adminAuthConfiguration, verifyAdminRequest } = await import(new URL("../lib/admin-auth.ts", import.meta.url).href);

const settings = {
  ACCESS_TEAM_DOMAIN: "satinlore-test.cloudflareaccess.com",
  ACCESS_AUD: "test-application-audience",
  ADMIN_EMAIL: "owner@example.test",
};
const issuer = `https://${settings.ACCESS_TEAM_DOMAIN}`;
const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
const jwk = { ...await exportJWK(publicKey), kid: "test-signing-key", alg: "RS256", use: "sig" };
const localKeys = createLocalJWKSet({ keys: [jwk] });
const now = Math.floor(Date.now() / 1_000);

async function signedToken(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    iss: issuer,
    aud: settings.ACCESS_AUD,
    sub: "owner-user-id",
    email: settings.ADMIN_EMAIL,
    type: "app",
    iat: now,
    exp: now + 300,
    ...overrides,
  }).setProtectedHeader({ alg: "RS256", kid: jwk.kid }).sign(privateKey);
}
function requestHeaders(token?: string) {
  return new Headers(token ? { "Cf-Access-Jwt-Assertion": token } : {});
}

test("a signed Access application token admits only the configured founder", async () => {
  const result = await verifyAdminRequest(requestHeaders(await signedToken()), settings, localKeys);
  assert.deepEqual(result, { userId: "owner-user-id", email: settings.ADMIN_EMAIL });
});

test("the allowlist matches email case-insensitively after signature verification", async () => {
  const result = await verifyAdminRequest(requestHeaders(await signedToken({ email: "OWNER@EXAMPLE.TEST" })), settings, localKeys);
  assert.equal(result?.email, settings.ADMIN_EMAIL);
});

test("plain identity headers cannot impersonate the founder", async () => {
  const headers = new Headers({
    "oai-authenticated-user-id": "forged-user",
    "oai-authenticated-user-email": settings.ADMIN_EMAIL,
    "Cf-Access-Authenticated-User-Email": settings.ADMIN_EMAIL,
  });
  assert.equal(await verifyAdminRequest(headers, settings, localKeys), null);
});

test("a signed token for a different allowed user is still denied", async () => {
  assert.equal(await verifyAdminRequest(requestHeaders(await signedToken({ email: "other@example.test" })), settings, localKeys), null);
});

test("wrong issuer, wrong audience, expired and not-yet-valid tokens are denied", async () => {
  for (const overrides of [
    { iss: "https://different-team.cloudflareaccess.com" },
    { aud: "another-application" },
    { exp: now - 30 },
    { nbf: now + 300 },
  ]) {
    assert.equal(await verifyAdminRequest(requestHeaders(await signedToken(overrides)), settings, localKeys), null);
  }
});

test("tokens missing required claims or identifying service/global sessions are denied", async () => {
  for (const overrides of [
    { exp: undefined },
    { iat: undefined },
    { sub: undefined },
    { email: undefined },
    { type: "service" },
    { type: "global" },
    { type: undefined },
  ]) {
    assert.equal(await verifyAdminRequest(requestHeaders(await signedToken(overrides)), settings, localKeys), null);
  }
});

test("tampered payloads and tokens signed by an unknown key are denied", async () => {
  const token = await signedToken({ email: "other@example.test" });
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ iss: issuer, aud: settings.ACCESS_AUD, sub: "attacker", email: settings.ADMIN_EMAIL, type: "app", iat: now, exp: now + 300 })).toString("base64url");
  assert.equal(await verifyAdminRequest(requestHeaders(parts.join(".")), settings, localKeys), null);
  const attacker = await generateKeyPair("RS256");
  const forged = await new SignJWT({ email: settings.ADMIN_EMAIL, type: "app" }).setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setIssuer(issuer).setAudience(settings.ACCESS_AUD).setSubject("attacker").setIssuedAt().setExpirationTime("5m").sign(attacker.privateKey);
  assert.equal(await verifyAdminRequest(requestHeaders(forged), settings, localKeys), null);
});

test("missing configuration, malformed JWTs and absent JWTs fail closed", async () => {
  const headers = requestHeaders(await signedToken());
  for (const incomplete of [{}, { ...settings, ACCESS_AUD: "" }, { ...settings, ADMIN_EMAIL: "" }, { ...settings, ACCESS_TEAM_DOMAIN: "" }]) {
    assert.equal(await verifyAdminRequest(headers, incomplete, localKeys), null);
  }
  for (const token of [undefined, "not-a-jwt", "a".repeat(16_385)]) {
    assert.equal(await verifyAdminRequest(requestHeaders(token), settings, localKeys), null);
  }
});

test("the configured team cannot redirect signing-key fetches outside Cloudflare Access", () => {
  for (const team of ["https://satinlore.cloudflareaccess.com", "satinlore.cloudflareaccess.com/evil", "satinlore.cloudflareaccess.com.evil.test", "localhost", "169.254.169.254", "satinlore@evil.test", "team..cloudflareaccess.com"]) {
    assert.equal(adminAuthConfiguration({ ...settings, ACCESS_TEAM_DOMAIN: team }), null);
  }
  assert.equal(adminAuthConfiguration(settings)?.issuer, issuer);
});
