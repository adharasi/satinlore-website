/** Geometry for the founder's reconstructed interaction replay, never a DOM snapshot. */
export type ReplayViewport = { w: number; h: number; dh: number };
export type ExperienceViewEvent =
  | { k: "pointer" | "click"; t: number; x: number; y: number }
  | { k: "scroll"; t: number; y: number }
  | { k: "viewport"; t: number; w: number; h: number; dh: number }
  | { k: "view"; t: number; section: string; ms: number }
  | { k: "visibility"; t: number; visible: boolean };
export type ReplayPoint = { x: number; y: number };
export type ReplayClick = ReplayPoint & { t: number; ageMs: number };
export type ReplayState = {
  viewport: ReplayViewport;
  /** Scroll offset as a fraction of the available scroll range, from 0 to 1000. */
  scrollY: number;
  /** Coordinates within the whole public document, from 0 to 1000. */
  pointer: ReplayPoint | null;
  clicks: ReplayClick[];
  visible: boolean;
};

const MAX_EVENTS = 3000;
const MAX_DURATION_MS = 600_000;
const CLICK_LIFETIME_MS = 600;
const DEFAULT_VIEWPORT: ReplayViewport = { w: 1440, h: 900, dh: 900 };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const coordinate = (value: unknown): value is number => finite(value) && value >= 0 && value <= 1000;
const dimension = (value: unknown): value is number => finite(value) && value > 0 && value <= 60_000;

function viewport(value: Partial<ReplayViewport> | null | undefined, fallback = DEFAULT_VIEWPORT): ReplayViewport {
  const w = dimension(value?.w) ? value.w : fallback.w;
  const h = dimension(value?.h) ? value.h : fallback.h;
  const dh = dimension(value?.dh) ? Math.max(h, value.dh) : Math.max(h, fallback.dh);
  return { w, h, dh };
}

/**
 * Read only the bounded event prefix that the collector can create. Malformed
 * records are inert. Equal timestamps keep their original order, so a hide
 * followed by a show never revives an old pointer or click.
 */
export function replayState(events: readonly unknown[], atMs: number, initialViewport: Partial<ReplayViewport> = {}): ReplayState {
  const at = finite(atMs) ? Math.max(0, Math.min(MAX_DURATION_MS, atMs)) : 0;
  const state: ReplayState = { viewport: viewport(initialViewport), scrollY: 0, pointer: null, clicks: [], visible: true };
  const ordered = (Array.isArray(events) ? events.slice(0, MAX_EVENTS) : [])
    .flatMap((event, index) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) return [];
      const record = event as Record<string, unknown>;
      if (!finite(record.t) || !Number.isInteger(record.t) || record.t < 0 || record.t > MAX_DURATION_MS || record.t > at) return [];
      return [{ record, index, t: record.t }];
    })
    .sort((a, b) => a.t - b.t || a.index - b.index);

  for (const { record, t } of ordered) {
    if (record.k === "visibility" && typeof record.visible === "boolean") {
      state.visible = record.visible;
      if (!state.visible) { state.pointer = null; state.clicks = []; }
    } else if (record.k === "viewport" && dimension(record.w) && dimension(record.h) && dimension(record.dh)) {
      state.viewport = viewport({ w: record.w, h: record.h, dh: record.dh }, state.viewport);
    } else if (record.k === "scroll" && coordinate(record.y)) {
      state.scrollY = record.y;
    } else if ((record.k === "pointer" || record.k === "click") && state.visible && coordinate(record.x) && coordinate(record.y)) {
      state.pointer = { x: record.x, y: record.y };
      if (record.k === "click" && at - t <= CLICK_LIFETIME_MS) {
        state.clicks.push({ x: record.x, y: record.y, t, ageMs: at - t });
        if (state.clicks.length > 10) state.clicks.shift();
      }
    }
  }
  return state;
}

/** Fit the recorded viewport into a container without changing its proportions. */
export function fitViewport(originalWidth: number, originalHeight: number, availableWidth: number, maxHeight?: number) {
  const sourceWidth = dimension(originalWidth) ? originalWidth : DEFAULT_VIEWPORT.w;
  const sourceHeight = dimension(originalHeight) ? originalHeight : DEFAULT_VIEWPORT.h;
  const available = finite(availableWidth) && availableWidth > 0 ? availableWidth : 1;
  const heightLimit = finite(maxHeight) && maxHeight > 0 ? maxHeight : Infinity;
  const scale = Math.min(1, available / sourceWidth, heightLimit / sourceHeight);
  return { scale, width: sourceWidth * scale, height: sourceHeight * scale, sourceWidth, sourceHeight };
}

/** Match the public page's form IntersectionObserver when replay scripts are disabled. */
export function replayAtForm(rect: { top: number; bottom: number; left: number; right: number; width: number; height: number }, view: { w: number; h: number }, threshold = .05): boolean {
  if (![rect?.top, rect?.bottom, rect?.left, rect?.right, rect?.width, rect?.height, view?.w, view?.h, threshold].every(finite) ||
      rect.width <= 0 || rect.height <= 0 || rect.right <= rect.left || rect.bottom <= rect.top ||
      view.w <= 0 || view.h <= 0 || threshold < 0 || threshold > 1) return false;
  const intersectionWidth = Math.max(0, Math.min(rect.right, view.w) - Math.max(rect.left, 0));
  const intersectionHeight = Math.max(0, Math.min(rect.bottom, view.h) - Math.max(rect.top, 0));
  const area = intersectionWidth * intersectionHeight;
  return area > 0 && area / (rect.width * rect.height) >= threshold;
}
