/** One founder-only row per address, whether it came from the waitlist, survey, or both. */
export const CRM_CONTACTS_SQL = `WITH ranked AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY email ORDER BY email_verified DESC,confirmed_at DESC,created_at DESC,id DESC) AS rank FROM waitlist WHERE expires_at > ?
), addresses AS (
 SELECT email FROM ranked WHERE rank=1 UNION SELECT email FROM questionnaire_responses WHERE expires_at > ?
)
SELECT COALESCE(w.id,q.response_id) id,w.id waitlist_id,w.first_name,a.email,
COALESCE(w.email_verified,0) email_verified,COALESCE(w.email_state,'survey_only') email_state,
COALESCE(w.founder_alert_state,'not_applicable') founder_alert_state,w.founder_notified_at,
w.model,w.phone,w.interest,COALESCE(w.source,'questionnaire') source,COALESCE(w.newsletter,0) newsletter,
w.consent_version,COALESCE(w.created_at,q.received_at) created_at,w.confirmed_at,
COALESCE(c.stage,'new') stage,COALESCE(c.notes,'') notes,c.updated_at,
q.response_id survey_response_id,q.submitted_at survey_submitted_at,q.received_at survey_received_at,
q.schema_version survey_schema_version,q.answers_json survey_answers_json,q.sensitive_consent survey_sensitive_consent,
q.contact_consent survey_contact_consent,q.marketing_consent survey_marketing_consent,q.prize_draw survey_prize_draw
FROM addresses a LEFT JOIN ranked w ON w.email=a.email AND w.rank=1
LEFT JOIN questionnaire_responses q ON q.email=a.email AND q.expires_at > ?
LEFT JOIN crm_contacts c ON c.email=a.email
ORDER BY MAX(COALESCE(w.created_at,0),COALESCE(q.received_at,0)) DESC LIMIT 250`;
