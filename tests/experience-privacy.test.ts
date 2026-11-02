import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import type { ExperienceEnvironment, ExperienceEvent } from "../lib/experience-client";
const { ExperienceRecorder, replayPermitted } = await import(new URL("../lib/experience-client.ts", import.meta.url).href);

const SID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "a".repeat(64);
const admission = () => ({ ok: true, sid: SID, token: TOKEN, maxDurationMs: 600000 });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

type Push = Parameters<ExperienceEnvironment["listen"]>[0];
function lifecycle() {
  let allowed = true, visible = true, time = 0, push: Push | null = null;
  let interval: (() => void) | null = null, attaches = 0, detaches = 0;
  const requests: Record<string, unknown>[] = [];
  let request: (body: Record<string, unknown>) => Promise<unknown> = async body => body.action === "start" ? admission() : body.action === "append" ? { ok: true, accepted: true, seq: body.seq } : { ok: true, withdrawn: true };
  const env: ExperienceEnvironment = {
    allowed: () => allowed, visible: () => visible, now: () => time,
    viewport: () => ({ w: 1440, h: 900, dh: 6000 }),
    request: async body => { requests.push(clone(body)); return request(body); },
    listen: capture => { attaches++; push = capture; return () => { detaches++; push = null; }; },
    interval: callback => { interval = callback; return 1; }, clearInterval: () => { interval = null; },
    views: ms => [{ section: "hero", ms }],
  };
  const recorder = new ExperienceRecorder(env);
  return { recorder, env, requests,
    allowed: (value: boolean) => { allowed = value; }, visible: (value: boolean) => { visible = value; },
    time: (value: number) => { time = value; }, tick: () => interval?.(),
    push: (event: Parameters<Push>[0]) => push?.(event),
    request: (value: typeof request) => { request = value; },
    listeners: () => ({ attaches, detaches, interval: interval !== null, listening: push !== null }),
  };
}

