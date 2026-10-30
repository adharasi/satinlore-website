/** The published 30 October 2026 form. IDs are Google Forms item IDs, not entry IDs. */
export const SURVEY_FORM_ID = "1ggoboI_RfFoq9qDUGwgmgbAyCDUZQTgqKjBJpR0nfI8";
export const SURVEY_SCHEMA_VERSION = "2026-10-30";
export const SURVEY_MAX_BYTES = 100 * 1024;
export const SURVEY_RETENTION_MS = 180 * 86400000;

export const SURVEY_FIELDS = [
  { id: "614059161", key: "adult", label: "18 or older", required: true },
  { id: "724509485", key: "email", label: "Waitlist email", required: true },
  { id: "388196135", key: "country", label: "Country", required: true },
  { id: "1636108674", key: "readingFrequency", label: "Reading frequency", required: true },
  { id: "663259038", key: "readingFormat", label: "Paper or screen", required: true },
  { id: "1632549206", key: "readingDevice", label: "Main reading device", required: true },
  { id: "570311130", key: "readingPlatforms", label: "Reading apps and sites", required: true, multiple: true },
  { id: "1592794838", key: "sessionLength", label: "Reading session length", required: true },
  { id: "1648945763", key: "ageGroup", label: "Age group", required: true },
  { id: "1975676399", key: "gender", label: "Gender", required: true },
  { id: "1017609352", key: "sensitiveConsent", label: "Story and toy research consent", required: true },
  { id: "1772532114", key: "genres", label: "Story genres", multiple: true, sensitive: true },
  { id: "1053834982", key: "storyPreferences", label: "Story preferences", multiple: true, sensitive: true },
  { id: "347755655", key: "toyOwnership", label: "Toy ownership", sensitive: true },
  { id: "1980452728", key: "toyBrands", label: "Toy brands", multiple: true, sensitive: true },
  { id: "1394596703", key: "toyModels", label: "Toy models", sensitive: true },
  { id: "1999140712", key: "toyAppExperience", label: "Toy app experience", sensitive: true },
  { id: "1484064820", key: "testDevice", label: "Device for trying SatinLore" },
  { id: "2026117255", key: "wantedFeatures", label: "Wanted features" },
  { id: "143272130", key: "questionsBeforeTrying", label: "Questions before trying", multiple: true },
  { id: "1705000425", key: "interest", label: "Early access and test interest", required: true },
  { id: "1125137244", key: "testAvailability", label: "Time for tests", required: true },
  { id: "145764606", key: "contactConsent", label: "Research and test contact consent", required: true },
  { id: "540649580", key: "prizeDraw", label: "Cash draw entry", required: true },
  { id: "766322174", key: "marketingConsent", label: "News and launch offers consent", multiple: true },
] as const;
export type SurveyAnswers = Record<string, string | string[]>;
export type NormalizedSurvey = {
  email: string; responseId: string; submittedAt: number; answers: SurveyAnswers;
  sensitiveConsent: boolean; contactConsent: boolean; marketingConsent: boolean; prizeDraw: boolean;
};
export class SurveyError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.length > 5000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new SurveyError("Invalid answer");
  return value.normalize("NFC").trim();
}
export function normalizeSurvey(input: unknown, now = Date.now()): NormalizedSurvey | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SurveyError("Invalid response");
  const body = input as Record<string, unknown>;
  if (body.formId !== SURVEY_FORM_ID || body.schemaVersion !== SURVEY_SCHEMA_VERSION) throw new SurveyError("Unsupported questionnaire version");
  if (typeof body.responseId !== "string" || !/^[a-zA-Z0-9_-]{1,256}$/.test(body.responseId)) throw new SurveyError("Invalid response ID");
  const submittedAt = typeof body.submittedAt === "string" ? Date.parse(body.submittedAt) : NaN;
  if (!Number.isFinite(submittedAt) || submittedAt > now + 300000 || submittedAt < Date.UTC(2026, 0, 1)) throw new SurveyError("Invalid submission date");
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) throw new SurveyError("Invalid answers");
  const source = body.answers as Record<string, unknown>;
  // The form exits before collecting an email from anyone who answers No.
  if (source["614059161"] === "No") return null;
  if (source["614059161"] !== "Yes") throw new SurveyError("Adult confirmation required");
  const sensitiveConsent = source["1017609352"] === "Yes, I agree";
  const answers: SurveyAnswers = {};
  for (const field of SURVEY_FIELDS) {
    if ("sensitive" in field && field.sensitive && !sensitiveConsent) continue;
    const raw = source[field.id];
    if (raw === undefined || raw === null || raw === "") {
      if ("required" in field && field.required) throw new SurveyError(`Missing required answer: ${field.key}`);
      continue;
    }
    if ("multiple" in field && field.multiple) {
      if (!Array.isArray(raw) || raw.length > 30) throw new SurveyError("Invalid list answer");
      answers[field.key] = [...new Set(raw.map(text).filter(Boolean))];
      if ("required" in field && field.required && !answers[field.key].length) throw new SurveyError("Missing required answer");
    } else answers[field.key] = text(raw);
  }
  const email = String(answers.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SurveyError("Invalid email address");
  answers.email = email;
  if (!["Yes, I agree", "No, skip these questions"].includes(String(answers.sensitiveConsent))) throw new SurveyError("Invalid research consent");
  for (const key of ["contactConsent", "prizeDraw"]) if (!["Yes", "No"].includes(String(answers[key]))) throw new SurveyError("Invalid consent answer");
  if (Array.isArray(answers.storyPreferences) && answers.storyPreferences.length > 3) throw new SurveyError("Choose at most three story preferences");
  const marketing = answers.marketingConsent;
  if (marketing && (!Array.isArray(marketing) || marketing.some(value => value !== "Yes"))) throw new SurveyError("Invalid news consent");
  return { email, responseId: body.responseId, submittedAt, answers, sensitiveConsent,
    contactConsent: answers.contactConsent === "Yes", marketingConsent: Array.isArray(marketing) && marketing.includes("Yes"), prizeDraw: answers.prizeDraw === "Yes" };
}

