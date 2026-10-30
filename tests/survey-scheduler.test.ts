import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test("the Worker cron calls the durable queue with production bindings and keeps legacy welcome off", async () => {
  const calls: unknown[][] = [];
  const pending: Promise<unknown>[] = [];
  const exported: { default?: { scheduled: (controller: unknown, env: unknown, ctx: unknown) => Promise<void> } } = {};
  new Function("require", "exports", source)((specifier: string) => {
    if (specifier === "vinext/server/fetch-handler") return { default: { fetch: async () => new Response("ok") } };
    if (specifier === "../lib/data-retention") return { purgeExpiredRecords: async () => undefined };
    if (specifier === "../lib/survey-email-jobs") return {
      processSurveyEmailJobs: async (...args: unknown[]) => { calls.push(args); return { sent: 0 }; },
    };
    throw new Error(`Unexpected scheduler dependency: ${specifier}`);
  }, exported);
  const env = {
    DB: { fixture: true }, SURVEY_EMAIL_ENABLED: "true", EMAIL_ENABLED: "true",
    SES_REGION: "eu-north-1", SES_ACCESS_KEY_ID: "synthetic-id", SES_SECRET_ACCESS_KEY: "synthetic-key",
    SES_SESSION_TOKEN: "synthetic-session", SES_FROM_EMAIL: "team@satinlore.com",
    PUBLIC_SITE_ORIGIN: "https://satinlore.com", SES_CONFIGURATION_SET: "synthetic-set", ABUSE_SALT: "synthetic-link-secret",
    WELCOME_EMAIL_ENABLED: "true", // The separate survey flow must never enable this old flow.
  };
  assert.equal(typeof exported.default?.scheduled, "function");
  const context = { waitUntil(promise: Promise<unknown>) { pending.push(promise); } };
  await exported.default!.scheduled({}, env, context);
  await Promise.all(pending);
  assert.equal(pending.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], env.DB);
  assert.deepEqual(calls[0][1], {
    enabled: true, welcomeEnabled: false,
    region: env.SES_REGION, accessKeyId: env.SES_ACCESS_KEY_ID, secretAccessKey: env.SES_SECRET_ACCESS_KEY,
    sessionToken: env.SES_SESSION_TOKEN, fromEmail: env.SES_FROM_EMAIL,
    publicOrigin: env.PUBLIC_SITE_ORIGIN, configurationSet: env.SES_CONFIGURATION_SET,
  });
  assert.deepEqual(calls[0][2], { enabled: true, tokenSecret: env.ABUSE_SALT });
  await exported.default!.scheduled({}, { ...env, SURVEY_EMAIL_ENABLED: "false", EMAIL_ENABLED: "false" }, context);
  await Promise.all(pending);
  assert.equal((calls[1][1] as { enabled: boolean }).enabled, false);
  assert.equal((calls[1][2] as { enabled: boolean }).enabled, false);
});

test("deployment schedules a minute tick with survey invites enabled and legacy welcome disabled", () => {
  const configuration = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", configuration);
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.config.triggers.crons, ["* * * * *"]);
  assert.equal(parsed.config.vars.SURVEY_EMAIL_ENABLED, "true");
  assert.equal(parsed.config.vars.WELCOME_EMAIL_ENABLED, "false");
  assert.equal(parsed.config.vars.SES_REGION, "eu-north-1");
});
