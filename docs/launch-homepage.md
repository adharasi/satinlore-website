# Publish the After Hours homepage

The launch branch contains the revised homepage from the approved After Hours draft. The marketing Worker serves the site on `satinlore.com` and `launch.satinlore.com`. The reader, sign-in, and billing run separately on `app.satinlore.com`.

## Validate the branch

From the website checkout run:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
node scripts/check-launch-build.mjs
```

The last command uses the built Worker with synthetic runtime flags and no production database or account credentials. To view it locally, copy `.dev.vars.example` to `.dev.vars`, leave email sending off, set `MARKETING_LAUNCH_ENABLED=true`, and run `pnpm dev`. Test the paid call to action separately by also setting `MARKETING_BILLING_ENABLED=true`. The links open the separately deployed reader, so inspect their URLs locally before opening a live destination.

## Deploy and enable

1. Confirm the private app's public signup and sign-in both work in a fresh browser. Keep the simulator private at `app.satinlore.com/beta`. The marketing homepage links to the reader, so deploy and verify the app before enabling the new homepage.
2. Deploy the reviewed marketing revision to the existing `satinlore-website` Worker. The connected production branch is `main`; pushing a launch branch alone does not publish. To publish from the launch branch without merging, open the website checkout on that branch and run `pnpm build`, then `pnpm deploy` using an authorised Cloudflare account. This deploys both domains and applies unapplied tracked migrations to the existing production D1 database. Review the migration list before deployment. Keep non-production auto-deploy off because it shares the production hostnames and D1 settings. See [Cloudflare setup](../CLOUDFLARE_SETUP.md#9-connect-automatic-github-deployments).
3. In **Workers & Pages → satinlore-website → Settings → Variables & Secrets**, add the Text runtime variable `MARKETING_LAUNCH_ENABLED=true` and deploy the change. Until this is true the existing waitlist stays at the homepage. `keep_vars` retains this dashboard setting across deployments. The new homepage will link to reader sign-up and sign-in; the original waitlist remains accessible at `/waitlist#waitlist`.
4. Open the apex domain in a fresh browser and check the homepage on mobile and desktop. Check signup, sign-in, pricing guidance, contact, privacy, and cookie choices. Confirm the canonical URL is `https://satinlore.com/`. The legacy waitlist is excluded from search indexing. The opt-in website recording dashboard separates After Hours from the earlier homepage.
5. After payments pass the reader's test-mode and live-readiness checks, add the Text runtime variable `MARKETING_BILLING_ENABLED=true` in the same marketing Worker and deploy. This adds the Plans and billing link. With billing off, prices are visible and no paid button appears. The reader's own billing controls independently decide whether customers can purchase.

To roll back the homepage, set `MARKETING_LAUNCH_ENABLED=false` and deploy the variable change. To remove the paid button, set only `MARKETING_BILLING_ENABLED=false`. Roll back the code from the Worker deployments list if the revision itself is unhealthy. A code rollback does not reverse a D1 migration.

Both marketing flags default off. Keep Stripe credentials, checkout webhooks and AI spend limits in the reader's Worker and provider dashboards.
