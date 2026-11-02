# Website experience measurement

This feature records a visitor's public-homepage actions only after separate consent. The founder can inspect **Experience** at `/admin/experience` for session replay, click/movement heatmaps, scroll reach and time in view. It supplements the daily counters in Overview. It does not retrospectively record old traffic.

## Visitor choices

- Replay starts off. Allow and No thanks must be equally reachable, without blocking the waitlist.
- `satinlore_replay=on` or `off` is a 180-day preference cookie. It has no session or visitor identifier.
- Do Not Track, Global Privacy Control and the existing aggregate-measurement opt-out stop replay recording too. Allowing replay must not silently change the aggregate choice.
- Privacy choices is available again from the footer and privacy page. Turning replay off removes listeners/buffers immediately and requests deletion of the current recording while its in-memory credential is available. A failed deletion must be reported truthfully; new collection remains off.
- Earlier page visits cannot be discovered by the preference cookie. They expire normally after 30 days unless separately removed through authorised controls.

## What is retained

Only the public `/` homepage is eligible. Supported records contain a fixed layout version, visit time, broad device class, viewport/document dimensions and bounded numeric actions: pointer/click positions, scroll progress, allowlisted public menu/FAQ open states, visibility changes and active time for an allowlisted public section. There are no DOM snapshots, arbitrary selectors/text, input values, form contents, stories, raw network addresses, full browser strings, full links, campaign query values or CRM/contact identifiers in replay records.

A random server session ID separates visits. A random write/deletion credential is returned to the recording page, held only in memory and stored hash-only on the server. It does not provide admin read access. Appending to another session requires that session's credential. It must never be logged, exported in admin data, saved in cookies/browser storage or embedded in links.

The server requires a same-origin JSON request, affirmative replay choice and eligible measurement conditions for creation/appending. It validates exact fields, bounds and event kinds, rate limits recording independently of signup/contact, and makes retries idempotent. A current-session withdrawal still works when the preference has already been switched off. Owner-only admin routes independently validate Access before reading/deleting. The system does not join replay records to the CRM, waitlist or research answers.

Each session is capped at ten minutes, 3,000 events, 120 batches and 64 events per bounded batch. Records expire after 30 days and are purged through the existing scheduled cleanup. Heatmaps are derived from retained sessions; deleting or expiring a visit removes its contribution. The existing aggregate measurement totals remain separate and retain their existing 90-day policy.

## How replay and heatmaps should be read

Replay reconstructs clicks, pointer movements and scrolls on a static copy of the public landing page. It is not a camera, microphone, screenshot stream, literal screen video or a pixel-perfect recording. Forms/private regions are masked. The preview uses a protected, sandboxed frame with scripts and forms disabled. No tracking code should run in it.

Match the recorded layout version and device filter before interpreting an overlay. A changed page, viewport resizing, font/image loading or an excluded region can limit accuracy. The UI must show incompatible-layout or truncated/sample limits rather than imply exact coverage. Time in view measures visible public sections while the page is active; it does not establish gaze, attention, confusion, sexual preferences or why someone left. Clicks do not establish successful signup. Only opted-in traffic appears, and recordings may be truncated by session limits, backgrounding, connection loss or browser privacy controls.

## Local checks

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Apply local migrations through `0009` before testing the new screens. Use an isolated test database and neutral fixtures; do not copy production visitors or CRM records into tests.

1. Fresh visitor: open the homepage with no replay choice. Confirm no `/api/experience` recording request and no action listeners/buffer before opt-in. Choose No thanks and repeat clicks/scrolls; no replay should be created.
2. Privacy override: test `DNT: 1`, `Sec-GPC: 1`/browser Global Privacy Control and `satinlore_measurement=off`. An old replay `on` preference must not override them.
3. Opt-in: allow replay, click public links/FAQ areas, scroll and dwell on sections. Confirm bounded records and a visible current recording in Experience. Replays remain separate from aggregate counters.
4. Sensitive canary: type a unique synthetic marker into name/email fields without submitting, and interact inside the form. Inspect the session payload and playback; the marker, field values, form DOM and field positions must not be captured.
5. Other routes: test Contact, Privacy, confirmation/manage links, `/admin`, the private preview and app pages. The homepage collector must not capture them or their links/query values.
6. Withdrawal: stop replay in the current recording tab. No further batch may append. Its own deletion should work even after setting the cookie to off. Simulate a failed request: keep collection off and show failure/expiry accurately, without a false deletion-success message.
7. Isolation/retry: an incorrect write token cannot append or withdraw another session; duplicate batches do not duplicate events; payload conflicts are rejected. Reject unknown fields/events/sections, invalid numbers, oversized bodies and expired sessions.
8. Admin: logged-out requests cannot read the dashboard, individual recordings, heatmaps, preview or deletion endpoint on any hostname. Use the existing signed identity fixture, not a production bypass.
9. Replay: test Play/Pause, seeking, speed, pointer/click overlay and scrolling at mobile/desktop widths. Verify scripts/forms do not work in the frame, layout mismatches are labelled and playback does not change customer data.
10. Retention: expire a synthetic session and run cleanup. Both detail and heatmap contribution must disappear. Existing CRM, email queues, contact enquiries and aggregate retention tests must still pass.

## Release evidence

Implementation, local tests, browser acceptance, remote migration and live deployment are separate results. Do not describe a successful local build as a completed migration or a recorded visitor session. Record the release commit and actual checks with the deployment result. Do not submit production forms, send email or delete a real recording as part of an incidental UI check.

Local release checks on 2 November 2026 passed: 121 tests, TypeScript, production build and the built SES readiness check with synthetic credentials/mock responses. The local D1 migration through `0009` succeeded. Existing table definitions in the new schema snapshot match the preceding snapshot; the only added tables are replay sessions and batches. Tests cover consent, masking, revocation races, navigation, visibility, idempotency, retention and admin authorization. The local managed browser preview did not become healthy, so visual/live acceptance is recorded separately with the deployed release.

## Consent basis

The ICO's storage/access guidance distinguishes aggregate statistical results from recordings of an individual visitor and their actions. This feature retains individual visits for playback, so it uses separate prior consent and does not rely on the aggregate statistical-purposes exception. It does not use recording consent for advertising, waitlist/news or sensitive questionnaire research.

Official guidance reviewed 2 November 2026:

- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/
