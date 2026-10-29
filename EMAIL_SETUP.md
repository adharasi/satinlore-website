# SatinLore email setup

Use the complete deployment steps in [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) first. This repository targets your own Cloudflare Workers account. Its defaults keep sending off until you configure and test it.

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

After the domain, database, Access login and secrets are configured, change `EMAIL_ENABLED` to `true` in `wrangler.jsonc`, commit, build and deploy. Keep **`WELCOME_EMAIL_ENABLED=false`**: the reader welcome campaign is deliberately deferred. Leave `SES_SESSION_TOKEN` and `SES_CONFIGURATION_SET` unset. If a default configuration set is attached to the sending identity, its specific ARN may also need to be allowed by the IAM policy.

## Verify before marketing

1. Visit `/admin` through the Access-protected hostname and sign in using the configured `ADMIN_EMAIL`.
2. Click **Check email setup**. The result must be `Email checks passed. The sender is ready.` This checks SES access, sending status, production approval and sender verification, not inbox delivery.
3. Submit a new signup using an inbox you own. Check first name/email are saved, a verification email arrives and a founder alert reaches the team inbox.
4. Open the verification email and press **Confirm my email**. An email scanner opening the link alone must not verify the entry. Check the CRM now shows the email as checked.
5. Optionally submit the toy/profile answers. Check the CRM stores them. No reader welcome email should be sent while its setting is false.
6. Use the original email's manage/leave link. Leaving deletes the matching signup and CRM notes.
7. Once the controlled test succeeds, use **Send checks to five waiting readers** and **Send five queued founder alerts** only for contacts in this database who should receive them. Real records from the original Site have not been copied by this source migration.

SES acceptance is not proof of inbox delivery. Founder alerts use a durable queue with leases and retry state; ambiguous acceptance can still result in a duplicate retry. There is no unattended retry scheduler or automatic bounce-to-CRM sync in this version.

## CRM and retention

The private dashboard stores stages and notes in D1. CSV exports can be imported into a private Google Sheet, but are snapshots, not two-way sync. Exports are not full-fidelity migration backups: they do not preserve every credential hash or queue state. Never commit exports to this public repository. Follow withdrawals in all retained copies.

Pending signups are retained for up to 30 days; confirmed ones for up to 180 days. Cleanup occurs when relevant routes run, not on an exact scheduled deletion clock. Confirmation links expire after 24 hours. Keep the privacy notice consistent with any future retention or marketing changes.

## References

- https://docs.aws.amazon.com/service-authorization/latest/reference/list_sesv2.html
- https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-email.html
- https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html
- https://developers.cloudflare.com/workers/configuration/secrets/