async function boundedBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new SurveyError("Use JSON", 415);
  if (Number(request.headers.get("content-length") || 0) > SURVEY_MAX_BYTES) throw new SurveyError("Response too large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new SurveyError("Missing response");
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > SURVEY_MAX_BYTES) { await reader.cancel(); throw new SurveyError("Response too large", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export async function authenticateSurvey(request: Request, secret: string | undefined, now = Date.now()) {
  if (!secret || secret.length < 32) throw new SurveyError("Questionnaire connection is not configured", 503);
  const timestamp = request.headers.get("x-satinlore-timestamp") || "";
  const signature = request.headers.get("x-satinlore-signature") || "";
  if (!/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300000 || !/^[a-f0-9]{64}$/i.test(signature)) throw new SurveyError("Invalid signature", 401);
  const raw = await boundedBody(request);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.match(/../g)!, value => parseInt(value, 16));
  if (!await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(`${timestamp}.${raw}`))) throw new SurveyError("Invalid signature", 401);
  try { return normalizeSurvey(JSON.parse(raw), now); }
  catch (error) { if (error instanceof SurveyError) throw error; throw new SurveyError("Invalid JSON response"); }
}

export const UPSERT_SURVEY_SQL = `INSERT INTO questionnaire_responses
(email,response_id,submitted_at,received_at,schema_version,answers_json,sensitive_consent,contact_consent,marketing_consent,prize_draw,expires_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?)
ON CONFLICT(email) DO UPDATE SET response_id=excluded.response_id,submitted_at=excluded.submitted_at,received_at=excluded.received_at,schema_version=excluded.schema_version,answers_json=excluded.answers_json,sensitive_consent=excluded.sensitive_consent,contact_consent=excluded.contact_consent,marketing_consent=excluded.marketing_consent,prize_draw=excluded.prize_draw,expires_at=excluded.expires_at
WHERE excluded.submitted_at > questionnaire_responses.submitted_at
RETURNING email`;
export function surveyBindings(survey: NormalizedSurvey, receivedAt: number) {
  return [survey.email, survey.responseId, survey.submittedAt, receivedAt, SURVEY_SCHEMA_VERSION, JSON.stringify(survey.answers), Number(survey.sensitiveConsent), Number(survey.contactConsent), Number(survey.marketingConsent), Number(survey.prizeDraw), receivedAt + SURVEY_RETENTION_MS];
}
