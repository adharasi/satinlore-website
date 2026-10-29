# Deploy the SatinLore website to Cloudflare

This guide sets up the website in your own Cloudflare account. Your domain stays registered at GoDaddy. Your existing Google Workspace inbox stays `team@satinlore.com`, and Amazon SES sends app emails from Stockholm (`eu-north-1`). No extra Workspace user is needed.

Preparing the repository is not a live deployment. The original hosted website and its database are separate and are not changed by these instructions.

## 1. Prepare the project

1. Sign in to the Cloudflare account that will own SatinLore's website and database.
2. Clone `https://github.com/adharasi/satinlore-website.git` to your computer and open it in VS Code.
3. Install Node.js 22.13.0 or newer. Use Node 22 for the Cloudflare build environment as well.
4. From the repository folder, run:

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
pnpm exec wrangler login
```

The last command opens Cloudflare's browser sign-in. Complete that yourself; no Cloudflare password or API token belongs in chat.

The repository is public. Do not upload real CRM records, backups or secret files to it. GitHub's source visibility does not make the deployed CRM public: access is enforced separately by the app and Cloudflare Access.

## 2. Create the new D1 database

From the same terminal, run:

```sh
pnpm db:create
```

This creates a database named `satinlore-waitlist` in your authenticated Cloudflare account. You can also create it in **Cloudflare → Storage & databases → D1 → Create database**.

Copy the returned database ID into `wrangler.jsonc` at `d1_databases[0].database_id`. Keep:

- Worker name: `satinlore-website`
- Binding: `DB`
- Database name: `satinlore-waitlist`
- Migration directory: `drizzle`

A D1 database ID is configuration, not an access credential, so it can be committed. Never put a database export into the repository.

Apply the existing schema to this **new** database:

```sh
pnpm db:migrate:remote
```

Check the account and database named in the prompt before confirming. The migration command applies unapplied migrations using D1's tracking table. It is not a command to copy the old website's records.

For local development only, use:

```sh
pnpm db:migrate:local
```

Do not run the old SQL files individually against an already-migrated database. Future schema changes should add a migration, not edit the six existing ones.

## 3. Build and create the Worker

Keep `EMAIL_ENABLED` and `WELCOME_EMAIL_ENABLED` set to `false` initially. Run:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm deploy
```

This publishes the Worker into your own account. It does not connect the domain or configure Access. The initial configuration enables a temporary `workers.dev` hostname for public-page testing; its admin routes still deny access until Access is correctly configured. Version preview URLs are disabled. The deploy script checks that the placeholder D1 database ID has been replaced. Run `pnpm build` before each `pnpm deploy`, because deployment uploads the built output.

Do not begin marketing until the remaining steps and the final signup test pass.

## 4. Configure runtime values and enter secrets privately

Open **Cloudflare → Workers & Pages → satinlore-website → Settings → Variables and Secrets**.

Use **Add → Secret** for these values:

| Name | Value |
| --- | --- |
| `SES_ACCESS_KEY_ID` | The dedicated AWS IAM access key ID |
| `SES_SECRET_ACCESS_KEY` | Its matching AWS secret access key |
| `ABUSE_SALT` | A new long random value generated in your password manager, at least 32 random bytes |

**Keep non-secret runtime values in the `vars` section of `wrangler.jsonc`.** Edit that file, then commit it to GitHub. The following names and values are safe configuration, not passwords:

| Name | Value |
| --- | --- |
| `SES_REGION` | `eu-north-1` |
| `SES_FROM_EMAIL` | `Satinlore <team@satinlore.com>` |
| `FOUNDER_NOTIFICATION_EMAIL` | `team@satinlore.com` |
| `PUBLIC_SITE_ORIGIN` | `https://satinlore.com` for the final launch |
| `EMAIL_ENABLED` | `false` until you are ready for the email test |
| `WELCOME_EMAIL_ENABLED` | `false` |
| `ADMIN_EMAIL` | The single email address you will use to sign in to the founder dashboard |
| `ACCESS_TEAM_DOMAIN` | Your Access team hostname, such as `your-team.cloudflareaccess.com`, without `https://` or a trailing slash |
| `ACCESS_AUD` | The Application Audience (AUD) tag from the Access application in step 5 |

The email credentials are IAM API credentials, not SES SMTP credentials or your Google password. Leave `SES_SESSION_TOKEN` and `SES_CONFIGURATION_SET` unset for the simple launch setup.

