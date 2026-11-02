"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Replayer } from "@rrweb/replay";
import { fitViewport } from "@/lib/experience-view";
import { prepareVisualReplay, visualReplayPosition, VISUAL_REPLAYER_OPTIONS, type VisualRecording } from "@/lib/visual-replay-view";

const elapsed = (value: number) => { const seconds = Math.floor(Math.max(0, value) / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };
const viewSize = (value: unknown): value is { width: number; height: number } => !!value && typeof value === "object" &&
  Number.isFinite((value as { width?: number }).width) && Number.isFinite((value as { height?: number }).height) &&
  (value as { width: number }).width >= 240 && (value as { width: number }).width <= 6000 &&
  (value as { height: number }).height >= 240 && (value as { height: number }).height <= 6000;

/** rrweb runs in the admin bundle; both documents receiving recorded DOM have scripts disabled. */
export default function VisualReplay({ recording, viewport, clicks = [] }: {
  recording: VisualRecording; viewport: { w: number; h: number }; clicks?: { t: number }[];
}) {
  const host = useRef<HTMLDivElement>(null), shell = useRef<HTMLIFrameElement>(null);
  const player = useRef<Replayer | null>(null), generation = useRef(0), atRef = useRef(0), playingRef = useRef(false);
  const [available, setAvailable] = useState(600), [size, setSize] = useState({ width: viewport.w, height: viewport.h });
  const [loaded, setLoaded] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [at, setAt] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1);
  const [fullScreen, setFullScreen] = useState(false), [notice, setNotice] = useState("");
  const prepared = useMemo(() => {
    try { return { ...prepareVisualReplay(recording), error: "" }; }
    catch (cause) { return { start: 0, end: 0, duration: 0, events: [], dropped: false, error: cause instanceof Error ? cause.message : "This visual replay could not be opened." }; }
  }, [recording]);
  const fit = fitViewport(size.width, size.height, available, fullScreen ? Math.max(240, window.innerHeight - 210) : 620);
  const pause = useCallback(() => {
    try { player.current?.pause(); } catch { /* Removal/expiry must still stop the local timer. */ }
    playingRef.current = false; setPlaying(false);
  }, []);
  useEffect(() => {
    const node = host.current; if (!node) return;
    const measure = () => setAvailable(Math.max(1, node.clientWidth)); measure();
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setFullScreen(document.fullscreenElement === host.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => {
    const current = ++generation.current;
    let owned: Replayer | null = null;
    setReady(false); setError(""); atRef.current = 0; setAt(0); playingRef.current = false; setPlaying(false);
    if (!loaded || prepared.error) return;
    void (async () => {
      try {
        const frame = shell.current, doc = frame?.contentDocument;
        if (!frame || frame.getAttribute("sandbox") !== "allow-same-origin" || !doc?.documentElement.matches('[data-visual-replay-shell="1"]')) {
          throw new Error("The protected replay frame is unavailable. Check your sign-in and reload.");
        }
        const mount = doc.getElementById("visual-replay-root"); if (!mount) throw new Error();
        const { Replayer: Engine } = await import("@rrweb/replay");
        if (current !== generation.current) return;
        mount.replaceChildren();
        const engine = new Engine(prepared.events as ConstructorParameters<typeof Engine>[0], {
          ...VISUAL_REPLAYER_OPTIONS, root: mount, plugins: [],
          logger: { log() {}, warn() {} },
        });
        owned = engine;
        // Do not weaken this contract to make an unsupported plugin work.
        if (engine.iframe.getAttribute("sandbox") !== "allow-same-origin" || engine.iframe.ownerDocument !== doc || engine.wrapper.ownerDocument !== doc) {
          engine.destroy(); throw new Error("The visual replay could not be safely isolated.");
        }
        engine.iframe.title = "Recorded website page";
        engine.iframe.tabIndex = -1; engine.iframe.inert = true;
        engine.iframe.referrerPolicy = "no-referrer";
        engine.disableInteract();
        engine.on("resize", (dimensions: unknown) => { if (current === generation.current && viewSize(dimensions)) setSize(dimensions); });
        engine.on("finish", () => { if (current === generation.current) { atRef.current = prepared.duration; setAt(prepared.duration); playingRef.current = false; setPlaying(false); } });
        engine.pause(0); player.current = engine; setReady(true);
      } catch (cause) {
        owned?.destroy(); owned = null;
        if (current === generation.current) { player.current = null; setError(cause instanceof Error && cause.message.includes("protected replay") ? cause.message : "This visual replay could not be opened. Try the interaction replay or reload the page."); }
      }
    })();
    return () => { ++generation.current; if (player.current === owned) player.current = null; owned?.destroy(); };
  }, [recording, loaded, prepared.error, prepared.duration, prepared.events]);
  useEffect(() => {
    if (!playing || !ready) return;
    const timer = setInterval(() => {
      const current = player.current; if (!current) return;
      try { const next = visualReplayPosition(current.getCurrentTime(), prepared.duration); atRef.current = next; setAt(next); }
      catch { pause(); setError("Playback stopped. Reload this recording before continuing."); }
    }, 100);
    const hide = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", hide);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", hide); };
  }, [playing, ready, prepared.duration, pause]);
  const seek = (position: number) => {
    pause(); const next = visualReplayPosition(position, prepared.duration);
    try { player.current?.pause(next); atRef.current = next; setAt(next); }
    catch { setError("This point could not be reconstructed. Try a nearby point or the interaction replay."); }
  };
  const toggle = () => {
    if (!ready || !player.current) return;
    if (playingRef.current) { pause(); return; }
    try {
      const position = atRef.current >= prepared.duration ? 0 : atRef.current;
      player.current.setConfig({ speed }); player.current.play(position);
      atRef.current = position; setAt(position); playingRef.current = true; setPlaying(true);
    } catch { pause(); setError("Playback could not start. Reload this recording before continuing."); }
  };
  const changeSpeed = (value: number) => {
    if (![.5, 1, 2, 4].includes(value)) return;
    setSpeed(value); try { player.current?.setConfig({ speed: value }); } catch { pause(); }
  };
  const expand = async () => {
    try {
      if (document.fullscreenElement === host.current) await document.exitFullscreen();
      else if (host.current?.requestFullscreen) await host.current.requestFullscreen();
      else throw new Error();
      setNotice("");
    } catch { setNotice("Full screen is unavailable in this browser. Playback still works below."); }
  };
  const message = prepared.error || error;
  return <div className="experience-visual-player" ref={host}>
    {message && <p className="experience-warning" role="alert">{message}</p>}
    {notice && <p className="admin-note" role="status">{notice}</p>}
    {prepared.dropped && !message && <p className="experience-warning" role="status">Some unsupported events were excluded from playback. This recording may have gaps.</p>}
    {!prepared.error && <div className="experience-preview-scroll"><div className="experience-preview-stage experience-visual-stage" style={{ width: fit.width, height: fit.height }}>
      <iframe ref={shell} src="/admin/experience/visual-preview" title="Protected visual session replay" sandbox="allow-same-origin" tabIndex={-1} inert aria-hidden="true" referrerPolicy="no-referrer" onLoad={() => setLoaded(value => value + 1)} style={{ width: size.width, height: size.height, transform: `scale(${fit.scale})` }} />
    </div></div>}
    {!ready && !message && <p className="admin-note" role="status">Preparing the recorded page…</p>}
    <div className="experience-replay-controls"><button type="button" className="button" onClick={toggle} disabled={!ready || !prepared.duration || !!message}>{playing ? "Pause" : "Play"}</button><output>{elapsed(at)} / {elapsed(prepared.duration)}</output><button type="button" className="experience-expand" onClick={() => void expand()} disabled={!ready}>{fullScreen ? "Exit full screen" : "Full screen"}</button><label>Speed<select aria-label="Speed" value={speed} onChange={event => changeSpeed(Number(event.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
    <label className="experience-scrubber">Replay position<input type="range" min="0" max={Math.max(1, prepared.duration)} value={at} step="100" disabled={!ready || !prepared.duration} onChange={event => seek(Number(event.target.value))} aria-valuetext={`${elapsed(at)} of ${elapsed(prepared.duration)}`} /></label>
    {!!clicks.length && <div className="experience-event-markers" aria-label="Jump to a recorded click">{clicks.slice(0, 30).map((click, index) => <button type="button" key={`${click.t}-${index}`} onClick={() => seek(click.t - prepared.start)} disabled={!ready}>Click {index + 1}<span>{elapsed(Math.max(0, click.t - prepared.start))}</span></button>)}</div>}
    <p className="admin-note">This shows the page snapshots and visual changes shared during the visit. Forms and private regions are masked. Scripts, forms and navigation cannot run inside playback. It is a website replay, not a video of the visitor’s device.</p>
  </div>;
}
