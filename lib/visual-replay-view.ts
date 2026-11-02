import { createVisualEventSanitizer } from "./visual-replay-codec.mjs";

export type VisualRecording = {
  format: string; events: unknown[]; bytes?: number; eventCount?: number;
  durationMs?: number; baseTimestamp?: number; incomplete?: boolean;
};

const MAX_DURATION = 600_000;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** The renderer accepts only the documented numeric timeline, never compressed/custom payloads. */
export function visualReplayTimeline(value: VisualRecording) {
  if (value.format !== "rrweb-v1" || !Array.isArray(value.events) || value.events.length > 5000) {
    throw new Error("This visual recording has an unsupported format.");
  }
  let previous = -1, hasMeta = false, hasSnapshot = false;
  for (const item of value.events) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("The visual recording is incomplete.");
    const event = item as Record<string, unknown>;
    if (!Number.isInteger(event.type) || ![0, 1, 2, 3, 4].includes(event.type as number) ||
        !finite(event.timestamp) || event.timestamp < 0 || event.timestamp > MAX_DURATION || event.timestamp < previous) {
      throw new Error("The visual recording has an invalid timeline.");
    }
    previous = event.timestamp;
    if (event.type === 4) hasMeta = true;
    if (event.type === 2 && hasMeta) hasSnapshot = true;
  }
  if (!hasMeta || !hasSnapshot || value.events.length < 2) throw new Error("The page snapshot did not arrive. The interaction replay may still be available.");
  const start = (value.events[0] as { timestamp: number }).timestamp;
  const end = previous;
  return { start, end, duration: Math.min(MAX_DURATION, Math.max(0, end - start)) };
}

export function visualReplayPosition(value: unknown, duration: number) {
  return finite(value) ? Math.max(0, Math.min(duration, value)) : 0;
}

/** Treat stored public payloads as untrusted, including records from before a codec upgrade. */
export function prepareVisualReplay(recording: VisualRecording) {
  visualReplayTimeline(recording);
  const filter = createVisualEventSanitizer();
  const events = recording.events.flatMap(event => {
    const safe = filter.sanitize(event);
    return safe ? [safe] : [];
  });
  const timeline = visualReplayTimeline({ ...recording, events });
  return { ...timeline, events, dropped: events.length !== recording.events.length };
}

export const VISUAL_REPLAYER_OPTIONS = {
  speed: 1, skipInactive: false, showWarning: false, showDebug: false,
  triggerFocus: false, UNSAFE_replayCanvas: false, mouseTail: false,
  pauseAnimation: true, useVirtualDom: false, plugins: [], loadTimeout: 0,
} as const;

