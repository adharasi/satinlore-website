# Connect the final SatinLore questionnaire

This bridge copies responses from the final Google Form into the private SatinLore founder CRM. It uses the existing `team@satinlore.com` Google account, the existing Worker and D1 database. No extra Workspace user, public spreadsheet, paid CRM or Apps Script web-app deployment is needed.

Source code alone does not activate syncing. The Worker migration, matching private secret and authorised Google triggers must all be in place.

## What the CRM records

The current mapping in `lib/survey.ts` is version `2026-10-30`. It uses Google Forms **item IDs**, not the public `entry.*` IDs or question titles. It records:

- Email, adult confirmation, country, age group and gender.
- Reading frequency, paper/screen habits, device, reading apps/sites and session length.
- Optional story genres/preferences and toy ownership, brands, models and app experience, only with explicit story-and-toy research consent.
- Device for testing, requested features, questions before trying, early-access/test interest and availability.
- Separate choices for sensitive research, research/test contact, prize-draw entry, and news/launch offers.
- Form response ID, form version, submission/receipt times and retention expiry.

Matching trims surrounding spaces and lowercases email addresses. It does not remove Gmail dots or plus tags. A matching waitlist and survey email displays as one contact, including when the survey arrives first. A survey response does not verify an address, join the person to the waitlist or grant waitlist marketing consent. Only the waitlist confirmation flow verifies its address.

The CRM keeps the latest submitted response per email. Replayed or older submissions do not overwrite it. If an existing response ID changes to a different email, the bridge stops that response for founder review rather than silently moving someone else's record. The draw flag is one field per contact; repeated form submissions do not create extra CRM draw entries.

## 1. Deploy the Worker extension

1. Review migration `0006` and the source changes on `main`.
2. Run the required tests, typecheck and build.
3. Deploy with `pnpm deploy`, or let the connected production Cloudflare Build run it. The script applies unapplied tracked migrations before publishing. Its Cloudflare credentials need D1 write access as well as Worker deployment access.
4. Confirm the build and deployment succeed. A local build is not evidence of a live connection.
5. Keep `/admin` and `/api/admin/*` behind the existing founder Access application. The bridge URL `/api/integrations/questionnaire` must be reachable without Access login; it authenticates requests using a signed body instead.

Do not replay the old migration SQL files manually. Do not change the D1 binding or point a preview at production.

## 2. Add the same private secret on both sides

Generate a separate random value in a password manager, preferably at least 32 random bytes represented as 64 hexadecimal characters. Do not reuse an AWS key, the Google password or `ABUSE_SALT`.

