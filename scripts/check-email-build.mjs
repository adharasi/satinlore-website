import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

// Use Wrangler's pinned local runtime; no real keys, D1 bindings or AWS calls.
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare } = require("miniflare");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, "dist/server");
const config = JSON.parse(readFileSync(join(server, "wrangler.json"), "utf8"));
const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = { ...await exportJWK(publicKey), kid: "synthetic-build-test", alg: "RS256", use: "sig" };
const token = await new SignJWT({ email: "founder@example.com", type: "app" })
  .setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setIssuer("https://build-test.cloudflareaccess.com")
  .setAudience("build-test").setSubject("synthetic-founder").setIssuedAt().setExpirationTime("5m").sign(privateKey);
const entry = `
import worker from ${JSON.stringify("../dist/server/" + config.main.replaceAll("\\", "/"))};
export default { async fetch(request, env, ctx) {
 const savedFetch = globalThis.fetch;
 globalThis.fetch = async input => {
  const url = new URL(typeof input === "string" ? input : input.url ?? input.href);
  if (url.href === "https://build-test.cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [${JSON.stringify(jwk)}] });
  if (url.hostname === "email.eu-north-1.amazonaws.com") {
   if (url.pathname === "/v2/email/account") return Response.json({ SendingEnabled: true, ProductionAccessEnabled: true });
   if (url.pathname.startsWith("/v2/email/identities/")) return Response.json({ VerifiedForSendingStatus: true });
  }
  throw new Error("Unexpected outbound request in isolated build test");
 };
 try { return await worker.fetch(request, env, ctx); }
 finally { globalThis.fetch = savedFetch; }
}};`;
const files = readdirSync(server, { recursive: true }).filter(name => name.endsWith(".js"));
const mf = new Miniflare({
  modulesRoot: root,
  modules: [
    { type: "ESModule", path: join(root, ".wrangler/email-build-test.js"), contents: entry },
    ...files.map(name => ({ type: "ESModule", path: join(server, name), contents: readFileSync(join(server, name), "utf8") })),
  ],
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  bindings: {
    ACCESS_TEAM_DOMAIN: "build-test.cloudflareaccess.com", ACCESS_AUD: "build-test", ADMIN_EMAIL: "founder@example.com",
    EMAIL_ENABLED: "true", WELCOME_EMAIL_ENABLED: "false", SES_REGION: "eu-north-1",
    SES_ACCESS_KEY_ID: "SYNTHETIC_ACCESS_KEY", SES_SECRET_ACCESS_KEY: "synthetic-secret-not-a-real-credential",
    SES_FROM_EMAIL: "Satinlore <team@satinlore.com>", PUBLIC_SITE_ORIGIN: "https://build-test.example.com",
  },
});
try {
  const url = "https://build-test.example.com/api/admin/email-status";
  const denied = await mf.dispatchFetch(url, { headers: { "Cf-Access-Authenticated-User-Email": "founder@example.com" } });
  assert.equal(denied.status, 403, "The built owner endpoint must reject unverified identity headers");
  const response = await mf.dispatchFetch(url, { headers: { "Cf-Access-Jwt-Assertion": token } });
  const result = await response.json();
  assert.equal(response.status, 200, `Built SES check failed: ${JSON.stringify(result)}`);
  assert.deepEqual(result, { configured: true, sendingEnabled: true, productionAccessEnabled: true, identityVerified: true });
  console.log("Built SES readiness check passed in the Workers runtime with synthetic credentials and mocked AWS responses.");
} finally { await mf.dispose(); }
