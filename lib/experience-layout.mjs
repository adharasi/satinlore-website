export const LEGACY_LAYOUT = "landing-20261102";
export const LAUNCH_LAYOUT = "landing-after-hours";

/** @typedef {typeof LEGACY_LAYOUT | typeof LAUNCH_LAYOUT} ExperienceLayout */

export const LEGACY_SECTIONS = /** @type {const} */ (["hero", "steps", "experience", "reading", "controls", "beta", "waitlist", "faq", "footer"]);
export const LAUNCH_SECTIONS = /** @type {const} */ (["hero", "steps", "guides", "controls", "faq", "pricing", "footer"]);
export const EXPERIENCE_SECTIONS = /** @type {const} */ ([...LEGACY_SECTIONS, "guides", "pricing"]);

/** @param {unknown} value @returns {value is ExperienceLayout} */
export function validExperienceLayout(value) {
  return value === LEGACY_LAYOUT || value === LAUNCH_LAYOUT;
}
