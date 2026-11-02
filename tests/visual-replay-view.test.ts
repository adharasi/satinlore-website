import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const { prepareVisualReplay, visualReplayPosition, visualReplayTimeline, VISUAL_REPLAYER_OPTIONS } = await import(new URL("../lib/visual-replay-view.ts", import.meta.url).href);
const { visualReplayShellResponse, VISUAL_REPLAY_POLICY, VISUAL_REPLAY_ASSETS } = await import(new URL("../lib/visual-replay-shell.ts", import.meta.url).href);

const element = (id: number, tagName: string, childNodes: unknown[] = [], attributes: Record<string, unknown> = {}) => ({ type: 2, id, tagName, attributes, childNodes });
function fixture() {
  return { format: "rrweb-v1", events: [
    { type: 4, timestamp: 0, data: { href: "https://satinlore.com/?private=URL_CANARY", width: 390, height: 844 } },
    { type: 2, timestamp: 10, data: { initialOffset: { left: 0, top: 0 }, node: { type: 0, id: 1, childNodes: [
      element(2, "html", [element(3, "head", [element(4, "style", [{ type: 3, id: 5, textContent: "h1{color:#552937}" }])]),
        element(6, "body", [element(7, "h1", [{ type: 3, id: 8, textContent: "A neutral heading" }]),
          element(9, "a", [{ type: 3, id: 10, textContent: "Join" }], { href: "https://evil.invalid/?private=URL_CANARY", onclick: "SCRIPT_CANARY" }),
          element(11, "img", [], { src: "https://satinlore.com/images/landing/reading.webp?private=URL_CANARY" }),
          element(12, "form", [element(13, "input", [], { value: "FORM_CANARY" }), element(14, "p", [{ type: 3, id: 15, textContent: "FORM_CANARY" }])]),
          element(16, "iframe", [], { src: "https://evil.invalid/" }), element(17, "script", [{ type: 3, id: 18, textContent: "SCRIPT_CANARY" }]),
        ]),
      ]),
    ] } } },
    { type: 3, timestamp: 1000, data: { source: 0, texts: [
      { id: 15, value: "LATE_FORM_CANARY" }, { id: 999, value: "UNKNOWN_CANARY" },
      { id: 5, value: "@import 'https://evil.invalid/font.css';h1{background:url(https://evil.invalid/tracker);color:blue}" },
    ], attributes: [], removes: [], adds: [] } },
    { type: 3, timestamp: 2000, data: { source: 3, id: 1, x: 0, y: 120 } },
  ] };
}

test("visual playback filters a complete stream statefully before any rebuild", () => {
  const recording = fixture(), prepared = prepareVisualReplay(recording);
  const payload = JSON.stringify(prepared.events);
  assert.doesNotMatch(payload, /FORM_CANARY|LATE_FORM_CANARY|UNKNOWN_CANARY|SCRIPT_CANARY|URL_CANARY|evil\.invalid/);
  assert.doesNotMatch(payload, /"tagName":"(?:form|input|iframe|script)"/);
  assert.match(payload, /A neutral heading/);
  assert.match(payload, /color:blue/);
  assert.equal(prepared.duration, 2000);
  assert.equal(recording.events[0].data.href, "https://satinlore.com/?private=URL_CANARY", "The stored/source object is not mutated.");
});

test("visual timelines require an ordered bounded full snapshot and reject unsupported payloads", () => {
  assert.throws(() => visualReplayTimeline({ format: "unknown", events: [] }), /unsupported/);
  assert.throws(() => visualReplayTimeline({ format: "rrweb-v1", events: [] }), /snapshot/);
  assert.throws(() => visualReplayTimeline({ format: "rrweb-v1", events: [{ type: 2, timestamp: 0 }] }), /snapshot/);
  const base = fixture();
  for (const timestamp of [-1, Infinity, NaN, 600001]) {
    const bad = structuredClone(base); bad.events.at(-1)!.timestamp = timestamp;
    assert.throws(() => visualReplayTimeline(bad), /timeline/);
  }
  const outOfOrder = fixture(); outOfOrder.events.at(-1)!.timestamp = 5;
  assert.throws(() => visualReplayTimeline(outOfOrder), /timeline/);
  assert.throws(() => visualReplayTimeline({ format: "rrweb-v1", events: Array(5001).fill({}) }), /unsupported/);
  assert.deepEqual(visualReplayTimeline(base), { start: 0, end: 2000, duration: 2000 });
  assert.equal(visualReplayPosition(-40, 2000), 0);
  assert.equal(visualReplayPosition(9999, 2000), 2000);
  assert.equal(visualReplayPosition(Infinity, 2000), 0);
});

test("the visual shell closes network and active content while leaving only fixed public images", async () => {
  const response = visualReplayShellResponse(), html = await response.text();
  assert.equal(response.headers.get("Content-Security-Policy"), VISUAL_REPLAY_POLICY);
  assert.match(VISUAL_REPLAY_POLICY, /(?:^|;)\s*script-src 'none'/);
  assert.match(VISUAL_REPLAY_POLICY, /sandbox allow-same-origin(?:;|$)/);
  assert.doesNotMatch(VISUAL_REPLAY_POLICY, /allow-scripts|unsafe-eval|data:|blob:|\*|connect-src 'self'/);
  for (const resource of ["connect", "font", "media", "object"]) assert.match(VISUAL_REPLAY_POLICY, new RegExp(resource + "-src 'none'"));
  assert.match(VISUAL_REPLAY_POLICY, /form-action 'none'/);
  assert.ok(VISUAL_REPLAY_ASSETS.every((url: string) => url.startsWith("https://satinlore.com/") && !url.includes("?")));
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.match(html, /data-visual-replay-shell="1"/);
  assert.doesNotMatch(html, /<script|url\(|@import|<form|<iframe/i);
  assert.equal(VISUAL_REPLAYER_OPTIONS.UNSAFE_replayCanvas, false);
  assert.equal(VISUAL_REPLAYER_OPTIONS.triggerFocus, false);
  assert.deepEqual(VISUAL_REPLAYER_OPTIONS.plugins, []);
});

test("the new replay shell authorizes before producing any renderer document", async () => {
  const source = ts.transpileModule(readFileSync(new URL("../app/admin/experience/visual-preview/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const allowed of [false, true]) {
    let checked = 0, rendered = 0;
    const exports: { GET?: () => Promise<Response> } = {};
    new Function("require", "exports", source)((name: string) => {
      if (name === "@/lib/waitlist-server") return { isOwner: async () => { checked++; return allowed; }, response: (value: unknown, status: number) => Response.json(value, { status }) };
      if (name === "@/lib/visual-replay-shell") return { visualReplayShellResponse: () => { assert.equal(checked, 1); rendered++; return visualReplayShellResponse(); } };
      throw new Error("Unexpected renderer dependency");
    }, exports);
    const response = await exports.GET!();
    assert.equal(checked, 1); assert.equal(rendered, allowed ? 1 : 0);
    assert.equal(response.status, allowed ? 200 : 403);
  }
});
