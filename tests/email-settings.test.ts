import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/email-settings.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { emailPublicOrigin } = await import(new URL("../lib/email-content.ts", import.meta.url).href);
function load(settings: Record<string, string>) {
  const exports: Record<string, any> = {};
  new Function("require", "exports", code)((name: string) => {
    if (name.endsWith("waitlist-server")) return { runtime: () => settings };
    if (name.endsWith("email-content")) return { emailPublicOrigin };
    throw new Error("Unexpected module");
  }, exports);
  return exports.emailSettings;
}

test("email links use only the configured public origin, not an incoming hostname", () => {
  const settings = load({ PUBLIC_SITE_ORIGIN: "https://launch.satinlore.com" });
  assert.equal(settings("https://attacker.example").publicOrigin, "https://launch.satinlore.com");
  assert.equal(load({})("https://attacker.example").publicOrigin, "https://satinlore.com");
  assert.throws(() => load({ PUBLIC_SITE_ORIGIN: "javascript:alert(1)" })());
});

test("the migrated sender defaults to Stockholm with both email flows off", () => {
  const settings = load({})();
  assert.equal(settings.region, "eu-north-1");
  assert.equal(settings.enabled, false);
  assert.equal(settings.welcomeEnabled, false);
});
