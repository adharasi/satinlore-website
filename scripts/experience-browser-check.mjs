/** Isolated real-browser checks: synthetic API, neutral fields, no vendor/account data. */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {once} from "node:events";
import {mkdtemp, readFile, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";
import {chromium} from "playwright";
import {build} from "vite";
import react from "@vitejs/plugin-react";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), "satinlore-experience-browser-"));
const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening");
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let child, browser;
const isolatedServerGroup = process.platform !== "win32";
let currentPhase = "initialising";
const phase = name => { currentPhase = name; console.log(`Experience browser phase: ${name}.`); };
async function bounded(promise, timeoutMs) {
  let timer;
  try { return await Promise.race([Promise.resolve(promise).then(() => true, () => false), new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
async function stopOwnedServer() {
  const owned = child; child = undefined;
  if (!owned) return;
  const closed = new Promise(resolve => { owned.once("close", resolve); owned.once("error", resolve); });
  const signal = name => {
    try {
      // A detached POSIX child starts its own group. Only this test's Wrangler
      // and descendants are signalled, never the runner or an unrelated server.
      if (isolatedServerGroup && owned.pid) process.kill(-owned.pid, name);
      else owned.kill(name);
    } catch (error) { if (error.code !== "ESRCH") console.warn("The isolated test server could not receive a cleanup signal."); }
  };
  signal("SIGTERM");
  if (!await bounded(closed, 3000)) { signal("SIGKILL"); await bounded(closed, 2000); }
  // Descendants must not keep this Node process alive through inherited pipes.
  owned.stdout?.destroy(); owned.stderr?.destroy(); owned.unref();
}
async function closeOwnedBrowser() {
  const owned = browser; browser = undefined;
  if (owned) await bounded(owned.close(), 5000);
}
const watchdog = setTimeout(() => {
  console.error(`Experience browser check exceeded its three-minute deadline during ${currentPhase}.`);
  process.exitCode = 1;
  const forcedExit = setTimeout(() => process.exit(1), 6000); forcedExit.unref();
  void Promise.allSettled([closeOwnedBrowser(), stopOwnedServer()]).finally(() => process.exit(1));
}, 180000);
watchdog.unref();
let serverLog = "";
const errors = [];
const requests = [];
const sessions = new Map();
const sid = "a83531b0-483e-4f14-bf5f-170db3542f37";
const token = "a".repeat(64); // Synthetic only, accepted by the isolated API fixture.
const privateCanary = "PRIVATE_FORM_CANARY_20261102";
const publicMarker = "A neutral public page change for replay verification.";

async function eventually(predicate, message, attempts = 100) {
  for (let i = 0; i < attempts; i++) { if (await predicate()) return; await delay(100); }
  assert.fail(message);
}
async function api(route) {
  const body = route.request().postDataJSON(); requests.push(body);
  if (body.action === "start") {
    sessions.set(sid, {numeric: [], visual: []});
    return route.fulfill({json: {ok: true, sid, token, format: "rrweb-v1", maxDurationMs: 600000,
      maxVisualBytes: 3145728, maxVisualEvents: 5000, maxVisualBatchBytes: 262144}});
  }
  if (body.action === "withdraw") { sessions.delete(body.sid); return route.fulfill({json: {ok: true, deleted: true}}); }
  const session = sessions.get(body.sid);
  assert.ok(session, "A batch needs an admitted synthetic session.");
  if (body.action === "append") session.numeric.push(...body.events);
  else if (body.action === "visual") {
    assert.equal(route.request().headers()["x-satinlore-replay"], "rrweb-v1");
    session.visual.push(...body.events);
  } else assert.fail("Unknown optional recording operation.");
  return route.fulfill({json: {ok: true, accepted: true, seq: body.seq}});
}
async function privacyChoice(page, name) {
  await page.getByRole("button", {name, exact: true}).click();
}
async function cookieSettings(page) {
  const button = page.getByRole("button", {name: /Cookie choices|Manage cookies|Privacy choices/i});
  await button.first().click();
}
async function listFiles(directory, prefix = "") {
  const result = [];
  for (const item of await readdir(directory, {withFileTypes: true})) {
    const name = path.posix.join(prefix, item.name);
    if (item.isDirectory()) result.push(...await listFiles(path.join(directory, item.name), name));
    else result.push(name);
  }
  return result;
}
const mime = name => name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".svg") ? "image/svg+xml" : "text/html";

try {
  phase("starting isolated website");
  child = spawn(process.execPath, [path.join(ROOT, "node_modules/wrangler/bin/wrangler.js"),
    "dev", "--local", "--config", path.join(ROOT, "dist/server/wrangler.json"),
    "--persist-to", path.join(temporary, "state"), "--ip", "127.0.0.1", "--port", String(port)],
    {cwd: ROOT, detached: isolatedServerGroup, env: {...process.env, WRANGLER_SEND_METRICS: "false"}, stdio: ["ignore", "pipe", "pipe"]});
  let spawnFailed = false; child.once("error", () => { spawnFailed = true; });
  const log = chunk => { serverLog = (serverLog + chunk).slice(-8000); };
  child.stdout.on("data", log); child.stderr.on("data", log);
  await eventually(async () => {
    if (spawnFailed || child.exitCode !== null) throw Error("Isolated website server stopped: " + serverLog);
    try { return (await fetch(origin, {signal: AbortSignal.timeout(500)})).ok; } catch { return false; }
  }, "The isolated website server did not become ready.");
  phase("checking cookie consent and capture");
  browser = await chromium.launch({headless: true});
  console.log(`Experience browser verification: Chromium ${browser.version()}.`);
  const context = await browser.newContext({viewport: {width: 1360, height: 940}});
  await context.route("**/api/experience", api);
  await context.route("**/api/metrics", route => route.fulfill({status: 204}));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("button", {name: "Accept all cookies", exact: true}).waitFor();
  assert.equal(requests.length, 0, "No recording request precedes a cookie choice.");
  await privacyChoice(page, "Reject non-essential cookies");
  await page.locator('details[data-experience-faq="1"] > summary').click();
  await page.mouse.wheel(0, 400);
  await page.locator("#waitlist-name").fill(privateCanary);
  await page.locator("#waitlist-email").fill("synthetic-replay@example.invalid");
  await delay(600);
  assert.equal(requests.length, 0, "Rejection must leave recording off.");
  await cookieSettings(page);
  await privacyChoice(page, "Accept all cookies");
  await eventually(() => requests.some(body => body.action === "start"), "Opt-in did not admit a recording.");
  const admission = requests.find(body => body.action === "start");
  assert.equal(admission.v, 2); assert.equal(admission.format, "rrweb-v1");
  await eventually(() => sessions.get(sid)?.visual.some(event => event.type === 2), "A detailed page snapshot was not retained.");
  await page.locator("#waitlist-name").fill(privateCanary + "_CHANGED");
  await page.evaluate(marker => {
    const node = document.createElement("p"); node.id = "synthetic-public-change"; node.textContent = marker;
    document.querySelector('[data-experience-section="hero"]').append(node);
  }, publicMarker);
  await page.locator('details[data-experience-faq="2"] > summary').click();
  await page.mouse.move(400, 300); await page.mouse.click(450, 350);
  await page.mouse.wheel(0, 350);
  await eventually(() => sessions.get(sid)?.visual.some(event => event.type === 3 && event.data?.source === 0 && JSON.stringify(event).includes(publicMarker)), "A public DOM mutation after the snapshot did not appear in visual recording.");
  const recording = {format: "rrweb-v1", events: structuredClone(sessions.get(sid).visual), incomplete: false};
  for (const event of recording.events) assert.ok(Buffer.byteLength(JSON.stringify(event)) <= 262144, "The captured event exceeds the bounded visual batch.");
  const captured = JSON.stringify(requests);
  assert.ok(!captured.includes(privateCanary), "Typed private form text leaked into a recording payload.");
  assert.ok(!captured.includes("synthetic-replay@example.invalid"), "An email field leaked into a recording payload.");
  const walk = node => { if (!node || typeof node !== "object") return; assert.ok(!["form", "input", "textarea", "select", "script", "iframe"].includes(node.tagName), "Private/active DOM was retained."); for (const child of node.childNodes || []) walk(child); };
  for (const event of recording.events) if (event.type === 2) walk(event.data.node);
  await cookieSettings(page); await privacyChoice(page, "Reject non-essential cookies");
  await eventually(() => requests.some(body => body.action === "withdraw"), "Withdrawal did not remove the current recording.");
  assert.equal(sessions.size, 0);
  const stoppedAt = requests.length;
  await page.mouse.move(200, 200); await page.mouse.wheel(0, -350); await delay(800);
  assert.equal(requests.length, stoppedAt, "Capture continued after withdrawal.");
  await page.setViewportSize({width: 390, height: 844});
  await cookieSettings(page);
  assert.ok(await page.locator("body").evaluate(el => el.scrollWidth <= el.ownerDocument.documentElement.clientWidth + 1), "Cookie choices overflow a phone viewport.");
  await privacyChoice(page, "Reject non-essential cookies");
  await context.close();
  phase("building isolated admin replay");

  // Compile the real admin player into an isolated fixture. It has no production
  // routing, accounts or auth bypass. The actual protected-shell policy is used.
  const output = path.join(temporary, "replay");
  await build({configFile: false, root: path.join(ROOT, "tests/browser"),
    plugins: [react()], resolve: {alias: {"@": ROOT}}, build: {outDir: output, emptyOutDir: true}});
  const files = new Set(await listFiles(output));
  const shellSource = await readFile(path.join(ROOT, "lib/visual-replay-shell.ts"), "utf8");
  // Node22's native TypeScript stripping is enabled by the CI script invocation.
  const {visualReplayShellResponse} = await import("../lib/visual-replay-shell.ts");
  assert.ok(shellSource.includes("script-src 'none'"));
  const replayContext = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const unexpected = [];
  await replayContext.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://satinlore.com") {unexpected.push(url.origin); return route.abort();}
    if (url.pathname === "/fixture-recording.json") return route.fulfill({json: recording});
    if (url.pathname === "/admin/experience/visual-preview") {
      const response = visualReplayShellResponse();
      return route.fulfill({status: 200, headers: Object.fromEntries(response.headers), body: await response.text()});
    }
    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (files.has(name)) return route.fulfill({contentType: mime(name), body: await readFile(path.join(output, name))});
    if (/^\/images\/landing\/(?:analysis|reading|rhythms|controls|beta)\.webp$/.test(url.pathname) || url.pathname === "/favicon.svg") {
      return route.fulfill({contentType: mime(url.pathname), body: await readFile(path.join(ROOT, "public", url.pathname.slice(1)))});
    }
    unexpected.push(url.pathname); return route.abort();
  });
  const replay = await replayContext.newPage(); replay.on("pageerror", error => errors.push(error.message));
  await replay.goto("https://satinlore.com/");
  phase("checking recorded layout and sandbox");
  const outer = replay.frameLocator('iframe[title="Protected visual session replay"]');
  const inner = outer.frameLocator('iframe[title="Recorded website page"]');
  await inner.locator("body").waitFor();
  assert.equal(await replay.locator('iframe[title="Protected visual session replay"]').getAttribute("sandbox"), "allow-same-origin");
  assert.equal(await outer.locator('iframe[title="Recorded website page"]').getAttribute("sandbox"), "allow-same-origin");
  assert.equal(await inner.locator("form,input,textarea,select,script").count(), 0);
  assert.ok(!(await inner.locator("body").innerText()).includes(privateCanary));
  const appearance = await inner.locator("body").evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    headline: parseFloat(getComputedStyle(el.querySelector(".hero h1")).fontSize),
    font: getComputedStyle(el.querySelector(".hero h1")).fontFamily,
  }));
  assert.equal(appearance.background, "rgb(248, 245, 238)", "The recorded page must retain its stylesheet and background.");
  assert.ok(appearance.headline > 40, "The headline lost its recorded styling.");
  assert.match(appearance.font, /Georgia/);
  await eventually(() => inner.locator(".hero img").first().evaluate(image => image.complete), "The fixed public hero asset did not finish loading.");
  assert.ok(await inner.locator(".hero img").first().evaluate(image => image.naturalWidth > 0), "The fixed public hero asset did not load.");
  phase("checking replay controls");
  await replay.getByRole("button", {name: "Play", exact: true}).click();
  await replay.getByRole("button", {name: "Pause", exact: true}).click();
  await replay.getByLabel("Speed", {exact: true}).selectOption("2");
  await replay.getByLabel("Replay position", {exact: true}).press("End");
  await inner.getByText(publicMarker, {exact: true}).waitFor();
  phase("checking inherited replay network policy");
  // No async callback or timer may run in the intentionally script-disabled
  // replay frame. Insert synchronously, then observe its result from Node.
  await inner.locator("body").evaluate(el => {
    const image = el.ownerDocument.createElement("img");
    image.id = "synthetic-replay-network-probe";
    image.src = "https://example.invalid/replay-network-probe.png"; el.append(image);
  });
  await eventually(() => inner.locator("#synthetic-replay-network-probe").evaluate(image => image.complete), "The CSP image probe did not finish.");
  assert.equal(await inner.locator("#synthetic-replay-network-probe").evaluate(image => image.naturalWidth), 0, "The inherited replay CSP must deny a foreign image.");
  assert.deepEqual(unexpected, [], "A replay attempted an unapproved network request.");
  assert.deepEqual(errors, [], "Optional recording or replay produced an unhandled page error.");
  await replayContext.close();
  console.log("Experience browser checks passed: consent/rejection, detailed snapshot and DOM changes, masked form canaries, withdrawal, phone cookie choices, actual sandboxed admin playback and closed replay network. No production data, screen capture or external service used.");
} finally {
  phase("cleaning up owned browser and server");
  await Promise.allSettled([closeOwnedBrowser(), stopOwnedServer()]);
  await bounded(rm(temporary, {recursive: true, force: true}), 3000);
  clearTimeout(watchdog);
  phase("cleanup complete");
  // This unreferenced guard does not delay a clean exit. It makes an unexpected
  // leaked handle a bounded failure instead of consuming the full CI job.
  const exitGuard = setTimeout(() => { console.error("Experience browser cleanup left an open process handle."); process.exit(1); }, 15000);
  exitGuard.unref();
}
