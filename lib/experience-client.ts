/** Optional interaction replay. No DOM snapshots, user text, URLs or persistent visitor IDs. */
export const EXPERIENCE_LAYOUT = "landing-20261102";
export const REPLAY_COOKIE = "satinlore_replay";
export const PRIVACY_EVENT = "satinlore:privacy-choice";
export const OPEN_PRIVACY_EVENT = "satinlore:open-replay-choices";
export const EXPERIENCE_SECTIONS = ["hero", "steps", "experience", "reading", "controls", "beta", "waitlist", "faq", "footer"] as const;
type Section = typeof EXPERIENCE_SECTIONS[number];
export type ExperienceViewport = {w: number; h: number; dh: number};
export type ExperienceEvent = {t: number; k: "pointer" | "click"; x: number; y: number}
  | {t: number; k: "scroll"; y: number}
  | {t: number; k: "view"; section: Section; ms: number}
  | ({t: number; k: "viewport"} & ExperienceViewport)
  | {t: number; k: "visibility"; visible: boolean}
  | {t: number; k: "toggle"; target: "menu" | `faq-${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`; open: boolean};
export type ExperienceState = "off" | "starting" | "recording" | "unavailable" | "finished";
type Credentials = {sid: string; token: string};
type SessionReply = Credentials & {ok: true; maxDurationMs: number};
type EventInput = ExperienceEvent extends infer E ? E extends ExperienceEvent ? Omit<E, "t"> : never : never;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_EVENTS = 3000;
const MAX_DURATION = 600000;

export function replayChoice(cookie: string): "on" | "off" | null {
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(REPLAY_COOKIE + "="))?.slice(REPLAY_COOKIE.length + 1);
  return value === "on" || value === "off" ? value : null;
}
export function browserPrivacyOff(nav: Pick<Navigator, "doNotTrack"> & {globalPrivacyControl?: boolean}, cookie: string) {
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true || cookie.split(";").some(part => part.trim() === "satinlore_measurement=off");
}
export function replayPermitted(path: string, cookie: string, nav: Pick<Navigator, "doNotTrack"> & {globalPrivacyControl?: boolean}) {
  return path === "/" && replayChoice(cookie) === "on" && !browserPrivacyOff(nav, cookie);
}
export function replayPreferenceCookie(value: "on" | "off", secure = true) {
  return `${REPLAY_COOKIE}=${value}; Path=/; SameSite=Lax; Max-Age=15552000${secure ? "; Secure" : ""}`;
}
export function normalised(value: number, extent: number) {
  return Math.max(0, Math.min(1000, Math.round(value / Math.max(1, extent) * 1000)));
}
export function safeViewport(w: number, h: number, dh: number): ExperienceViewport {
  const quantise = (value: number) => Math.round(value / 10) * 10;
  const width = Math.max(100, Math.min(4000, quantise(w)));
  const height = Math.max(100, Math.min(4000, quantise(h)));
  return {w: width, h: height, dh: Math.max(height, Math.min(60000, quantise(dh)))};
}

export type ExperienceEnvironment = {
  allowed(): boolean;
  consentAllowed?(): boolean;
  now(): number;
  viewport(): ExperienceViewport;
  visible(): boolean;
  request(body: Record<string, unknown>, keepalive?: boolean): Promise<unknown>;
  listen(push: (event: EventInput) => void, flush: () => void): () => void;
  interval(callback: () => void, ms: number): unknown;
  clearInterval(timer: unknown): void;
  views(ms: number): {section: Section; ms: number}[];
  onState?(state: ExperienceState): void;
};

/** Testable lifecycle; admission and write credentials remain in this object's memory only. */
export class ExperienceRecorder {
  private env: ExperienceEnvironment;
  private epoch = 0;
  private credentials: Credentials | null = null;
  private active = false;
  private startedAt = 0;
  private lastViewAt = 0;
  private captured = 0;
  private sequence = 0;
  private queue: ExperienceEvent[] = [];
  private pending: {events: ExperienceEvent[]; seq: number; retries: number} | null = null;
  private sending = false;
  private timer: unknown = null;
  private detach: (() => void) | null = null;
  private state: ExperienceState = "off";
  private visibleState = false;

