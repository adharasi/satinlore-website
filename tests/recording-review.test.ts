import test from "node:test";
import assert from "node:assert/strict";
import {createVisualEventSanitizer, safeVisualAsset, safeVisualCss, validateVisualEvents} from "../lib/visual-replay-codec.mjs";

const text = (id: number, value: string) => ({type: 3, id, textContent: value});
const element = (id: number, tagName: string, attributes: Record<string, unknown> = {}, childNodes: unknown[] = []) => ({type: 2, id, tagName, attributes, childNodes});
const snapshot = (children: unknown[]) => ({type: 2, timestamp: 0, data: {initialOffset: {left: 0, top: 0}, node: {type: 0, id: 1, childNodes: [element(2, "html", {}, [element(3, "head"), element(4, "body", {}, children)])]}}});
const mutation = (data: Record<string, unknown>, timestamp = 10) => ({type: 3, timestamp, data: {source: 0, texts: [], attributes: [], removes: [], adds: [], ...data}});

test("review: full snapshots and later updates never include blocked form, success, script or editable canaries", () => {
  const cleaner = createVisualEventSanitizer();
  const full = cleaner.sanitize(snapshot([
    element(10, "p", {}, [text(11, "PUBLIC_COPY")]),
    element(20, "form", {}, [element(21, "input", {value: "PRIVATE_INPUT_CANARY"}), text(22, "PRIVATE_FORM_CANARY")]),
    element(30, "div", {class: "signup-card"}, [text(31, "PRIVATE_SUCCESS_CANARY")]),
    element(40, "script", {}, [text(41, "PRIVATE_SCRIPT_CANARY")]),
    element(50, "div", {contenteditable: "true"}, [text(51, "PRIVATE_EDITABLE_CANARY")]),
  ]));
  assert.ok(full);
  assert.match(JSON.stringify(full), /PUBLIC_COPY/);
  assert.doesNotMatch(JSON.stringify(full), /PRIVATE_/);
  assert.equal(cleaner.sanitize(mutation({texts: [{id: 22, value: "LATE_FORM_CANARY"}, {id: 31, value: "LATE_SUCCESS_CANARY"}, {id: 51, value: "LATE_EDITABLE_CANARY"}]})), null);
  assert.equal(cleaner.sanitize({type: 3, timestamp: 12, data: {source: 2, type: 2, id: 21, x: 25, y: 25}}), null);
});

test("review: adding a privacy boundary later prevents subsequent descendant text and pointer capture", () => {
  for (const attributes of [{"data-experience-mask": ""}, {class: "signup-card"}, {contenteditable: "true"}]) {
    const cleaner = createVisualEventSanitizer();
    assert.ok(cleaner.sanitize(snapshot([element(10, "div", {}, [element(12, "span", {}, [text(11, "PUBLIC_COPY")])])])));
    cleaner.sanitize(mutation({attributes: [{id: 10, attributes}]}));
    const update = cleaner.sanitize(mutation({texts: [{id: 11, value: "DYNAMIC_PRIVATE_CANARY"}]}, 20));
    assert.equal(update, null, "A new privacy boundary must include already-serialized descendants.");
    assert.equal(cleaner.sanitize({type: 3, timestamp: 21, data: {source: 2, type: 2, id: 12, x: 2, y: 3}}), null);
    const sameTurn = createVisualEventSanitizer();
    sameTurn.sanitize(snapshot([element(10, "div", {}, [element(12, "span", {}, [text(11, "PUBLIC_COPY")])])]));
    const mixed = sameTurn.sanitize(mutation({attributes: [{id: 10, attributes}], texts: [{id: 11, value: "SAME_BATCH_PRIVATE_CANARY"}]}));
    assert.doesNotMatch(JSON.stringify(mixed), /SAME_BATCH_PRIVATE_CANARY/, "Privacy boundaries take priority over text in the same observer batch.");
  }
});

