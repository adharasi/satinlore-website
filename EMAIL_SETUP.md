# SatinLore email setup

Use the complete deployment steps in [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) first. This repository targets your own Cloudflare Workers account. The owner verified SES readiness and the complete signup, inbox delivery, confirmation, CRM and withdrawal flow on staging and the final domain. The current deployment enables confirmation and founder-alert emails with links to `https://satinlore.com`. The old immediate reader welcome email remains off. The approved branded survey invitation is a separate delayed flow described below. Local development examples keep all sending off.

## Confirm the SES account

Use the AWS account owning `satinlore.com` in **Europe (Stockholm), `eu-north-1`**. Production access and verified DKIM were observed in that region during setup. Recheck current identity status before sending. Preserve the existing Google Workspace mailbox `team@satinlore.com`; no additional user is required.

Enable email feedback forwarding on the sending identity. Enable account-level suppression for **both bounces and complaints**. Review forwarded feedback in the team inbox. A permanent bounce or spam complaint should also set that reader's CRM stage to Blocked. AWS suppression is not currently synced automatically to this CRM.

Keep exactly one DMARC TXT record at `_dmarc`. Do not weaken an existing policy or replace Google Workspace's MX/SPF/DKIM records. The custom MAIL FROM subdomain is `bounce.satinlore.com`; copy its MX/TXT values from the Stockholm SES identity. These records are independent of the website's domain records.

## Limited IAM permissions