  constructor(env: ExperienceEnvironment) { this.env = env; }
  private setState(state: ExperienceState) { this.state = state; this.env.onState?.(state); }
  snapshot() { return {state: this.state, active: this.active, captured: this.captured, queued: this.queue.length, sequence: this.sequence,
    canWithdraw: this.credentials !== null || this.state === "starting"}; }
  private consentAllowed() { return this.env.consentAllowed?.() ?? this.env.allowed(); }
  refreshVisibility() {
    if (this.active && this.visibleState !== this.env.visible()) this.push({k: "visibility", visible: this.env.visible()});
  }
  private removeListeners() {
    this.detach?.(); this.detach = null;
    if (this.timer !== null) this.env.clearInterval(this.timer);
    this.timer = null;
  }
  private async erase(credentials: Credentials) {
    try {
      const reply = await this.env.request({action: "withdraw", ...credentials}, true) as {ok?: boolean; deleted?: boolean};
      return reply?.ok === true;
    } catch { return false; }
  }
  async start() {
    if (this.active || this.state === "starting" || !this.env.allowed()) return false;
    const epoch = ++this.epoch;
    this.setState("starting");
    this.startedAt = this.env.now(); this.lastViewAt = this.startedAt;
    try {
      const reply = await this.env.request({action: "start", v: 1, layout: EXPERIENCE_LAYOUT,
        viewport: this.env.viewport(), consent: true}) as SessionReply;
      if (!reply || reply.ok !== true || !UUID.test(reply.sid) || typeof reply.token !== "string" || !/^[a-f0-9]{32,128}$/i.test(reply.token)) throw new Error();
      const credentials = {sid: reply.sid, token: reply.token};
      if (epoch !== this.epoch || !this.env.allowed()) { await this.erase(credentials); return false; }
      this.credentials = credentials; this.active = true;
      this.captured = 0; this.sequence = 0; this.queue = []; this.pending = null;
      this.visibleState = this.env.visible();
      this.push({k: "visibility", visible: this.visibleState});
      this.detach = this.env.listen(event => this.push(event), () => { void this.flush(true); });
      this.timer = this.env.interval(() => this.tick(), 1000);
      this.setState("recording");
      this.push({k: "viewport", ...this.env.viewport()});
      return true;
    } catch {
      if (epoch === this.epoch) this.setState("unavailable");
      return false;
    }
  }
  push(event: EventInput) {
    if (!this.active) return;
    if (!this.env.allowed()) { void this.stop(this.consentAllowed() ? {flush: true} : {withdraw: true}); return; }
    const t = Math.max(0, Math.floor(this.env.now() - this.startedAt));
    if (event.k === "visibility") { this.lastViewAt = this.env.now(); this.visibleState = event.visible; }
    if (t > MAX_DURATION || this.captured >= MAX_EVENTS) { void this.stop({flush: true}); this.setState("finished"); return; }
    if (!this.env.visible() && event.k !== "visibility") return;
    this.queue.push({...event, t} as ExperienceEvent); this.captured++;
    if (this.queue.length >= 48) void this.flush();
  }
  private tick() {
    if (!this.active) return;
    if (!this.env.allowed()) { void this.stop(this.consentAllowed() ? {flush: true} : {withdraw: true}); return; }
    this.refreshVisibility();
    const now = this.env.now();
    if (now - this.startedAt > MAX_DURATION) { void this.stop({flush: true}); this.setState("finished"); return; }
    const elapsed = Math.max(0, Math.min(1000, Math.floor(now - this.lastViewAt))); this.lastViewAt = now;
    if (this.env.visible() && elapsed) for (const view of this.env.views(elapsed)) this.push({k: "view", ...view});
    if (Math.floor((now - this.startedAt) / 1000) % 5 === 0) void this.flush();
  }
  async flush(keepalive = false) {
    if (!this.credentials || this.sending || !this.queue.length && !this.pending) return;
    if (!this.consentAllowed()) { await this.stop({withdraw: true}); return; }
    if (!this.pending) this.pending = {events: this.queue.splice(0, 64), seq: this.sequence, retries: 0};
    const pending = this.pending, credentials = this.credentials, epoch = this.epoch;
    this.sending = true;
    try {
      const reply = await this.env.request({action: "append", ...credentials, seq: pending.seq, events: pending.events}, keepalive) as {ok?: boolean; accepted?: boolean; seq?: number};
      if (epoch !== this.epoch) return;
      if (reply?.ok !== true || reply.accepted !== true || reply.seq !== pending.seq) throw new Error();
      this.sequence++; this.pending = null;
      if (this.sequence >= 120) { this.active = false; this.queue = []; this.removeListeners(); this.setState("finished"); }
    } catch {
      if (epoch !== this.epoch) return;
      pending.retries++;
      if (pending.retries >= 3) { this.active = false; this.queue = []; this.removeListeners(); this.setState("unavailable"); }
    } finally { this.sending = false; }
  }
  async stop({withdraw = false, flush = false} = {}) {
    const admissionPending = this.state === "starting";
    this.active = false; this.removeListeners();
    if (flush && !withdraw) await this.flush(true);
    ++this.epoch;
    const credentials = this.credentials; this.credentials = null;
    this.queue = []; this.pending = null; this.setState("off");
    return credentials && withdraw ? this.erase(credentials) : withdraw && admissionPending ? false : true;
  }
}