Runtime secrets are different from **Build variables and secrets**. A build-only value is not automatically available to the running Worker. Non-secret variables in `wrangler.jsonc` are the source of truth: a deployment can overwrite dashboard edits to those values. Edit and commit the file rather than setting conflicting dashboard variables.

For secrets entered in the dashboard, select Deploy to apply them. For changes to `wrangler.jsonc`, run `pnpm build` and `pnpm deploy`, or push them after GitHub builds are connected. Never put credentials in a `NEXT_PUBLIC_` variable, the source code, the CRM, a Google Sheet or a screenshot. Existing Site secrets are not copied to this Worker automatically.

## 5. Set up the founder's Cloudflare Access login

The migrated app uses Cloudflare Access instead of the previous hosting platform's ChatGPT sign-in. `ADMIN_EMAIL` is the approved founder address, not a new Google Workspace subscription.

1. Open **Cloudflare Zero Trust** and finish its account/team setup if needed. Note your team hostname (`your-team.cloudflareaccess.com`).
2. Configure a login method. If you want a code sent to your existing mailbox, add **One-time PIN** under the Access authentication/login-method settings. It is not always enabled by default.
3. Under **Access controls → Applications**, add a **Self-hosted** application named `SatinLore founder`.
4. Within the **same application**, add public-hostname/path entries covering the exact admin page and its API routes on your chosen website hostname:
   - `satinlore.com/admin` and its descendants.
   - `satinlore.com/api/admin/*`.
5. Add an **Allow** policy for the exact email in `ADMIN_EMAIL`. Do not use an everyone policy or allow the whole public website.
6. Copy the application's **Application Audience (AUD)** tag into `ACCESS_AUD` in `wrangler.jsonc`. Use one application for both path groups so the page and API use the same audience.
7. Set `ACCESS_TEAM_DOMAIN` in that file, commit the change, rebuild and deploy.

If the dashboard requires separate entries for `/admin` and `/admin/*`, add both. Repeat protection for any additional hostname you deliberately expose. A temporary test hostname needs matching Access entries and the corresponding public origin in the app configuration. Add these to the same Access application where possible.

The public launch page, confirmation and email-choice links must remain available without founder login. Protect only the founder page and admin API paths.

The app independently validates Access's signed JWT, configured issuer, audience, expiry and founder email. Missing settings or invalid identity must deny access. Merely adding an email header is not authentication. The temporary `workers.dev` hostname starts enabled, with the same application-level JWT checks on every admin request. It can show the public page without Access while its admin page remains unavailable. To test the admin there, protect that hostname with Access and configure its origin deliberately; do not bypass authentication. After the final custom-domain test, set `workers_dev` to `false` in `wrangler.jsonc`, rebuild and deploy. Keep version preview URLs disabled unless separately isolated and protected. A direct alternative hostname must never expose the CRM.

## 6. Plan the domain and database cutover

There are two separate migrations: **code** and **customer data**. This repository migrates the code. The old hosted database is not included.

Before switching where signups go:

- Check whether the old website has any real records.
- If it does, export a private, complete database backup through the old hosting platform's supported controls. A CRM CSV omits verification and management token hashes and is not a complete migration source.
- Map and securely import the waitlist, CRM, consent and contact records, preserving verification state, consent versions/timestamps, token hashes, expiry and alert state. Reconcile counts and test before accepting signups on the new database.
- Preserve any verification/management links already emailed from the old hostname. Do not disable the old service until those links have a tested transition or expiry plan.
- During the final cutover, stop or reconcile old writes. Running two active signup forms against separate databases can split the waitlist and duplicate notifications.

Keep real exports and backups outside Git, including this public repository. If the old database is empty, confirm that and start with the new schema; no customer-data import is needed.

## 7. Move DNS management and attach the domain

For the usual Cloudflare Free/Pro setup, add `satinlore.com` as a Cloudflare zone and select the appropriate plan. This changes DNS management; it does **not** transfer registration away from GoDaddy.

Before changing nameservers, compare Cloudflare's imported DNS records with GoDaddy's complete record list. Automatic import is not a substitute for checking:

- All Google Workspace MX records at `@`.
- The root SPF record and Google's DKIM selector.
- All three SES DKIM CNAME records.
- `bounce` MX with priority `10`, pointing to the Stockholm feedback host AWS supplied.
- `bounce` TXT SPF record.
- Exactly one valid `_dmarc` TXT record. Keep the intended existing policy; do not add a second record or silently weaken it.
- Any other active verification or service records.

Keep email-related CNAME records DNS-only. Preserve email MX/TXT values. Do not replace Google's root MX records with SES bounce records.

