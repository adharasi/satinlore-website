# SatinLore website

The SatinLore launch website, opt-in waitlist and private founder CRM. This repository prepares the existing website to run in the owner's Cloudflare account, with Amazon SES for email.

The repository is currently **public**. Source code belongs here; customer records, CSV exports, database backups, credentials and `.dev.vars` files do not.

## What is included

- Responsive launch page with first-name and email signup, adult confirmation and consent.
- Fluid desktop width, readable text sizing and mobile/tablet layouts that reflow without page zoom.
- Current website privacy notice at `/privacy` and an unlisted, no-index research notice at `/research-privacy` for questionnaire links. Published wording comes from the owner's Google Drive notices; the research page is intentionally absent from the footer and navigation.
- Inbox confirmation, optional device questionnaire, email choices and withdrawal links.
- Private founder CRM with search, stages, notes and waitlist CSV exports. Questionnaire and waitlist entries share one contact when their trimmed, lower-case email addresses match.
- Signed Google Forms bridge for the final questionnaire, with separate research, test-contact, draw and news choices. See [the bridge setup](integrations/google-forms/SETUP.md).
- SES confirmation emails and founder alerts to `team@satinlore.com`.
- Approved branded survey invitation queued five minutes after a new email verification; a once-a-minute Worker trigger processes the queue.
- Cloudflare D1 schema with append-only, tracked migrations, including `0006` for survey responses and delayed invitations.
- Cloudflare Access authentication for the founder dashboard and admin APIs.

## Landing page design (31 October 2026)

The homepage now explains the adult reading/device experience immediately, with five story panels covering automatic analysis, varied rhythms, reading pace, personal control and beta participation. Paid-testing and free-access CTAs lead to the existing waitlist. The signup section repeats the selected-tester offer (up to US$500 total for agreed completed tasks) and the questionnaire draw (a chance to win one of ten US$50 prizes). FAQs follow signup.

Homepage styles are scoped under `.landing-page`; shared CRM and account-page styles remain unchanged. `lib/WaitlistForm.tsx` retains the existing API payload, consent text, hidden anti-spam field, UTM source, busy/error states and inbox-confirmation outcome. Both `#waitlist` and the existing `#early-access` links reach signup. This design release changes no API, database migration, Google Forms bridge, scheduled email job or runtime setting.

To check the UI locally, use the local-only settings in `.dev.vars.example`, apply local migrations, and run `pnpm dev`. Review 320px/375px mobile, tablet, desktop and wide-screen layouts; test the menu, FAQ disclosures and CTA anchors. A local signup with sending disabled only creates local test data. After deployment, verify the GitHub and Cloudflare build results and inspect the public homepage. Real confirmation/inbox-delivery checks still require an inbox you control; local checks do not prove production email delivery.

The old immediate reader welcome email stays off. The approved delayed survey invitation has its own `SURVEY_EMAIL_ENABLED` switch. It does not send to people already verified before the new migration. There is no general newsletter sender, automatic Google Sheets sync, automatic SES bounce ingestion or scheduled founder-alert retry. Google Forms syncing needs its private shared secret and authorised form-bound triggers before it can run.

## Deployment status

The independent Worker is deployed at `https://satinlore.com`, with `https://launch.satinlore.com` retained for existing test links. The original six D1 migrations were applied during that launch. The survey extension adds migration `0006`; its deployment and Google authorisation must be verified separately. The owner completed the full staging and final-domain tests, including Access login, SES readiness, real inbox delivery, confirmation, CRM edits/export and withdrawal. Confirmation and founder-alert sending is enabled; the old immediate reader welcome email stays off. `www` redirects to the apex with a 301 and preserves paths and query strings. The temporary `workers.dev` hostname and version previews are disabled. The previous hosted deployment has not been deleted.

Start with [CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md) for the complete setup and launch checklist. [EMAIL_SETUP.md](EMAIL_SETUP.md) covers SES and the email flow.

## Local development

Use Node.js **22.13.0 or newer** and the package manager pinned in `package.json` (`pnpm@11.25.0`).

```sh
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Use the loopback URL printed by the development server. Local D1 state is separate from the Cloudflare production database. Admin routes require valid Cloudflare Access authentication; a local development page is not evidence of production authentication or SES delivery.

If Node.js does not include `corepack`, use `npm install --global pnpm@11.25.0` instead of the two Corepack commands. Skip that installation if `pnpm --version` already reports `11.25.0`.

## Checks and builds

```sh
pnpm test
pnpm typecheck
pnpm build
```

`pnpm build` also checks the built email-status endpoint inside the local Workers runtime. It uses a synthetic signed identity and mocked SES responses, with no production database, credentials or email sends. This catches SDK bundling failures; it does not prove real AWS access or inbox delivery.

`pnpm start` previews the built Worker locally. `pnpm deploy` applies unapplied D1 migrations and then publishes the built Worker to the Cloudflare account authenticated in Wrangler. Read the setup guide first. The deployment token needs D1 write permissions as well as Worker deployment permissions. A failed migration stops publication; this never copies customer data from another database. Database changes remain after a code rollback.

## Configuration

`wrangler.jsonc` holds the Worker name, D1 binding and non-secret deployment defaults. Replace the D1 database ID with the ID from your own Cloudflare account. Keep the binding name `DB`.

Runtime secrets belong in **Cloudflare → Workers & Pages → satinlore-website → Settings → Variables and Secrets**, not in GitHub source or build variables. Non-secret values are authoritative in `wrangler.jsonc`; edit and commit that file so a later deployment does not overwrite dashboard-only changes. The email region is **Stockholm (`eu-north-1`)**. See the setup guide for the full table.

## Working on this repository

Read [AGENTS.md](AGENTS.md) before changing authentication, consent, database migrations, email or deployment settings. Keep the brand's simple copy and the existing page design unless a change is requested.
