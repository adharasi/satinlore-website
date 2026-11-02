import assert from "node:assert/strict";
import test from "node:test";
const {VisualReplayRecorder, visualRecordOptions} = await import(new URL("../lib/visual-replay-client.mjs", import.meta.url).href);
const {createVisualEventSanitizer, VISUAL_MAX_BATCH_BYTES} = await import(new URL("../lib/visual-replay-codec.mjs", import.meta.url).href);

const credentials = {sid: "11111111-1111-4111-8111-111111111111", token: "a".repeat(64)};
const text = (id: number, textContent: string) => ({type: 3, id, textContent});
const element = (id: number, tagName: string, attributes = {}, childNodes: unknown[] = []) => ({type: 2, id, tagName, attributes, childNodes});
const snapshot = () => ({type: 2, timestamp: 1, data: {initialOffset: {left: 0, top: 0}, node: {type: 0, id: 1, childNodes: [element(2, "html", {}, [element(3, "head", {}, [element(4, "style", {}, [text(5, ".hero{color:red;background:url(https://example.invalid/private)}")])]), element(6, "body", {}, [element(7, "section", {class: "hero"}, [text(8, "Public homepage copy")]), element(9, "div", {class: "signup-card", "data-experience-mask": "", rr_width: "390px", rr_height: "700px"}, [text(10, "PRIVATE_SUCCESS_CANARY"), element(11, "input", {value: "PRIVATE_INPUT_CANARY"})])])])]}}});

function fixture() {
  let allowed = true, consent = true, visible = true, offset = 0, loads = 0, attaches = 0, detaches = 0, failures = 0;
  let emit: ((event: unknown) => void) | null = null;
  const requests: Record<string, unknown>[] = [];
  let request = async (body: Record<string, unknown>) => ({ok: true, accepted: true, seq: body.seq});
  let loader = async () => ((options: Record<string, unknown>) => {
    attaches++; emit = options.emit as typeof emit;
    emit!({type: 4, timestamp: Date.now(), data: {href: "https://satinlore.com/?private=PRIVATE_LINK_CANARY", width: 1440, height: 900}});
    emit!(snapshot());
    return () => {detaches++;};
  });
  const engine = new VisualReplayRecorder({allowed: () => allowed, consentAllowed: () => consent, visible: () => visible, offset: () => offset,
    loadRecord: async () => {loads++; return loader();},
    request: async (body: Record<string, unknown>) => {requests.push(structuredClone(body)); return request(body);},
    onFailure: () => {failures++;}}, credentials);
  return {engine, requests, emit: (event: unknown) => emit?.(event),
    allow: (value: boolean) => {allowed = value;}, consent: (value: boolean) => {consent = value;},
    visible: (value: boolean) => {visible = value;}, time: (value: number) => {offset = value;},
    loader: (value: typeof loader) => {loader = value;}, request: (value: typeof request) => {request = value;},
    counts: () => ({loads, attaches, detaches, failures})};
}

test("visual capture has no loader or event listeners before consent and a cancelled import cannot attach later", async () => {
  const app = fixture(); app.allow(false); assert.equal(await app.engine.start(), false); assert.equal(app.counts().loads, 0);
  app.allow(true);
  let resolve: ((value: (options: Record<string, unknown>) => () => void) => void) | null = null;
  app.loader(() => new Promise(done => {resolve = done;}));
  const starting = app.engine.start(); app.engine.discard();
  resolve!(() => {throw new Error("A cancelled recorder may not attach.");});
  assert.equal(await starting, false); assert.equal(app.counts().attaches, 0); assert.deepEqual(app.requests, []);
});

