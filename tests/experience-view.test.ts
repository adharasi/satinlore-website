import assert from "node:assert/strict";
import test from "node:test";
import type { ExperienceViewEvent } from "../lib/experience-view";
const { fitViewport, replayState, replayAtForm } = await import(new URL("../lib/experience-view.ts", import.meta.url).href);

const initial = { w: 1200, h: 800, dh: 6400 };

test("replay seek reconstructs only events up to the chosen time and retains normalized document geometry", () => {
  const events: ExperienceViewEvent[] = [
    { k: "pointer", t: 100, x: 200, y: 50 },
    { k: "scroll", t: 500, y: 450 },
    { k: "click", t: 700, x: 500, y: 600 },
    { k: "viewport", t: 800, w: 390, h: 844, dh: 13_000 },
    { k: "view", t: 900, section: "hero", ms: 5000 },
  ];
  assert.deepEqual(replayState(events, 0, initial), { viewport: initial, scrollY: 0, pointer: null, clicks: [], visible: true });
  assert.deepEqual(replayState(events, 600, initial), { viewport: initial, scrollY: 450, pointer: { x: 200, y: 50 }, clicks: [], visible: true });
  const clicked = replayState(events, 900, initial);
  assert.deepEqual(clicked.viewport, { w: 390, h: 844, dh: 13_000 });
  assert.deepEqual(clicked.pointer, { x: 500, y: 600 });
  assert.deepEqual(clicked.clicks, [{ x: 500, y: 600, t: 700, ageMs: 200 }]);
  assert.equal(clicked.scrollY, 450);
  assert.equal(replayState(events, 1300, initial).clicks.length, 1);
  assert.equal(replayState(events, 1301, initial).clicks.length, 0);
  assert.deepEqual(replayState(events, 1_000_000, initial).pointer, { x: 500, y: 600 });
  assert.equal(replayState(events, -1, initial).pointer, null);
});

test("visibility breaks clear old interaction markers and do not restore them automatically", () => {
  const events: ExperienceViewEvent[] = [
    { k: "pointer", t: 10, x: 10, y: 20 },
    { k: "click", t: 20, x: 20, y: 30 },
    { k: "visibility", t: 30, visible: false },
    { k: "pointer", t: 40, x: 900, y: 900 },
    { k: "click", t: 50, x: 900, y: 900 },
    { k: "visibility", t: 60, visible: true },
    { k: "pointer", t: 70, x: 40, y: 50 },
  ];
  assert.deepEqual(replayState(events, 55, initial), { viewport: initial, scrollY: 0, pointer: null, clicks: [], visible: false });
  assert.deepEqual(replayState(events, 65, initial), { viewport: initial, scrollY: 0, pointer: null, clicks: [], visible: true });
  assert.deepEqual(replayState(events, 75, initial).pointer, { x: 40, y: 50 });
});

test("equal-time event ordering is deterministic and a seek does not mutate the source", () => {
  const events = [
    { k: "pointer", t: 200, x: 500, y: 500 },
    { k: "pointer", t: 100, x: 100, y: 100 },
    { k: "visibility", t: 200, visible: false },
    { k: "visibility", t: 200, visible: true },
  ];
  const before = JSON.stringify(events);
  assert.deepEqual(replayState(events, 150, initial).pointer, { x: 100, y: 100 });
  assert.equal(replayState(events, 200, initial).pointer, null);
  assert.equal(replayState(events, 200, initial).visible, true);
  assert.equal(JSON.stringify(events), before);
});