After the record check, update the domain's nameservers at GoDaddy to the pair Cloudflare assigns. Follow the providers' DNSSEC instructions if DNSSEC is enabled, so stale delegation signing records do not break DNS. Wait for the Cloudflare zone to become Active.

In **Workers & Pages → satinlore-website → Settings → Domains & Routes → Add → Custom domain**, attach `satinlore.com`. Follow Cloudflare's instructions to resolve any conflicting old website record for that hostname. Add a redirect from `www.satinlore.com` to the apex if you want both to work, and verify it; adding the apex alone does not configure `www`.

Do not reuse the old hosted Site's A records or validation tokens for this independent Worker. Keep a private record of the old routing values for rollback. No DNS change is made merely by committing this repository.

A useful rollout is to test first on a dedicated hostname such as `launch.satinlore.com`, with Access configured for its admin paths and `PUBLIC_SITE_ORIGIN` changed to that hostname. After the tests pass, attach the apex and restore `PUBLIC_SITE_ORIGIN=https://satinlore.com`. Any links sent during staging remain tied to their staging origin, so use only your own test inboxes there.

## 8. Turn on SES and test the full flow

1. Confirm the SES identity and DKIM are verified and production access is approved in Stockholm (`eu-north-1`). Keep feedback forwarding and account suppression for bounces/complaints enabled.
2. Change `EMAIL_ENABLED` to `"true"` in `wrangler.jsonc`, commit, rebuild and deploy. Keep `WELCOME_EMAIL_ENABLED="false"`. Dashboard-only edits to these variables will not survive a later source deployment.
3. Open `/admin`, pass Cloudflare Access using the approved email, and click **Check email setup**.
4. Require the message **Email checks passed. The sender is ready.** This checks configuration, AWS access, production status and sender verification. It does not prove delivery.
5. In a separate private/incognito window, confirm the public launch page opens without admin login.
6. Submit your own inbox, name and consent. Confirm both the verification email and the founder alert actually arrive, checking spam as well.
7. Open the verification link and press **Confirm my email**. Merely opening the page must not verify it.
8. In the CRM, confirm the checked state, optional answers, stage/notes edits and CSV export.
9. Confirm no separate reader welcome email arrives.
10. Use the original email's choices/leave link after confirmation. Test changing choices and leaving; verify the test record and CRM notes are removed.
11. Check a logged-out browser cannot open the dashboard or export/API endpoints. Repeat against every reachable alternative hostname.
12. Repeat the full signup on the final `https://satinlore.com` domain and verify email links point to it.

Only after this test should you process old queued entries with **Send checks to five waiting readers** or **Send five queued founder alerts**. Inspect failures and repeat batches deliberately; no unattended retry schedule is installed. Review SES bounce/complaint alerts and mark affected CRM records Blocked. SES acceptance is not proof of inbox delivery.

## 9. Connect automatic GitHub deployments

Once the first deployment works, open **Workers & Pages → satinlore-website → Settings → Builds → Connect** and connect `adharasi/satinlore-website`.

Use:

| Field | Setting |
| --- | --- |
| Project type | Worker, not a static Pages site |
| Production branch | `main` |
| Root directory | Repository root |
| Node version | `22` |
| Build command | `pnpm build` |
| Deploy command | `pnpm deploy` |

The Worker name in Cloudflare must match the name in `wrangler.jsonc`. Disable automatic non-production branch/preview builds initially. Do not let a preview use the production D1 database or send real emails; provision separate bindings and credentials before enabling preview environments.

Push the real D1 database ID and non-secret deployment settings to the repository. Keep `workers_dev=false` after the custom-domain handoff and `preview_urls=false` unless deliberately enabling a separate safe environment. Do not commit runtime secrets. D1 schema changes are a separate reviewed migration step; avoid applying production migrations from every arbitrary branch.

## After launch

- Keep the old deployment available until the data and link transition has been checked.
- Use the new `/admin` as the primary CRM. Google Sheets remains an optional private CSV snapshot, with no live two-way sync.
- Verify runtime defaults before every release. Re-run relevant tests and a real signup after changes to auth, email, forms or domains.
- Keep feedback alerts under review and remove withdrawn readers from any exported working copies.
- Back up retained data privately and test a restore process. A code rollback does not roll back a database migration or recover deleted records.

## Official references

- Workers Git builds: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Worker runtime secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Access path protection: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- Access JWT validation: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- One-time PIN: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- Worker custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