test("review: moving a formerly public subtree into a private area blocks same-batch text", () => {
  const cleaner = createVisualEventSanitizer();
  cleaner.sanitize(snapshot([
    element(10, "div", {}, [element(12, "span", {}, [text(11, "PUBLIC_COPY")])]),
    element(20, "div", {"data-experience-mask": ""}),
  ]));
  const moved = cleaner.sanitize(mutation({
    texts: [{id: 11, value: "MOVED_PRIVATE_CANARY"}],
    removes: [{id: 12, parentId: 10}],
    adds: [{parentId: 20, nextId: null, node: element(12, "span", {}, [text(11, "MOVED_PRIVATE_CANARY")])}],
  }));
  assert.doesNotMatch(JSON.stringify(moved), /MOVED_PRIVATE_CANARY/);
  assert.equal(cleaner.sanitize(mutation({texts: [{id: 11, value: "LATER_MOVED_PRIVATE_CANARY"}]}, 20)), null);
});

test("review: resource URLs are canonical public assets and navigation, SVG links and head metadata cannot carry private data", () => {
  assert.equal(safeVisualAsset("https://satinlore.com/images/landing/reading.webp?token=PRIVATE#fragment"), "/images/landing/reading.webp");
  for (const url of ["https://evil.invalid/images/landing/reading.webp", "https://x@satinlore.com/images/landing/reading.webp", "data:image/svg+xml,<svg/>", "javascript:alert(1)", "/api/admin/experience?id=PRIVATE", "//evil.invalid/x"]) assert.equal(safeVisualAsset(url), null);
  const cleaner = createVisualEventSanitizer();
  const full = cleaner.sanitize(snapshot([
    element(10, "a", {href: "/manage?token=PRIVATE", onclick: "PRIVATE_HANDLER", ping: "https://evil.invalid/x"}, [text(11, "Public link")]),
    element(12, "img", {src: "https://evil.invalid/PRIVATE", srcset: "https://evil.invalid/PRIVATE 1x", onerror: "PRIVATE_HANDLER"}),
    element(13, "use", {"xlink:href": "https://evil.invalid/PRIVATE", href: "javascript:PRIVATE"}),
    element(14, "meta", {content: "PRIVATE_METADATA", "http-equiv": "refresh"}),
  ]));
  assert.ok(full);
  assert.doesNotMatch(JSON.stringify(full), /PRIVATE|evil\.invalid|srcset|onerror|onclick|ping/);
  assert.match(JSON.stringify(full), /"href":"#"/);
});

test("review: custom, input, canvas and media event payloads are rejected rather than retained", () => {
  const cleaner = createVisualEventSanitizer();
  cleaner.sanitize(snapshot([element(10, "div", {}, [text(11, "PUBLIC_COPY")])]));
  for (const event of [
    {type: 5, timestamp: 1, data: {tag: "PRIVATE_CUSTOM", payload: "PRIVATE"}},
    {type: 6, timestamp: 1, data: {plugin: "PRIVATE_PLUGIN", payload: "PRIVATE"}},
    {type: 3, timestamp: 1, data: {source: 5, id: 10, text: "PRIVATE_INPUT"}},
    {type: 3, timestamp: 1, data: {source: 7, id: 10, currentTime: 1}},
    {type: 3, timestamp: 1, data: {source: 9, id: 10, commands: ["PRIVATE_CANVAS"]}},
  ]) assert.equal(cleaner.sanitize(event), null);
  const meta = cleaner.sanitize({type: 4, timestamp: 0, data: {href: "https://satinlore.com/?token=PRIVATE#secret", width: 1200, height: 900, cookie: "PRIVATE"}});
  assert.deepEqual(meta, {type: 4, timestamp: 0, data: {href: "https://satinlore.com/", width: 1200, height: 900}});
  assert.equal(validateVisualEvents([{type: 4, timestamp: 600001, data: {width: 1200, height: 900}}]), null);
  assert.equal(safeVisualCss("a{background:u/**/rl('https://evil.invalid/private')}@import 'https://evil.invalid/private';"), "a{background:none}");
  assert.equal(safeVisualCss("x".repeat(160001)), null);
});