1. In **Cloudflare → Workers & Pages → satinlore-website → Settings → Variables and Secrets**, add a **Secret** named `QUESTIONNAIRE_WEBHOOK_SECRET`.
2. Enter the random value privately and deploy that runtime change. Do not put it in Build variables, `wrangler.jsonc`, GitHub, a Google Sheet or chat.
3. Open the [questionnaire editor](https://docs.google.com/forms/d/1ggoboI_RfFoq9qDUGwgmgbAyCDUZQTgqKjBJpR0nfI8/edit) using `team@satinlore.com`.
4. Choose **More → Apps Script**. This creates or opens a script bound to this form.
5. Name the project **SatinLore questionnaire CRM**.
6. Open **Project settings → Script properties → Add script property**.
7. Name it `QUESTIONNAIRE_WEBHOOK_SECRET` and enter the exact same value. Save it.

Keep the script and its properties private. Anyone with editor access to the script can access its properties, so do not widen its sharing. Rotating the shared secret requires updating both locations together.

## 3. Save the script and authorise its triggers

1. In the bound Apps Script editor, open `Code.gs`.
2. Replace the default example with this repository's [Code.gs](Code.gs). Save it.
3. Review its fixed form ID, endpoint and schema version. The endpoint must be `https://satinlore.com/api/integrations/questionnaire`.
4. In the function dropdown, choose **installSatinLoreBridge**, then **Run**.
5. Complete Google's authorisation using the form owner's account. The script needs access to the bound form's responses, permission to call the SatinLore endpoint, and permission to manage its own triggers. Review any unexpected scope before granting it. Do not bypass a browser security warning.
6. Check the execution finishes successfully. It creates one form-submit trigger and one hourly retry trigger. Running installation again does not intentionally create duplicates for the same handler under that account.
7. Open **Triggers** and confirm both `onSatinLoreFormSubmit` and `retrySatinLoreResponses` exist. Keep trigger-failure notifications enabled.

Do not choose **Deploy → Web app**. The form-submit trigger runs privately under the account that installs it. Do not install the same triggers from several accounts, since each account can create its own triggers.

## 4. Import responses to the final form

1. Choose **syncExistingSatinLoreResponses** in the function dropdown and run it once.
2. Check **Executions** for success. Logs contain counts/status only, not email addresses, answers, signatures or private links.
3. Open the Access-protected SatinLore `/admin` and check the questionnaire count and a known response.

This function considers responses submitted on or after **30 October 2026 UTC** and expects the final question set. It does not map legacy questionnaires automatically. A missing required answer or changed schema stops sync for review; do not weaken validation to force an incompatible old response through.

The hourly retry checks a window around its stored cursor and relies on server-side idempotency. If an outage lasts longer than that window, or sync fails on a particular response, review the execution error and rerun the explicit import after fixing it. Timeouts can require another run. A generic success message is not proof that every historical response was imported: reconcile known counts and dates.

## 5. Test the whole flow with an inbox you own

1. Join the waitlist with a controlled email and confirm it. Verify the founder CRM marks the address checked.
2. Confirm the approved branded survey email arrives only after five minutes, normally at the next one-minute Worker tick. Check the questionnaire and private email-choice links.
3. Fill in the real questionnaire with that same email. Use synthetic, non-sensitive answers for integration testing.
4. Confirm one CRM contact shows both waitlist and questionnaire sources, the submission date and separate consent fields.
5. Test a survey-only controlled address: it should appear as a survey contact without verified waitlist status. Joining and confirming later should merge into that contact.
6. Check that a response declining story/toy consent has no story/toy details stored in the CRM. News, test contact and draw choices must remain independent.
7. Confirm a repeated sync does not add a second contact or extra draw entry.
8. Confirm signed-request failures do not disclose answers. Do not test with real customer data or paste private requests into support tools.

Google trigger timing, quotas, Worker load and SES delivery can cause delays. Inspect Apps Script executions and the private CRM rather than assuming instant delivery. The bridge never sends survey answers in founder emails or general waitlist exports.

## Privacy and day-to-day handling

The primary CRM is the private founder dashboard backed by D1. Google Forms retains its original response copy; an optional linked Sheet or CSV is another copy, not the primary sync mechanism. Keep every copy private and limit access to people who need the data.

Questionnaire records have a 180-day application expiry from receipt. The minute cron and relevant route cleanup remove expired D1 records; it is not a precise deletion clock and it does not delete Google's original response. Maintain a retention review for Forms and any exports.

Leaving the waitlist removes its records and pending invitation, while a separate survey or valid draw entry follows its own choices. Research withdrawal, draw withdrawal and marketing opt-out are separate. A stage change does not itself delete sensitive answers or withdraw consent. Handle authenticated withdrawal requests in the CRM and in Google Forms/any linked Sheet or retained export; keep only the limited record justified for a separate purpose. Do not reimport a withdrawn response from a retained source copy.

If you edit the live questionnaire, compare the item IDs, required fields, choices and consent text against `lib/survey.ts` and `Code.gs`. Version the mapping and test it before accepting a changed schema. Changing a question title alone does not update the code's meaning.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| HTTP 503 during sync | Worker deployed, migration applied, correct D1 binding and runtime secret configured |
| HTTP 401 | The two secret values match exactly; request timestamp and signature are present |
| HTTP 400 | Final form ID/version and required item IDs still match; inspect the form schema without logging respondent answers |
| HTTP 409 | A previously imported form response changed its email; review and correct the contact deliberately |
| No execution on a new response | Correct form-bound project, installed form-submit trigger, owner authorisation still valid |
| Email not received after five minutes | New verification, not an existing verified contact; cron registered; SES ready; sender enabled; not blocked/expired/withdrawn; inspect queue state privately |
| Build fails during D1 migration | Build token has D1 write access, correct account/database and unapplied tracked migrations; do not publish code manually ahead of its schema |

## Official references

- Form responses: https://developers.google.com/apps-script/reference/forms/form#getResponses(Date)
- Installable triggers: https://developers.google.com/apps-script/guides/triggers/installable
- Script properties: https://developers.google.com/apps-script/guides/properties
- External requests: https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/


New submissions sync automatically. Edits to an older response may need founder review because Apps Script does not expose a separate revision time; equal or older timestamps never overwrite newer stored answers. Responses rejected with HTTP 400/409/422 are marked for review in Script properties using an opaque hash, and do not block later responses. Correct the form/schema mismatch or edited address deliberately, then rerun the import. Authentication and temporary service failures remain retryable and stop the pass, preserving the cursor.

Marketing opt-outs use a separate durable keyed-address record. Both waitlist and questionnaire news choices are displayed as suppressed until the reader opts back in through a verified private management link. Questionnaire replays cannot undo that opt-out. Keep the ABUSE_SALT stable; rotating it requires migrating these suppression hashes deliberately.
