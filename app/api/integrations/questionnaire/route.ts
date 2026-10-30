import { database, response, runtime } from "@/lib/waitlist-server";
import { authenticateSurvey, SurveyError, surveyBindings, UPSERT_SURVEY_SQL } from "@/lib/survey";

export async function POST(request: Request) {
  try {
    const now = Date.now();
    const survey = await authenticateSurvey(request, runtime().QUESTIONNAIRE_WEBHOOK_SECRET, now);
    if (!survey) return response({ ok: true, ignored: true });
    const db = database();
    // An edited address needs a human review instead of moving another person's record.
    const previous = await db.prepare("SELECT email FROM questionnaire_responses WHERE response_id=?").bind(survey.responseId).first<{ email: string }>();
    if (previous && previous.email !== survey.email) return response({ error: "This response changed its email address. Contact the founder for review." }, 409);
    const saved = await db.prepare(UPSERT_SURVEY_SQL).bind(...surveyBindings(survey, now)).first();
    return response({ ok: true, updated: !!saved });
  } catch (error) {
    if (error instanceof SurveyError) return response({ error: error.message }, error.status);
    // No submitted answers, addresses or signatures are logged or echoed.
    return response({ error: "Questionnaire sync is temporarily unavailable." }, 503);
  }
}
