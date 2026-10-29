export const CRM_STAGES = ["new", "contacted", "invited", "testing", "completed", "blocked"] as const;
export type CrmStage = typeof CRM_STAGES[number];
export function validCrmStage(value: unknown): value is CrmStage {
  return typeof value === "string" && CRM_STAGES.includes(value as CrmStage);
}
export function validCrmNotes(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000 || /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) return null;
  return value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}
export function validCrmRecordId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}
