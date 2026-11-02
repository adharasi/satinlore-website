/** Empty, authenticated renderer document. Recorded DOM never enters the admin document. */
export const VISUAL_REPLAY_ASSETS = [
  "https://satinlore.com/images/landing/analysis.webp",
  "https://satinlore.com/images/landing/reading.webp",
  "https://satinlore.com/images/landing/rhythms.webp",
  "https://satinlore.com/images/landing/controls.webp",
  "https://satinlore.com/images/landing/beta.webp",
  "https://satinlore.com/favicon.svg",
  "https://satinlore.com/brand/satinlore-waitlist.jpg",
  "https://satinlore.com/brand/satinlore-concept.jpg",
] as const;

export const VISUAL_REPLAY_POLICY = [
  "default-src 'none'", "script-src 'none'", "style-src 'unsafe-inline'",
  `img-src ${VISUAL_REPLAY_ASSETS.join(" ")}`, "font-src 'none'", "connect-src 'none'",
  "media-src 'none'", "object-src 'none'", "frame-src 'self' about:",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'", "sandbox allow-same-origin",
].join("; ");

// Replayer chrome is deliberately local CSS with no url(), font or other fetch.
// The real page's styles are part of its filtered snapshot, inside a nested sandbox.
const SHELL = `<!doctype html><html lang="en" data-visual-replay-shell="1"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SatinLore masked visual replay</title><style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fffaf3}.replayer-wrapper{position:relative;overflow:hidden}.replayer-wrapper>iframe{display:block;border:0;pointer-events:none}.replayer-mouse{position:absolute;width:20px;height:25px;pointer-events:none;background:#552937;clip-path:polygon(0 0,100% 62%,60% 66%,80% 95%,60% 100%,40% 72%,0 100%);filter:drop-shadow(0 0 1px white);z-index:2147483640}.replayer-mouse.active{background:#bf356c}.replayer-mouse.touch-device{clip-path:none;border:3px solid #bf356c;border-radius:50%;background:#bf356c44}.replayer-mouse-tail{display:none}
</style></head><body><main id="visual-replay-root" aria-hidden="true"></main></body></html>`;

export function visualReplayShellResponse() {
  return new Response(SHELL, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Content-Security-Policy": VISUAL_REPLAY_POLICY, "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), display-capture=()",
  } });
}
