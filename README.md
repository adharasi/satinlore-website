# SatinLore website

The SatinLore launch website, opt-in waitlist and private founder CRM. This repository prepares the existing website to run in the owner's Cloudflare account, with Amazon SES for email.

The repository is currently **public**. Source code belongs here; customer records, CSV exports, database backups, credentials and `.dev.vars` files do not.

## What is included

- Responsive launch page with first-name and email signup, adult confirmation and consent.
- Fluid desktop width, readable text sizing and mobile/tablet layouts that reflow without page zoom.
- Current website privacy notice at `/privacy` and an unlisted, no-index research notice at `/research-privacy` for questionnaire links. Published wording comes from the owner's Google Drive notices; the research page is intentionally absent from the footer and navigation.
- Inbox confirmation, optional device questionnaire, email choices and withdrawal links.
- Private founder CRM with search, stages, notes and CSV exports.
- SES confirmation emails and founder alerts to `team@satinlore.com`.
- Cloudflare D1 schema and its six existing migrations.
- Cloudflare Access authentication for the founder dashboard and admin APIs.

The reader welcome email stays off by default. There is no newsletter campaign sender, automatic Google Sheets sync, automatic SES bounce ingestion or scheduled alert retry in this version.

## Deployment status

The independent Worker is deployed at `https://satinlore.com`, with `https://launch.satinlore.com` retained for existing test links. Its new D1 database has all six tracked migrations applied. The owner completed the full staging and final-domain tests, including Access login, SES readiness, real inbox delivery, confirmation, CRM edits/export and withdrawal. Confirmation and founder-alert sending is enabled; the reader welcome email stays off. `www` redirects to the apex with a 301 and preserves paths and query strings. The temporary `workers.dev` hostname and version previews are disabled. The previous hosted deployment has not been deleted.

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

`pnpm start` previews the built Worker locally. `pnpm deploy` publishes to the Cloudflare account authenticated in Wrangler, so read the setup guide before running it. Database migrations are a separate step; deploying code does not migrate or copy customer data.

## Configuration

`wrangler.jsonc` holds the Worker name, D1 binding and non-secret deployment defaults. Replace the D1 database ID with the ID from your own Cloudflare account. Keep the binding name `DB`.

Runtime secrets belong in **Cloudflare → Workers & Pages → satinlore-website → Settings → Variables and Secrets**, not in GitHub source or build variables. Non-secret values are authoritative in `wrangler.jsonc`; edit and commit that file so a later deployment does not overwrite dashboard-only changes. The email region is **Stockholm (`eu-north-1`)**. See the setup guide for the full table.

## Working on this repository

Read [AGENTS.md](AGENTS.md) before changing authentication, consent, database migrations, email or deployment settings. Keep the brand's simple copy and the existing page design unless a change is requested.
