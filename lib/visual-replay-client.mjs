import { createVisualEventSanitizer, VISUAL_FORMAT, VISUAL_MAX_BATCH_BYTES, VISUAL_MAX_BATCH_EVENTS, VISUAL_MAX_DURATION, VISUAL_MAX_EVENTS, VISUAL_MAX_SESSION_BYTES } from "./visual-replay-codec.mjs";
export const VISUAL_BLOCK_SELECTOR = "form,input,textarea,select,option,[contenteditable]:not([contenteditable='false']),[data-experience-mask],.signup-card,.website-experience,iframe,frame,object,embed,canvas,video,audio,script,noscript,meta,base";
/** The recorder runs only after admission; plugins, canvas, fonts and input content stay off. */
export function visualRecordOptions(emit) {
    return {
        emit, blockSelector: VISUAL_BLOCK_SELECTOR, ignoreSelector: VISUAL_BLOCK_SELECTOR,
        maskTextSelector: VISUAL_BLOCK_SELECTOR, maskAllInputs: true, maskInputFn: () => "",
        recordCanvas: false, recordCrossOriginIframes: false, inlineImages: false, collectFonts: false,
        inlineStylesheet: true, checkoutEveryNms: 120000,
        slimDOMOptions: { script: true, comment: true, headFavicon: true, headWhitespace: true,
            headMetaDescKeywords: true, headMetaSocial: true, headMetaRobots: true, headMetaHttpEquiv: true,
            headMetaAuthorship: true, headMetaVerification: true },
        sampling: { mousemove: 250, mousemoveCallback: 500, scroll: 250,
            mouseInteraction: { MouseUp: false, MouseDown: false, Click: true, ContextMenu: false, DblClick: false,
                Focus: false, Blur: false, TouchStart: false, TouchMove_Departed: false, TouchEnd: false, TouchCancel: false } },
        plugins: [], errorHandler: () => true,
    };
}
/** Parallel bounded visual stream, sharing the numeric session's in-memory ownership credential. */
export class VisualReplayRecorder {
    env;
    credentials;
    cleaner;
    stopRecord = null;
    recordStarter = null;
    active = false;
    epoch = 0;
    queue = [];
    pending = null;
    sequence = 0;
    captured = 0;
    bytes = 0;
    inflight = null;
    lastTimestamp = 0;
    constructor(env, credentials) { this.env = env; this.credentials = credentials; this.cleaner = createVisualEventSanitizer({assetOrigin: env.assetOrigin || "https://satinlore.com"}); }
    snapshot() { return { active: this.active, captured: this.captured, bytes: this.bytes, queued: this.queue.length, sequence: this.sequence }; }
    async start() {
        if (this.active || !this.env.allowed())
            return false;
        const epoch = ++this.epoch;
        this.active = true;
        try {
            const record = await this.env.loadRecord();
            if (!this.active || epoch !== this.epoch || !this.env.allowed() || this.env.offset() > VISUAL_MAX_DURATION) {
                this.active = false;
                return false;
            }
            this.recordStarter = record;
            this.refreshVisibility();
            return this.active;
        }
        catch {
            if (epoch === this.epoch)
                this.fail();
            return false;
        }
    }
    refreshVisibility() {
        if (!this.active || !this.env.allowed())
            return;
        if (!this.env.visible()) {
            this.stopRecord?.();
            this.stopRecord = null;
            return;
        }
        if (this.stopRecord || !this.recordStarter)
            return;
        this.cleaner.reset();
        try {
            const stop = this.recordStarter(visualRecordOptions(event => this.push(event)));
            if (typeof stop !== "function")
                throw new Error();
            if (!this.active)
                stop();
            else
                this.stopRecord = stop;
        }
        catch {
            this.fail();
        }
    }
    fail() { this.stopCapture(); this.queue = []; this.pending = null; this.env.onFailure?.(); }
    push(input) {
        if (!this.active || !this.env.allowed()) {
            this.stopCapture();
            return;
        }
        const offset = Math.max(0, Math.floor(this.env.offset()));
        if (offset > VISUAL_MAX_DURATION || this.captured >= VISUAL_MAX_EVENTS) {
            this.stopCapture();
            return;
        }
        if (!this.env.visible())
            return;
        if (!input || typeof input !== "object" || Array.isArray(input))
            return;
        const timestamp = Math.max(this.lastTimestamp, offset);
        const event = this.cleaner.sanitize({ ...input, timestamp });
        if (!event)
            return;
        const size = new TextEncoder().encode(JSON.stringify(event)).byteLength;
        if (size > VISUAL_MAX_BATCH_BYTES - 2 || this.bytes + size > VISUAL_MAX_SESSION_BYTES) {
            this.stopCapture();
            return;
        }
        this.lastTimestamp = timestamp;
        this.bytes += size;
        this.captured++;
        this.queue.push(event);
        if (this.queue.length >= 40 || size > 100000)
            void this.flush();
    }
    batch() {
        const events = [];
        let size = 2;
        while (this.queue.length && events.length < VISUAL_MAX_BATCH_EVENTS) {
            const next = this.queue[0], bytes = new TextEncoder().encode(JSON.stringify(next)).byteLength + (events.length ? 1 : 0);
            if (size + bytes > VISUAL_MAX_BATCH_BYTES)
                break;
            events.push(this.queue.shift());
            size += bytes;
        }
        return events;
    }
    async flush(keepalive = false) {
        if (this.inflight)
            return this.inflight;
        if (!this.env.consentAllowed() || !this.queue.length && !this.pending)
            return;
        if (this.sequence >= 120) {
            this.stopCapture();
            this.queue = [];
            return;
        }
        if (!this.pending)
            this.pending = { events: this.batch(), seq: this.sequence, retries: 0 };
        const pending = this.pending;
        if (!pending.events.length) {
            this.pending = null;
            return;
        }
        // Browser keepalive is capped at ~64 KiB. A normal, bounded request is used
        // for larger snapshots; ordinary five-second flushing does the durable work.
        const canKeepalive = keepalive && new TextEncoder().encode(JSON.stringify(pending.events)).byteLength < 60000;
        const epoch = this.epoch;
        const operation = (async () => {
            try {
                const reply = await this.env.request({ action: "visual", ...this.credentials, seq: pending.seq, events: pending.events }, canKeepalive);
                if (epoch !== this.epoch)
                    return;
                if (reply?.ok !== true || reply.accepted !== true || reply.seq !== pending.seq)
                    throw new Error();
                this.sequence++;
                this.pending = null;
            }
            catch {
                if (epoch !== this.epoch)
                    return;
                if (++pending.retries >= 3)
                    this.fail();
            }
        })();
        this.inflight = operation;
        await operation;
        if (this.inflight === operation)
            this.inflight = null;
    }
    stopCapture() { this.active = false; this.stopRecord?.(); this.stopRecord = null; }
    discard() { this.stopCapture(); ++this.epoch; this.recordStarter = null; this.queue = []; this.pending = null; this.cleaner.reset(); }
}
export async function loadVisualRecord() {
    const module = await import("@rrweb/record");
    return module.record;
}
export { VISUAL_FORMAT };