test("malformed records cannot move a replay or inject unbounded geometry", () => {
  const invalid = [null, [], "private text", { k: "pointer", t: 5, x: Infinity, y: 0 },
    { k: "pointer", t: 5, x: 0, y: -1 }, { k: "click", t: 6, x: 0, y: 1001 },
    { k: "scroll", t: 7, y: NaN }, { k: "pointer", t: -1, x: 100, y: 100 },
    { k: "pointer", t: 600_001, x: 100, y: 100 }, { k: "pointer", t: 7.5, x: 100, y: 100 },
    { k: "viewport", t: 9, w: 0, h: 1, dh: 1 }, { k: "visibility", t: 10, visible: "false" },
    { k: "anything", t: 11, x: 100, y: 100 }];
  assert.deepEqual(replayState(invalid, 100, initial), { viewport: initial, scrollY: 0, pointer: null, clicks: [], visible: true });
  const fallback = replayState([], NaN, { w: NaN, h: -1, dh: Infinity });
  assert.ok(Object.values(fallback.viewport).every(value => typeof value === "number" && Number.isFinite(value) && value > 0));
  assert.deepEqual(replayState([{ k: "viewport", t: 1, w: 300, h: 800, dh: 500 }], 10, initial).viewport, { w: 300, h: 800, dh: 800 });
});

test("replay work and visible click trails stay bounded", () => {
  const events = Array.from({ length: 4000 }, (_, index) => ({ k: "click", t: index, x: index % 1001, y: index % 1001 }));
  const state = replayState(events, 3000, initial);
  assert.equal(state.clicks.length, 10);
  assert.equal(state.clicks.at(-1)?.t, 2999);
  assert.deepEqual(state.pointer, { x: 2999 % 1001, y: 2999 % 1001 });
});

test("viewport fitting preserves the recorded aspect ratio and never upscales or emits invalid dimensions", () => {
  assert.deepEqual(fitViewport(1200, 800, 600), { scale: .5, width: 600, height: 400, sourceWidth: 1200, sourceHeight: 800 });
  assert.deepEqual(fitViewport(1200, 800, 2400), { scale: 1, width: 1200, height: 800, sourceWidth: 1200, sourceHeight: 800 });
  const capped = fitViewport(390, 844, 1000, 422);
  assert.equal(capped.scale, .5); assert.equal(capped.width, 195); assert.equal(capped.height, 422);
  for (const value of [fitViewport(0, 0, 0), fitViewport(NaN, Infinity, -1, NaN)]) {
    assert.ok(Object.values(value).every(item => typeof item === "number" && Number.isFinite(item) && item > 0));
    assert.equal(value.width / value.height, value.sourceWidth / value.sourceHeight);
  }
});

test("replay form visibility matches the clipped area threshold, including horizontal clipping", () => {
  const view = { w: 100, h: 100 };
  const rect = { top: 96, bottom: 196, left: 0, right: 100, width: 100, height: 100 };
  assert.equal(replayAtForm(rect, view), false, "Four percent is below the five-percent public observer threshold.");
  assert.equal(replayAtForm({ ...rect, top: 95, bottom: 195 }, view), true);
  assert.equal(replayAtForm({ ...rect, top: -95, bottom: 5 }, view), true);
  assert.equal(replayAtForm({ ...rect, top: 90, bottom: 190, left: 50, right: 150 }, view), true,
    "Ten percent height times fifty percent width gives five percent of the target area.");
  assert.equal(replayAtForm({ ...rect, top: 91, bottom: 191, left: 50, right: 150 }, view), false);
  assert.equal(replayAtForm({ ...rect, top: 100, bottom: 200 }, view), false);
  assert.equal(replayAtForm({ ...rect, top: 0, bottom: 100, left: -100, right: 0 }, view), false);
  assert.equal(replayAtForm({ ...rect, top: 0, bottom: 100 }, view), true);
  for (const invalid of [{ ...rect, width: 0 }, { ...rect, height: NaN }, { ...rect, left: Infinity }, { ...rect, bottom: rect.top }]) {
    assert.equal(replayAtForm(invalid, view), false);
  }
  assert.equal(replayAtForm(rect, { w: 0, h: 100 }), false);
  assert.equal(replayAtForm(rect, view, NaN), false);
  assert.equal(replayAtForm(rect, view, -1), false);
  assert.equal(replayAtForm(rect, view, 2), false);
});