Create a dedicated application IAM user with no console sign-in. Attach the following custom policy after replacing **YOUR_ACCOUNT_ID** with the 12-digit account ID in your verified identity ARN. No AdministratorAccess or AmazonSESFullAccess is required.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ses:GetAccount",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "ses:GetEmailIdentity",
      "Resource": [
        "arn:aws:ses:eu-north-1:YOUR_ACCOUNT_ID:identity/satinlore.com",
        "arn:aws:ses:eu-north-1:YOUR_ACCOUNT_ID:identity/team@satinlore.com"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": [
        "arn:aws:ses:eu-north-1:YOUR_ACCOUNT_ID:identity/satinlore.com",
        "arn:aws:ses:eu-north-1:YOUR_ACCOUNT_ID:identity/team@satinlore.com"
      ],
      "Condition": {
        "StringEquals": { "ses:FromAddress": "team@satinlore.com" }
      }
    }
  ]
}
```

Create an IAM API access key for that user (not SES SMTP credentials). Save it in a password manager. In Cloudflare **Workers & Pages → satinlore-website → Settings → Variables and Secrets**, add these as **Secret** values:

- `SES_ACCESS_KEY_ID`
- `SES_SECRET_ACCESS_KEY`
- `ABUSE_SALT` (separate random string, at least 32 random bytes)

Never put credentials into chat, GitHub source, build variables, the CRM, screenshots or an exported contact sheet. No AWS keys were included in this migration.

Non-secret runtime settings are maintained in `wrangler.jsonc`. Keep `SES_REGION=eu-north-1`, `SES_FROM_EMAIL=Satinlore <team@satinlore.com>`, and `FOUNDER_NOTIFICATION_EMAIL=team@satinlore.com`. Set `PUBLIC_SITE_ORIGIN` to the HTTPS origin actually receiving reader visits. Requests cannot change the origin used in emailed links.

After the domain, database, Access login and secrets are configured, change `EMAIL_ENABLED` to `true` in `wrangler.jsonc`, commit, build and deploy. Keep **`WELCOME_EMAIL_ENABLED=false`** for the old immediate welcome email. The approved survey invitation uses **`SURVEY_EMAIL_ENABLED=true`** in production and the Worker cron trigger; local development leaves it off. Leave `SES_SESSION_TOKEN` and `SES_CONFIGURATION_SET` unset. If a default configuration set is attached to the sending identity, its specific ARN may also need to be allowed by the IAM policy.

## Verify before marketing

The build resolves the AWS SDK consistently for the web/Workers runtime. `pnpm build` runs the built owner-only email-status endpoint in the local Workers runtime with a synthetic signed identity and mocked AWS responses. This catches client construction and response-reading failures before deployment; it does not test your real IAM credentials, SES account or inbox delivery.

If **Check email setup** fails, the owner-only response shows a fixed diagnostic without raw AWS errors or credential values. An access-denied message means the app IAM user needs the policy above, including `ses:GetAccount` and `ses:GetEmailIdentity`, not just sending access. A credentials-rejected message means the two runtime secrets must come from the same active IAM API key; SES SMTP credentials do not work with this API client. A timeout message calls for a later retry. Unknown failures remain generic. Do not paste credentials or private email links into support messages.

1. Visit `/admin` through the Access-protected hostname and sign in using the configured `ADMIN_EMAIL`.
2. Click **Check email setup**. The result must be `Email checks passed. The sender is ready.` This checks SES access, sending status, production approval and sender verification, not inbox delivery.
3. Submit a new signup using an inbox you own. Check first name/email are saved, a verification email arrives and a founder alert reaches the team inbox.
4. Open the verification email and press **Confirm my email**. An email scanner opening the link alone must not verify the entry. Check the CRM now shows the email as checked.
5. After a new verification, check the survey invitation does not arrive before five minutes and normally arrives on the next one-minute tick (roughly five to six minutes). Check its styling, questionnaire button and private choices link in a real inbox. No separate immediate welcome email should arrive.
6. Complete the questionnaire using the same email after the [Google Forms bridge](integrations/google-forms/SETUP.md) is authorised. Check the founder CRM shows one contact with both sources and separate consent fields.
7. Use the original and delayed email's manage/leave links. Leaving removes matching waitlist records and their pending invitations. A separate survey/draw record remains subject to its own choices; contact the team for research withdrawal or draw withdrawal. Notes remain if a survey contact still exists.
8. Once the controlled test succeeds, use **Send checks to five waiting readers** and **Send five queued founder alerts** only for contacts in this database who should receive them. Real records from the original Site have not been copied by this source migration.

SES acceptance is not proof of inbox delivery. Founder alerts use a durable queue with leases and retry state; ambiguous acceptance can still result in a duplicate retry. Founder alerts still require deliberate retry batches. The survey invitation has its own scheduled, bounded retry queue. Neither flow is an exactly-once delivery guarantee, and there is no automatic bounce-to-CRM sync.

## Five-minute survey invitation

Migration `0006` creates a D1 trigger that queues an invitation when a waitlist record first changes from unverified to verified. The due time is the confirmation time plus five minutes. Queueing is atomic with verification; reopening the confirmation page does not add another invitation. Existing verified people are not backfilled.

The Worker runs once a minute, processing up to ten due jobs per tick. Normal delivery begins at five to six minutes, but load, SES readiness, quotas or failures can delay it. A blocked contact, expired signup or person who leaves is skipped. A per-email queue key and conditional claims prevent normal duplicate sends. Temporary failures retry at bounded intervals, with at most five attempts. An ambiguous network failure after SES acceptance can still cause a duplicate; review failed jobs before any manual action.

The delayed email uses the approved SatinLore HTML and a plain-text alternative. Story and toy questions are described as optional. Its private manage link is recreated with a keyed hash and stored only as a hash in D1; raw link credentials are never stored in the queue. Keep `ABUSE_SALT` stable: rotating it can invalidate links that have not yet been sent or affect a retried send.

The required runtime settings are `EMAIL_ENABLED=true`, `SURVEY_EMAIL_ENABLED=true`, SES readiness, existing SES secrets and `ABUSE_SALT`. Keep `WELCOME_EMAIL_ENABLED=false`. A source build alone does not prove cron registration or inbox delivery; verify both after deployment. Do not create a separate ChatGPT automation for this customer flow.

## CRM and retention

The private dashboard stores stages and notes in D1. The Google Forms bridge adds questionnaire responses to that same private dashboard; a matching email displays one contact. A survey-only email is not marked verified and is not automatically joined to the waitlist. Research contact, optional sensitive research, news and prize entry are separate fields. Research answers must not be used as general marketing consent or included in a marketing export. CSV exports can be imported into a private Google Sheet, but are snapshots, not two-way sync. Exports are not full-fidelity migration backups: they do not preserve every credential hash or queue state. Never commit exports to this public repository. Follow withdrawals in all retained copies.

Pending signups are retained for up to 30 days; confirmed ones for up to 180 days. Questionnaire records expire after 180 days from receipt. Cleanup runs on the one-minute Worker schedule and when relevant routes run. Failures or scheduling delays can delay deletion; Google Forms retains its own separate copy: withdrawal and retention work must also cover that copy and any private exports. Ending waitlist updates does not automatically withdraw a valid draw entry or research consent. Confirmation links expire after 24 hours. Keep the privacy notice consistent with any future retention or marketing changes.

## References

- https://docs.aws.amazon.com/service-authorization/latest/reference/list_sesv2.html
- https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-email.html
- https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html
- https://developers.cloudflare.com/workers/configuration/secrets/