const MASK = "form,input,textarea,select,option,[contenteditable]:not([contenteditable='false']),[data-experience-mask]";
export function maskedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest(MASK)) return true;
  const anchor = target.closest("a[href]");
  if (!anchor) return false;
  const href = anchor.getAttribute("href") || "";
  return !href.startsWith("#") && !["/", "/privacy", "/contact"].includes(href);
}

export function createBrowserExperienceRecorder(onState?: (state: ExperienceState) => void) {
  const viewport = () => safeViewport(window.innerWidth, window.innerHeight, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  const visible = () => !document.hidden && !document.querySelector('[data-experience-consent-open="true"]');
  return new ExperienceRecorder({
    allowed: () => replayPermitted(location.pathname, document.cookie, navigator), now: () => performance.now(), viewport, visible, onState,
    consentAllowed: () => replayChoice(document.cookie) === "on" && !browserPrivacyOff(navigator, document.cookie),
    async request(body, keepalive = false) {
      const response = await fetch("/api/experience", {method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: {"Content-Type": "application/json", Accept: "application/json"}, body: JSON.stringify(body), keepalive, signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error("Optional replay is unavailable.");
      return response.json();
    },
    interval: (callback, ms) => setInterval(callback, ms), clearInterval: timer => clearInterval(timer as ReturnType<typeof setInterval>),
    views(ms) {
      const height = window.innerHeight;
      const sections = [...document.querySelectorAll<HTMLElement>("[data-experience-section]")].map(element => {
        const section = element.dataset.experienceSection as Section;
        const rect = element.getBoundingClientRect();
        return {section, pixels: Math.max(0, Math.min(height, rect.bottom) - Math.max(0, rect.top))};
      }).filter(value => EXPERIENCE_SECTIONS.includes(value.section) && value.pixels > 0);
      const total = Math.max(height, sections.reduce((sum, value) => sum + value.pixels, 0));
      return sections.map(value => ({section: value.section, ms: Math.floor(ms * value.pixels / total)})).filter(value => value.ms > 0);
    },
    listen(push, flush) {
      let lastPointer = -Infinity, lastScroll = -Infinity, lastViewport = JSON.stringify(viewport());
      const coordinates = (event: MouseEvent) => ({x: normalised(event.clientX, window.innerWidth),
        y: normalised(event.clientY + window.scrollY, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))});
      const pointer = (event: PointerEvent) => {
        if (maskedTarget(event.target) || performance.now() - lastPointer < 500) return;
        lastPointer = performance.now(); push({k: "pointer", ...coordinates(event)});
      };
      const click = (event: MouseEvent) => { if (!maskedTarget(event.target)) push({k: "click", ...coordinates(event)}); };
      const scroll = () => {
        if (performance.now() - lastScroll < 500) return;
        lastScroll = performance.now(); const size = viewport();
        push({k: "scroll", y: normalised(window.scrollY, size.dh - size.h)});
      };
      const resize = () => { const size = viewport(), signature = JSON.stringify(size); if (signature !== lastViewport) { lastViewport = signature; push({k: "viewport", ...size}); } };
      const visibility = () => { push({k: "visibility", visible: visible()}); if (document.hidden) flush(); };
      const leaving = () => { push({k: "visibility", visible: false}); flush(); };
      const faq = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLDetailsElement) || !/^[0-7]$/.test(target.dataset.experienceFaq || "")) return;
        push({k: "toggle", target: `faq-${target.dataset.experienceFaq}` as `faq-${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`, open: target.open});
      };
      const menu = (event: Event) => {
        const value = (event as CustomEvent).detail;
        if (value?.target === "menu" && typeof value.open === "boolean") push({k: "toggle", target: "menu", open: value.open});
      };
      document.addEventListener("pointermove", pointer, {passive: true}); document.addEventListener("click", click, {passive: true});
      window.addEventListener("scroll", scroll, {passive: true}); window.addEventListener("resize", resize, {passive: true});
      document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", leaving);
      document.addEventListener("toggle", faq, true); window.addEventListener("satinlore:replay-ui", menu);
      const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null; observer?.observe(document.body);
      for (const details of document.querySelectorAll<HTMLDetailsElement>("details[data-experience-faq]")) faq({target: details} as unknown as Event);
      push({k: "toggle", target: "menu", open: document.getElementById("nav")?.classList.contains("is-open") === true});
      return () => {
        document.removeEventListener("pointermove", pointer); document.removeEventListener("click", click);
        window.removeEventListener("scroll", scroll); window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", leaving); observer?.disconnect();
        document.removeEventListener("toggle", faq, true); window.removeEventListener("satinlore:replay-ui", menu);
      };
    },
  });
}
