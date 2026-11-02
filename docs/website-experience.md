# Website recordings and experience measurement

The current release captures detailed visual website replays after fresh, versioned cookie consent. Admin → Experience (`/admin/experience`) also shows the existing numeric interaction replays and heatmaps. Only the public homepage is recorded. There is no retrospective capture of old traffic or recording of the private app, admin, forms or management links.

## Cookie choices

The banner offers **Accept all cookies**, **Reject non-essential cookies** and **Manage choices**. Essential tools are always available; Analytics and Website recordings are independent optional categories. The 180-day preference contains category bits/version, not a visitor ID. Legacy `satinlore_replay=on` alone cannot authorize new collection. Do Not Track and Global Privacy Control keep optional tools off. New materially different purposes need a new disclosed consent version before activation. The footer's Privacy choices and privacy page reopen the same settings. See [cookie registry and extension rules](cookie-choices.md).

The first Analytics grant records one coarse homepage view for the current load; repeated choice events cannot duplicate it. Existing accepted document requests keep their server-side pageview/unique logic. No page counter runs before the current Analytics choice. Waitlist, news and research consent remain separate.

## What is recorded and stored

New `rrweb-v1` sessions retain sanitized homepage DOM/styles and approved public images, changes, scroll/cursor/click activity, viewport/visibility and section time. Whole forms, signup notices, editable regions and private controls are masked before transmission. Their dimensions remain so the page layout stays representative. Scripts, private URLs/query values, unsupported events, media/canvas, raw addresses, full user agents, input values and CRM identifiers are excluded. Capture pauses in cookie dialogs/background tabs and stops on loss of consent or departure from the public homepage.

An owner token exists only in the page's memory; the server stores its hash. Same-origin requests, bounded payloads, exact sequence/fingerprint checks, stateful privacy validation and rate limits protect writes. Each session lasts at most ten minutes and expires after 30 days. Visual data is capped at 3 MiB, 5,000 events and 120 batches; numeric events keep their 3,000-event limit. A 128 MiB global visual-payload budget counts all stored visual bytes, including expired rows until cleanup removes them; atomic guards prevent concurrent visits exceeding it. A full visual budget leaves numeric measurement and the CRM available. Scheduled cleanup, withdrawal and admin deletion remove visual children too. Existing CRM/SES records and retention stay separate. See [the storage/API contract](visual-replay-storage.md).

## Viewing and interpreting recordings

Open Admin → Experience, choose the period/device and select a visit. New sessions offer **Visual website replay** by default, with Play/Pause, seeking, speed, click markers and Full screen. **Interaction replay** remains an alternative, and earlier sessions retain the original player. The visual player reconstructs the captured page, rather than displaying the latest homepage layout. Untrusted stored events are revalidated, then rendered inside protected script-disabled sandboxes with approved-image-only network access. Forms and private areas cannot be interacted with.

This is not a camera/audio recording or desktop/tab video. Cookie acceptance cannot replace the browser's separate display-capture prompt. Only opted-in traffic appears. Time in view, repeated clicks and scroll reach are clues to investigate; they do not prove gaze, confusion, sexual preferences, signup success or the reason someone leaves. Missing batches, blocked assets, masking and capture limits can reduce fidelity; the UI reports incomplete recordings.

## Verification checklist

Run `pnpm test`, `pnpm typecheck`, `pnpm build` and `pnpm test:browser`. Apply local migrations through `0010` in an isolated database. The CI browser suite uses the real recorder/player and neutral fixtures, with a synthetic API and restrictive replay CSP; it never submits production forms or contacts a vendor.

1. Fresh/legacy visitor: no optional API request, observer or buffer before the new cookie choice. Reject non-essential cookies; interactions stay unrecorded. Browser privacy signals override old/new acceptance.
2. Independent categories: Analytics-only must not record a visit; Website-recordings-only must work without analytics. Failed preference writes leave optional measurement off on the current page and show an accurate failure.
3. Accept recording: Meta/full snapshot and later public DOM mutations arrive with bounded numeric activity. Recorded styles, public images, responsive dimensions and open FAQ/menu state should remain usable.
4. Private canaries: prefill and edit synthetic name/email without submission; inspect requests and playback. No field values, form contents, signup notices, private links or editable subtrees may appear, including after dynamic reclassification/movement.
5. Playback: verify owner-only routes before data access, nested sandbox/CSP, no recorded scripts/navigation/forms, no foreign-image/CSS/network requests, Play/Pause, seek, speed and full-screen controls. Earlier numeric sessions and heatmaps keep working.
6. Revoke while loading/sending: stop observers/buffers immediately and delete the current owned visit. In-flight/stale replies cannot restart capture. Failed deletion is reported honestly; earlier visits expire normally without a persistent identifying cookie.
7. Validate ownership, strict schemas, malformed/oversized payloads, idempotent/concurrent retries, sequence conflicts, timing/byte limits, expiry and deletion. Cleanup must preserve current CRM notes and queued survey email jobs.
8. Review the cookie choices and player at phone and desktop widths. A desktop viewport check does not establish physical-phone behaviour. Keep automated, browser, deployed and real-visitor evidence separate.

## Current cookie and visual replay release evidence

Local checks on 2 November 2026 passed: 156 tests, TypeScript, production build and built SES readiness with synthetic credentials/mocked responses. Local migrations through `0010` applied successfully. Actual SQLite tests verify strict privacy state across batches, concurrent idempotency, the 128 MiB shared-database visual budget, deletion/retention, and unchanged current CRM notes/survey email jobs. The research notice remains unchanged. The managed development preview did not become healthy after the copied-lock repair, so browser acceptance uses the separate isolated CI suite and signed-in deployed checks; no local browser success is inferred from the build. GitHub browser/deployment outcomes are recorded separately after they run.

## Release evidence

Implementation, local tests, browser acceptance, remote migration and live deployment are separate results. Do not describe a successful local build as a completed migration or a recorded visitor session. Record the release commit and actual checks with the deployment result. Do not submit production forms, send email or delete a real recording as part of an incidental UI check.

Local release checks on 2 November 2026 passed: 122 tests, TypeScript, production build and the built SES readiness check with synthetic credentials/mock responses. The local D1 migration through `0009` succeeded. Existing table definitions in the new schema snapshot match the preceding snapshot; the only added tables are replay sessions and batches. Tests cover consent, masking, revocation races, navigation, visibility, idempotency, retention and admin authorization. The local managed browser preview did not become healthy, so visual/live acceptance is recorded separately with the deployed release.

Live acceptance on 2 November 2026 passed for website commit `2419487a80dcefd62da5903fe5851f402c88d187`: GitHub CI and Cloudflare Workers build/deployment both succeeded. A rejected replay choice retained zero sessions; an opted-in synthetic homepage visit then appeared in the owner-only Experience dashboard. Heatmaps, replay Play/Pause and click-marker seeking worked. Both preview modes contained no form fields, and the synthetic canary typed into an unsubmitted first-name field was absent from replay. No contact/waitlist form was submitted, email sent or production recording deleted. One synthetic QA session was retained for review. The follow-up records the initial scroll position and excludes admission latency; its regression also passes.

## Consent basis

The ICO's storage/access guidance distinguishes aggregate statistical results from recordings of an individual visitor and their actions. This feature retains individual visits for playback, so it uses separate prior consent and does not rely on the aggregate statistical-purposes exception. It does not use recording consent for advertising, waitlist/news or sensitive questionnaire research.

Official guidance reviewed 2 November 2026:

- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/