/** Executes the real browser binding with a minimal DOM boundary, not a browser/layout simulation. */
function browserBinding({ cookie = "", path = "/", dnt = "", gpc = false, admissionDelayMs = 0 } = {}) {
  type Callback = (event: Record<string, unknown>) => void;
  const docEvents = new Map<string, Set<Callback>>(), winEvents = new Map<string, Set<Callback>>();
  const intervals = new Map<number, () => void>(); let clock = 0, nextTimer = 0, observerCount = 0;
  const requests: Record<string, unknown>[] = [];
  class Element {
    tagName: string; parentElement: Element | null; attrs: Record<string, string>; dataset: Record<string, string> = {};
    value = "PRIVATE_FORM_CANARY"; textContent = "PRIVATE_FORM_CANARY";
    constructor(tag = "div", attrs: Record<string, string> = {}, parent: Element | null = null) { this.tagName = tag.toUpperCase(); this.attrs = attrs; this.parentElement = parent; }
    getAttribute(name: string) { return this.attrs[name] ?? null; }
    closest(selectors: string) {
      let node: Element | null = this;
      while (node) {
        const found = selectors.split(",").some(selector => {
          if (selector === "a[href]") return node!.tagName === "A" && Object.hasOwn(node!.attrs, "href");
          if (selector === "[data-experience-mask]") return Object.hasOwn(node!.attrs, "data-experience-mask");
          if (selector.startsWith("[contenteditable]")) return Object.hasOwn(node!.attrs, "contenteditable") && node!.attrs.contenteditable !== "false";
          return node!.tagName.toLowerCase() === selector;
        });
        if (found) return node;
        node = node.parentElement;
      }
      return null;
    }
  }
  class Details extends Element { open = false; }
  const add = (map: Map<string, Set<Callback>>, kind: string, callback: Callback) => { if (!map.has(kind)) map.set(kind, new Set()); map.get(kind)!.add(callback); };
  const remove = (map: Map<string, Set<Callback>>, kind: string, callback: Callback) => map.get(kind)?.delete(callback);
  const document = {
    cookie, hidden: false, documentElement: { scrollHeight: 6000 }, body: { scrollHeight: 6000 },
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    addEventListener: (kind: string, callback: Callback) => add(docEvents, kind, callback),
    removeEventListener: (kind: string, callback: Callback) => remove(docEvents, kind, callback),
  };
  const window = { innerWidth: 1440, innerHeight: 900, scrollY: 0,
    addEventListener: (kind: string, callback: Callback) => add(winEvents, kind, callback),
    removeEventListener: (kind: string, callback: Callback) => remove(winEvents, kind, callback),
  };
  const navigator = { doNotTrack: dnt, globalPrivacyControl: gpc }, location = { pathname: path };
  const exports: { createBrowserExperienceRecorder?: () => InstanceType<typeof ExperienceRecorder> } = {};
  const source = ts.transpileModule(readFileSync(new URL("../lib/experience-client.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, window, document, navigator, location, Element, HTMLDetailsElement: Details,
    performance: { now: () => clock }, AbortSignal,
    setInterval: (callback: () => void) => { intervals.set(++nextTimer, callback); return nextTimer; }, clearInterval: (id: number) => intervals.delete(id),
    ResizeObserver: class { constructor(_callback: () => void) { observerCount++; } observe() {} disconnect() {} },
    fetch: async (_url: string, options: { body: string }) => { const body = JSON.parse(options.body); requests.push(body); if (body.action === "start") clock += admissionDelayMs; return { ok: true, json: async () => body.action === "start" ? admission() : body.action === "append" ? { ok: true, accepted: true, seq: body.seq } : { ok: true, withdrawn: true } }; },
  });
  const recorder = exports.createBrowserExperienceRecorder!();
  const dispatch = (map: Map<string, Set<Callback>>, kind: string, event: Record<string, unknown>) => { for (const callback of map.get(kind) || []) callback(event); };
  return { recorder, document, window, navigator, location, requests, Element,
    doc: (kind: string, event: Record<string, unknown>) => dispatch(docEvents, kind, event),
    win: (kind: string, event: Record<string, unknown>) => dispatch(winEvents, kind, event),
    time: (value: number) => { clock = value; },
    listeners: () => ({ doc: [...docEvents].filter(([, value]) => value.size).map(([key]) => key), win: [...winEvents].filter(([, value]) => value.size).map(([key]) => key), intervals: intervals.size, observers: observerCount }),
  };
}

test("actual browser recorder adds no capture listener, observer, timer or request before valid consent", async () => {
  for (const options of [{}, { cookie: "satinlore_replay=off" }, { cookie: "satinlore_replay=on", path: "/contact" },
    { cookie: "satinlore_replay=on", path: "/admin" }, { cookie: "satinlore_replay=on", dnt: "1" },
    { cookie: "satinlore_replay=on", gpc: true }, { cookie: "satinlore_replay=on; satinlore_measurement=off" }]) {
    const app = browserBinding(options);
    assert.equal(await app.recorder.start(), false, JSON.stringify(options));
    assert.deepEqual(app.listeners(), { doc: [], win: [], intervals: 0, observers: 0 });
    assert.deepEqual(app.requests, []);
  }
  assert.equal(replayPermitted("/", "satinlore_replay=on", { doNotTrack: "" }), true);
});

test("real pointer and click bindings exclude complete forms, editable regions and private links without reading values", async () => {
  const app = browserBinding({ cookie: "satinlore_replay=on" });
  assert.equal(await app.recorder.start(), true);
  const form = new app.Element("form");
  const masked = [new app.Element("input"), new app.Element("textarea"), new app.Element("select"),
    new app.Element("button", {}, form), new app.Element("span", {}, new app.Element("div", { "data-experience-mask": "" })),
    new app.Element("div", { contenteditable: "true" }), new app.Element("a", { href: "/manage?token=PRIVATE_FORM_CANARY" }),
    new app.Element("a", { href: "https://other.example.test/private" })];
  for (const target of masked) {
    app.time(1000); app.doc("pointermove", { target, clientX: 1400, clientY: 800 });
    app.doc("click", { target, clientX: 1400, clientY: 800 });
  }
  const publicLink = new app.Element("a", { href: "#waitlist" });
  app.doc("pointermove", { target: publicLink, clientX: 144, clientY: 300 });
  app.doc("click", { target: publicLink, clientX: 144, clientY: 300 });
  await app.recorder.flush();
  const events = app.requests.filter(body => body.action === "append").flatMap(body => body.events as ExperienceEvent[]);
  assert.equal(events.filter(event => event.k === "pointer").length, 1);
  assert.equal(events.filter(event => event.k === "click").length, 1);
  assert.doesNotMatch(JSON.stringify(app.requests), /PRIVATE_FORM_CANARY|manage|other\.example/);
  assert.ok(events.every(event => !Object.hasOwn(event, "value") && !Object.hasOwn(event, "text") && !Object.hasOwn(event, "href")));
  for (const kind of ["input", "change", "keydown", "keyup", "selectionchange", "copy"]) assert.equal(app.listeners().doc.includes(kind), false, kind);
  await app.recorder.stop();
});

test("real browser bindings throttle pointer samples and clear all capture listeners on withdrawal", async () => {
  const app = browserBinding({ cookie: "satinlore_replay=on" }); await app.recorder.start();
  const target = new app.Element("article");
  for (const time of [0, 10, 100, 499, 500, 700, 1000]) { app.time(time); app.doc("pointermove", { target, clientX: 50, clientY: 50 }); }
  await app.recorder.flush();
  const events = app.requests.filter(body => body.action === "append").flatMap(body => body.events as ExperienceEvent[]);
  assert.equal(events.filter(event => event.k === "pointer").length, 3);
  app.document.cookie = "satinlore_replay=off";
  app.time(1500); app.doc("click", { target, clientX: 100, clientY: 100 });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(app.recorder.snapshot().active, false);
  assert.deepEqual({ doc: app.listeners().doc, win: app.listeners().win, intervals: app.listeners().intervals }, { doc: [], win: [], intervals: 0 });
  assert.equal(app.requests.filter(body => body.action === "withdraw").length, 1);
});

test("a revoked delayed admission is erased without ever installing capture listeners", async () => {
  const app = lifecycle(); let admit: ((reply: unknown) => void) | undefined;
  app.request(body => body.action === "start" ? new Promise(resolve => { admit = resolve; }) : Promise.resolve({ ok: true, withdrawn: true }));
  const starting = app.recorder.start();
  app.allowed(false); await app.recorder.stop({ withdraw: true });
  admit!(admission()); assert.equal(await starting, false);
  assert.deepEqual(app.requests.map(body => body.action), ["start", "withdraw"]);
  assert.equal(app.listeners().attaches, 0); assert.equal(app.listeners().interval, false);
  assert.equal(app.recorder.snapshot().active, false);
});

test("retrying a lost acknowledgement sends the identical sequence and event payload before newer events", async () => {
  const app = lifecycle(); let appends = 0;
  app.request(async body => {
    if (body.action === "start") return admission();
    if (body.action === "append" && ++appends === 1) throw new Error("Synthetic lost acknowledgement");
    return { ok: true, accepted: true, seq: body.seq };
  });
  await app.recorder.start(); app.time(100); app.push({ k: "click", x: 100, y: 100 });
  await app.recorder.flush();
  app.time(200); app.push({ k: "pointer", x: 200, y: 200 });
  await app.recorder.flush(); await app.recorder.flush();
  const writes = app.requests.filter(body => body.action === "append");
  assert.equal(writes.length, 3);
  assert.deepEqual(writes[0], writes[1]);
  assert.equal(writes[0].seq, 0); assert.equal(writes[2].seq, 1);
  assert.ok((writes[2].events as ExperienceEvent[]).some(event => event.k === "pointer"));
  assert.equal(app.recorder.snapshot().sequence, 2);
  await app.recorder.stop();
});

test("loss of consent discards queued events and withdraws instead of flushing them", async () => {
  const app = lifecycle(); await app.recorder.start();
  app.time(100); app.push({ k: "click", x: 200, y: 200 });
  app.allowed(false); await app.recorder.flush();
  assert.equal(app.requests.some(body => body.action === "append"), false);
  assert.deepEqual(app.requests.map(body => body.action), ["start", "withdraw"]);
  assert.equal(app.recorder.snapshot().queued, 0);
  assert.equal(app.listeners().listening, false);
});

test("the event cap stops capture without emitting oversized batches or retaining capture timers", async () => {
  const app = lifecycle(); await app.recorder.start();
  for (let index = 0; index < 3100; index++) { app.time(index); app.push({ k: "click", x: 200, y: 200 }); }
  await Promise.resolve(); await Promise.resolve();
  assert.ok(app.recorder.snapshot().captured <= 3000);
  assert.equal(app.recorder.snapshot().active, false); assert.equal(app.listeners().interval, false);
  for (const write of app.requests.filter(body => body.action === "append")) assert.ok((write.events as unknown[]).length <= 64);
});

test("new private experience pages deny access before rendering admin or preview content", async () => {
  for (const path of ["experience/page.tsx", "experience/preview/page.tsx"]) {
    const source = ts.transpileModule(readFileSync(new URL(`../app/admin/${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    let checks = 0;
    const exports: { default?: () => Promise<{ props: { title: string } }> } = {};
    new Function("require", "exports", source)((name: string) => {
      if (name === "react/jsx-runtime") return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
      if (name === "@/lib/waitlist-server") return { isOwner: async () => { checks++; return false; } };
      if (["@/lib/PageFrame", "@/lib/AdminShell", "@/lib/AdminExperiencePanel", "@/lib/MarketingHome"].includes(name)) return { default: () => { throw new Error("Protected content rendered without authentication"); } };
      throw new Error(`Unreviewed page dependency ${name}`);
    }, exports);
    assert.equal((await exports.default!()).props.title, "Founder access only.");
    assert.equal(checks, 1);
  }
  const source = readFileSync(new URL("../lib/AdminExperiencePanel.tsx", import.meta.url), "utf8");
  const sandbox = source.match(/sandbox="([^"]+)"/)?.[1];
  assert.equal(sandbox, "allow-same-origin");
  assert.doesNotMatch(sandbox!, /allow-scripts|allow-forms|allow-top-navigation/);
});

test("normal homepage navigation preserves its final batch while stopping all capture on the destination", async () => {
  const app = browserBinding({ cookie: "satinlore_replay=on" }); await app.recorder.start();
  const target = new app.Element("a", { href: "/contact" });
  app.time(100); app.doc("click", { target, clientX: 144, clientY: 300 });
  app.location.pathname = "/contact";
  app.time(200); app.doc("click", { target: new app.Element("article"), clientX: 1300, clientY: 800 });
  for (let index = 0; index < 5; index++) await Promise.resolve();
  assert.equal(app.recorder.snapshot().active, false);
  assert.deepEqual(app.requests.map(body => body.action), ["start", "append"]);
  const events = app.requests.find(body => body.action === "append")!.events as ExperienceEvent[];
  assert.equal(events.filter(event => event.k === "click").length, 1);
  assert.equal(events.find(event => event.k === "click")!.t, 100);
  assert.deepEqual({ doc: app.listeners().doc, win: app.listeners().win, intervals: app.listeners().intervals }, { doc: [], win: [], intervals: 0 });
});

test("effective visibility changes include privacy-dialog suppression without collecting hidden activity", async () => {
  const app = lifecycle(); await app.recorder.start();
  app.time(1000); app.visible(false); app.recorder.refreshVisibility();
  app.time(5000); app.push({ k: "pointer", x: 900, y: 900 }); app.tick();
  app.time(7000); app.visible(true); app.recorder.refreshVisibility();
  app.time(8000); app.tick();
  for (let index = 0; index < 5; index++) await Promise.resolve();
  await app.recorder.flush();
  const events = app.requests.filter(body => body.action === "append").flatMap(body => body.events as ExperienceEvent[]);
  const visibility = events.filter(event => event.k === "visibility");
  assert.deepEqual(visibility, [{ k: "visibility", visible: true, t: 0 }, { k: "visibility", visible: false, t: 1000 }, { k: "visibility", visible: true, t: 7000 }]);
  assert.equal(events.filter(event => event.k === "pointer").length, 0);
  const views = events.filter((event): event is Extract<ExperienceEvent, { k: "view" }> => event.k === "view");
  assert.ok(views.every(event => event.t >= 7000));
  await app.recorder.stop();
});


test("admission starts the timeline at zero and records an existing halfway scroll without a new scroll event", async () => {
  const app = browserBinding({cookie: "satinlore_replay=on", admissionDelayMs: 4000});
  app.window.scrollY = 2550;
  assert.equal(await app.recorder.start(), true);
  await app.recorder.flush();
  const events = app.requests.filter(body => body.action === "append").flatMap(body => body.events as ExperienceEvent[]);
  assert.ok(events.some(event => event.k === "scroll" && event.y === 500), "The initial page position is captured before the visitor scrolls again.");
  assert.ok(events.some(event => event.k === "viewport"));
  assert.ok(events.some(event => event.k === "visibility"));
  assert.ok(events.every(event => event.t === 0), "The admission network wait is excluded from all initial replay events.");
  assert.equal(events.filter(event => event.k === "scroll").length, 1);
  app.time(4100); app.window.scrollY = 3060; app.win("scroll", {});
  await app.recorder.flush();
  const later = app.requests.filter(body => body.action === "append").flatMap(body => body.events as ExperienceEvent[]);
  assert.ok(later.some(event => event.k === "scroll" && event.y === 600 && event.t === 100));
  await app.recorder.stop();
});
