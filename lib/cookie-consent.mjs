/** First-party consent registry. Bump both versions before adding a new purpose or wider recording scope. */
export const COOKIE_CONSENT_COOKIE = "satinlore_consent";
export const COOKIE_CONSENT_VERSION = "cookies-2026-11-02-v2";
export const COOKIE_VALUE_VERSION = "v2";
export const COOKIE_CONSENT_MAX_AGE = 15_552_000;
export const COOKIE_CHOICE_SYNC_EVENT = "satinlore:cookie-state-synced";

export const COOKIE_CATEGORIES = Object.freeze([
  Object.freeze({id: "essential", label: "Essential", optional: false,
    description: "Keep the website secure, handle services you request and remember your cookie choices.",
    provider: "SatinLore and Cloudflare", duration: "Service security cookies follow the requested session; cookie preferences last 180 days."}),
  Object.freeze({id: "analytics", label: "Analytics", optional: true,
    description: "Count visits and waitlist-button clicks so we can understand and improve the website.",
    provider: "SatinLore", duration: "Daily protected codes expire just after UTC midnight; totals last up to 90 days."}),
  Object.freeze({id: "experience", label: "Website recordings", optional: true,
    description: "Replay how the public homepage appeared, changed and was used, with clicks, scrolling and time in view. Form contents and private areas are masked.",
    provider: "SatinLore", duration: "Visits last up to ten minutes and are kept for up to 30 days."}),
]);

/** @typedef {{version: string, analytics: boolean, experience: boolean}} CookieConsent */
/** @param {string} cookie @returns {CookieConsent | null} */
export function readCookieConsent(cookie) {
  if (typeof cookie !== "string") return null;
  const matches = cookie.split(";").map(part => part.trim()).filter(part => part.startsWith(COOKIE_CONSENT_COOKIE + "="));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(COOKIE_CONSENT_COOKIE.length + 1);
  const match = /^v2\.([01])\.([01])$/.exec(value);
  return match ? {version: COOKIE_CONSENT_VERSION, analytics: match[1] === "1", experience: match[2] === "1"} : null;
}

/** @param {string} cookie @param {"analytics" | "experience"} category */
export function cookieCategoryAllowed(cookie, category) {
  if (category !== "analytics" && category !== "experience") return false;
  return readCookieConsent(cookie)?.[category] === true;
}

/** @param {{doNotTrack?: string | null, globalPrivacyControl?: boolean}} nav */
export function browserPrivacySignalOff(nav) {
  return nav?.doNotTrack === "1" || nav?.globalPrivacyControl === true;
}

/** @param {{analytics: boolean, experience: boolean}} choice @param {boolean} secure */
export function cookieConsentCookies(choice, secure = true) {
  if (!choice || typeof choice.analytics !== "boolean" || typeof choice.experience !== "boolean") throw new TypeError("Choose each optional cookie category.");
  const suffix = `; Path=/; SameSite=Lax; Max-Age=${COOKIE_CONSENT_MAX_AGE}${secure ? "; Secure" : ""}`;
  // Compatibility preferences are written first. The versioned cookie is the
  // authoritative gate; an old on preference can never authorise these purposes.
  return [
    `satinlore_measurement=${choice.analytics ? "on" : "off"}${suffix}`,
    `satinlore_replay=${choice.experience ? "on" : "off"}${suffix}`,
    `${COOKIE_CONSENT_COOKIE}=${COOKIE_VALUE_VERSION}.${Number(choice.analytics)}.${Number(choice.experience)}${suffix}`,
  ];
}
