import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, readdir } from "node:fs/promises";

const { Miniflare } = createRequire(import.meta.resolve("wrangler/package.json"))("miniflare");
const server = fileURLToPath(new URL("../dist/server/", import.meta.url));
const config = JSON.parse(await readFile(resolve(server, "wrangler.json"), "utf8"));
const files = (await readdir(server, { recursive: true })).filter(name => name.endsWith(".js"));
const modules = await Promise.all([config.main, ...files.filter(name => name !== config.main)]
  .map(async name => ({ type: "ESModule", path: resolve(server, name), contents: await readFile(resolve(server, name), "utf8") })));
const options = {
  modules, modulesRoot: server,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
};
const origin = "https://satinlore.com";
const states = [
  { bindings: { MARKETING_BILLING_ENABLED: "true" }, launch: false, billing: false },
  { bindings: { MARKETING_LAUNCH_ENABLED: "true" }, launch: true, billing: false },
  { bindings: { MARKETING_LAUNCH_ENABLED: "true", MARKETING_BILLING_ENABLED: "true" }, launch: true, billing: true },
];
const worker = new Miniflare({ ...options, bindings: states[0].bindings });
try {
  for (const { bindings, launch, billing } of states) {
    await worker.setOptions({ ...options, bindings });
    const request = await worker.dispatchFetch(origin + "/");
    assert.equal(request.status, 200);
    const html = await request.text();
    assert.ok(/rel="canonical" href="https:\/\/satinlore\.com\/?"/.test(html), "Homepage must canonicalise to the apex domain");
    assert.equal(html.includes('data-experience-layout="landing-after-hours"'), launch);
    assert.equal(html.includes('href="https://app.satinlore.com/signup"'), launch);
    assert.equal(html.includes('href="https://app.satinlore.com/login"'), launch);
    assert.equal(html.includes('href="https://app.satinlore.com/billing"'), billing);
    if (launch) {
      assert.ok(/Read it\..*Feel it\./.test(html));
      assert.match(html, /after-hours\.webp/);
      assert.match(html, /href="\/waitlist#waitlist"/);
      assert.match(html, /href="\/privacy"/);
      assert.match(html, /\$9\.99/);
      assert.doesNotMatch(html, /<meta name="robots" content="noindex/);
    } else {
      assert.match(html, /data-experience-layout="landing-20261102"/);
      assert.match(html, /id="waitlist-email"/);
    }
  }
  const legacy = await worker.dispatchFetch(origin + "/waitlist");
  assert.equal(legacy.status, 200);
  const legacyHtml = await legacy.text();
  assert.match(legacyHtml, /id="waitlist-email"/);
  assert.match(legacyHtml, /<meta name="robots" content="noindex/);
  const denied = await worker.dispatchFetch(origin + "/api/admin/experience");
  assert.equal(denied.status, 403);
  console.log("Built launch homepage passed all three flag states, canonical metadata, and legacy waitlist and admin protections.");
} finally {
  await worker.dispose();
}