test("visual capture uses masked snapshots and omits private form, URL, input and dynamic-boundary content", async () => {
  const app = fixture(); assert.equal(await app.engine.start(), true);
  app.time(100);
  app.emit({type: 3, data: {source: 5, id: 11, text: "PRIVATE_TYPED_CANARY"}});
  app.emit({type: 3, data: {source: 0, texts: [{id: 10, value: "PRIVATE_MUTATION_CANARY"}], attributes: [], removes: [], adds: []}});
  app.emit({type: 3, data: {source: 0, texts: [{id: 8, value: "PRIVATE_NEW_BOUNDARY"}], attributes: [{id: 7, attributes: {"data-experience-mask": ""}}], removes: [], adds: []}});
  await app.engine.flush();
  const raw = JSON.stringify(app.requests);
  assert.doesNotMatch(raw, /PRIVATE_|example\.invalid/);
  assert.match(raw, /Public homepage copy/);
  assert.match(raw, /390px/); assert.match(raw, /700px/);
  assert.match(raw, /satinlore-replay-masked/);
  assert.equal(app.requests[0].action, "visual");
  assert.ok((app.requests[0].events as {type: number}[]).some(event => event.type === 2));
  app.engine.discard();
});

test("a lost visual acknowledgement retries the identical sequence and payload before sending newer events", async () => {
  const app = fixture(); await app.engine.start(); let lost = true;
  app.request(async body => {if (lost) {lost = false; throw new Error("Synthetic lost response");} return {ok: true, accepted: true, seq: body.seq};});
  await app.engine.flush(); app.time(120);
  app.emit({type: 3, data: {source: 3, id: 1, x: 0, y: 300}});
  await app.engine.flush(); assert.deepEqual(app.requests[1], app.requests[0]);
  await app.engine.flush(); assert.equal(app.requests[2].seq, 1);
  assert.equal(app.engine.snapshot().sequence, 2); app.engine.discard();
});

test("privacy overlays detach visual observers and returning captures a fresh masked snapshot", async () => {
  const app = fixture(); await app.engine.start();
  app.visible(false); app.engine.refreshVisibility(); assert.equal(app.counts().detaches, 1);
  app.time(300); app.emit({type: 3, data: {source: 3, id: 1, x: 0, y: 500}});
  app.visible(true); app.engine.refreshVisibility(); assert.equal(app.counts().attaches, 2);
  await app.engine.flush();
  const events = app.requests.flatMap(body => body.events as {type: number; timestamp: number}[]);
  assert.equal(events.filter(event => event.type === 2).length, 2);
  assert.ok(events.every((event, index) => !index || event.timestamp >= events[index - 1].timestamp));
  app.consent(false); app.allow(false); app.engine.discard(); await app.engine.flush();
  assert.equal(app.counts().detaches, 2);
});

test("visual bounds stop oversized snapshots and retain finite, canonical batch geometry", async () => {
  const app = fixture(); await app.engine.start();
  app.emit({type: 3, data: {source: 4, width: 9000, height: 100}});
  app.time(600001); app.emit(snapshot()); assert.equal(app.engine.snapshot().active, false);
  await app.engine.flush();
  assert.ok(app.requests.every(body => new TextEncoder().encode(JSON.stringify(body.events)).length <= VISUAL_MAX_BATCH_BYTES));
  const options = visualRecordOptions(() => {});
  assert.equal(options.maskAllInputs, true); assert.equal(options.recordCanvas, false); assert.equal(options.recordCrossOriginIframes, false);
  assert.deepEqual(options.plugins, []); assert.equal(options.maskInputFn(), ""); app.engine.discard();
});

test("the visual codec stays idempotent when the server and admin sanitize blocked snapshots again", () => {
  const first = createVisualEventSanitizer().sanitize(snapshot());
  const second = createVisualEventSanitizer().sanitize(first);
  assert.deepEqual(second, first);
  const cleaner = createVisualEventSanitizer(); cleaner.sanitize(second);
  assert.equal(cleaner.sanitize({type: 3, timestamp: 100, data: {source: 0, texts: [], attributes: [], removes: [], adds: [{parentId: 9, nextId: null, node: text(90, "PRIVATE_LATE_CANARY")}]}}), null);
});
