# Contributor instructions

## Project

This is SatinLore's launch website and founder CRM, not the main story-reader app. It runs as an independent Cloudflare Worker using vinext, D1 and SES. The current GitHub repository is public.

## Preserve user-facing behavior

- Keep copy at approximately a fifth-grade reading level. Describe the benefit and ease of automatic story/device matching without implementation jargon.
- Do not restrict signup copy to one toy brand.
- Preserve the approved paid-testing offer and its total cap. Payment is for completed test tasks, never for positive reviews.
- Keep the reader welcome email off unless the owner explicitly asks to enable it.
- Keep required waitlist consent separate from optional extra marketing consent. Never infer consent from a CRM stage or CSV edit.

## Authentication and privacy

- Protect every `/admin` and `/api/admin` route, including exports, against unauthenticated requests.
- Cloudflare Access identity must come from a verified JWT with the configured issuer, audience, validity period and allowed founder email. Never trust arbitrary email headers or the former Sites/ChatGPT identity headers.
- Missing configuration and failed authentication must deny access. Do not add production mock users or bypass flags.
- Alternative hostnames, `workers.dev` and previews must not bypass admin authorization. Keep previews isolated from production data before enabling them.
- Never commit customer data, CRM exports, backups, token values, access keys, `.dev.vars` or `.env` files. Use synthetic fixtures in tests. Do not log raw reader tokens or email credentials.
- Keep verification and management credentials hash-only in D1. Preserve scanner-resistant confirmation (GET does not verify) and withdrawal deletion behavior.

## Database and email

- Keep `DB` as the D1 binding name. Database IDs identify environments; never silently repoint one environment at another database.
- Treat migrations as append-only. Do not rewrite or replay the six existing migration files against an already-migrated database.
- Use D1 migration tracking for the new database. Moving real records is a separate operation: the CRM CSV is not a complete migration backup.
- Preserve consent timestamps/versions, token hashes, expiry, verification state and CRM stages in any approved data migration. Keep private backups outside Git.
- Use SES in `eu-north-1` with `team@satinlore.com`. Runtime secrets stay in Cloudflare. Preserve Google's inbound MX/SPF/DKIM and SES DNS records during domain changes.
- SES acceptance is not proof of inbox delivery. Founder alerts are best effort, not exactly once. Do not claim automatic bounce processing or scheduled retries unless implemented and tested.

## Validation and releases

Run `pnpm test`, `pnpm typecheck` and `pnpm build` for relevant changes. Tests should verify observable behavior and security properties. Do not edit generated build output or commit dependencies/tool state.

Keep `README.md`, `CLOUDFLARE_SETUP.md`, `EMAIL_SETUP.md` and environment examples aligned with the actual scripts and configuration. Document remaining account setup, credentials, domain and delivery tests accurately. Never claim a remote deployment or DNS change from a local build alone.

Do not publish an unrelated change to the old hosted Site while working on this independent repository. Keep the old deployment available until the owner has tested the new one and the database cutover is complete.
