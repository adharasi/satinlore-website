export const CONSENT_VERSION = "2026-10-28-v2";
export const CONSENT_TEXT = "I agree that Satinlore may keep my name and email for this adult product. Send me early access and launch news. I can leave at any time.";
export const NEWSLETTER_TEXT = "Also send me tips and offers from Satinlore.";
export function validToyModel(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 120 || /[<>\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) return null;
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}
export const PHONES = ["iPhone", "Android", "Other"] as const;
export const INTERESTS = ["freebeta", "paidlater", "updates"] as const;
export function validEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z]{2,}$/.test(email) ? email : null;
}
export function validToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
export function validFirstName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFC").trim().replace(/\s+/g, " ");
  return /^[\p{L}\p{M}][\p{L}\p{M} '\u2019\-]{0,59}$/u.test(name) ? name : null;
}
export function sourceName(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : "direct";
}
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
