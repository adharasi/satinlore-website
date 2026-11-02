# Cookie choices and optional website tools

The shared banner offers **Accept all cookies**, **Reject non-essential cookies** and **Manage choices**. The first layer says analytics and website recordings help improve the site. The settings layer explains each active purpose, provider, duration and the masking of private areas. Both accepting and rejecting are directly reachable. Joining the waitlist does not depend on optional consent.

## Current registry and gates

`lib/cookie-consent.mjs` is the shared, browser/server-safe registry and parser. The active categories are:

| Category | Behaviour | Retention |
| --- | --- | --- |
| Essential | Security, requested services and remembering choices; always available | Service session where applicable; preference cookies 180 days |
| Analytics | Public page/CTA totals and short-lived protected daily unique codes | Daily codes expire just after UTC midnight; aggregate totals up to 90 days |
| Website recordings | Visual reconstruction, public interactions and heatmaps; private areas masked | At most ten minutes per visit, retained up to 30 days |

The authoritative preference is `satinlore_consent=v2.<analytics bit>.<experience bit>`, recorded under consent version `cookies-2026-11-02-v2`. `v2.1.0` permits analytics without a recording. `v2.0.1` permits recording without analytics. An absent, malformed, duplicated or old-version value permits neither. `satinlore_measurement` and `satinlore_replay` remain compatibility preference mirrors; neither can authorise the new collection on its own. The old interaction-replay grant is not upgraded into visual-recording consent.

Do Not Track and Global Privacy Control override optional collection. Existing waitlist, news and sensitive-research choices remain separate. A cookie preference has no visitor ID and cannot identify all earlier visits. Current recording withdrawal uses only its existing in-memory credential, with truthful failure/expiry messaging.

Client CTA events and server page-view/unique accounting require the current Analytics category. When Analytics is first accepted on an already-open homepage, `SiteMetrics` sends one bounded `consent_page_view` event to preserve that eligible first visit without a reload. A page mounted with analytics already allowed relies on its edge page view and sends no duplicate. Further accept/reject toggles do not send the same pageview again. Source/referrer fields are coarse enums; the event carries no URL, query, visitor identifier or form content. It uses the existing page rate limit, transactional counters and daily unique dedupe.

If saving a preference fails, current-page recording and client analytics stop immediately, and the UI reports that the new choice was not saved. A future request can still carry the old cookie if the browser did not allow it to change; browser privacy settings remain available. The interface must not claim successful saving or deletion after a failure.

## Adding a future tool

1. Describe its purpose, provider, data, duration and eligible pages before enabling it.
2. Use `cookieCategoryAllowed(cookie, category)` in every client loader and server collection boundary. Do not load an optional tool and ask afterwards.
3. A tool may use an existing category only within its already-disclosed purpose and scope. A new purpose, material provider/data change or wider recording scope requires a registry/notice update and a new cookie-value/consent version, so earlier grants do not silently permit it.
4. Add a distinct settings category where users need an independent purpose choice. Unknown categories fail closed; “Accept all” means all currently described optional categories, not unknown future uses.
5. Test refusal, partial acceptance, browser privacy overrides, withdrawal, blocked preference writes and the expanded tool's own private-data boundaries.

No advertising or social-media category is enabled by this release.

## Validation

`tests/cookie-consent.test.ts` exercises the shared parser, category independence, conservative migration, bounded choice cookies, browser signals and the actual analytics client bindings. Analytics/unique tests verify current-version server gating, strict post-consent view fields, daily dedupe and unchanged independent rate/counter behaviour. Browser acceptance still needs to verify the rendered banner, settings, focus, responsive layout and real recording lifecycle.

The Website Privacy Notice reflects the current categories and visual recording. The Research Privacy Notice is unchanged.

Current ICO consent-mechanism guidance was reviewed 2 November 2026: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/
