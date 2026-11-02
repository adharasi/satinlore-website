# Visual homepage replay storage

The new format is a masked, restricted `rrweb-v1` webpage reconstruction. It is not a desktop, browser-tab video, camera or microphone recording. Numeric interaction batches remain separate and continue to supply existing heatmaps and the legacy replay view.

## Consent and API

The current `satinlore_consent` version must explicitly allow the `experience` category. An older `satinlore_replay=on` cookie cannot authorize either new numeric capture or the expanded visual format. Analytics and experience choices are independent; `v2.0.1` may authorize experience while aggregate analytics remains off. DNT, GPC, founder Access, bot and prefetch exclusions still apply. Consent changes do not change waitlist, newsletter or research choices.

`POST /api/experience` requires the exact public site Origin and JSON. Start version 2 adds `format: "rrweb-v1"` to the existing explicit homepage admission request. Version 1 remains a numeric-only fallback under current consent. Both receive one random session ID and an in-memory write/withdraw credential, stored hash-only in D1.

Visual append uses `{action:"visual",sid,token,seq,events}`. Its sequence starts at zero and is independent of numeric `{action:"append",...}`. The custom `X-SatinLore-Replay: rrweb-v1` header selects the larger bounded body allowance; other requests retain their 20,000-byte cap. IDs/tokens never enter cookies, URLs, local storage, logs, CRM records or admin responses.

Bounds are 327,680 UTF-8 bytes per visual request, 262,144 bytes and 128 events per visual batch, 3,145,728 bytes and 5,000 visual events per visit, 120 batches per stream and ten minutes of normalized event time. A final flush has a bounded one-minute arrival grace. Records expire after 30 days. Distinct rate buckets keep capture separate from signup/contact abuse limits.

The sum of all stored visual payload counters is also capped at **128 MiB** across sessions, protecting headroom for the existing shared CRM database. Expired-but-unpurged sessions remain charged until cleanup or deletion actually removes them. Both insert and counter advancement enforce this budget in the same D1 transaction; concurrent visits cannot each reserve the same remaining space. At the limit, visual append returns a generic 429 and optional visual capture stops; numeric activity, the waitlist, CRM and email operations keep their existing paths. This payload budget does not claim to measure all database/index/row overhead.

The shared restricted codec rejects unsupported rrweb sources, arbitrary scripts/plugins and input events; strips unsafe attributes, links and network-capable CSS; and masks forms and private regions. The server reconstructs the bounded preceding ID privacy map before accepting a later batch, so mutations cannot promote masked or unrelated node IDs. Admin playback must apply the same stateful sanitizer and a network-closed sandbox as additional defenses.

## Additive database change

Migration `0010_visual_website_replay.sql` adds visual-format/counter fields to `website_experience_sessions` and creates `website_visual_batches`. Existing sessions default to numeric-only. No CRM, waitlist, research, email, aggregate metrics or existing batch definition changes. The generated snapshot retains every unrelated table unchanged.

Payload fingerprints make identical retries idempotent and conflicting retries fail. Insertion and sequence/byte/event counter advancement are one D1 batch guarded by ownership, sequence and limits, including under concurrent retries. Visual timestamps are monotonically ordered, normalized to admission and bounded to ten minutes; no arbitrary clock epochs are stored.

Current-session withdrawal, authenticated admin deletion and parent deletion remove visual batches with numeric batches. Expired records are excluded immediately from reads. Scheduled cleanup removes visual children separately; an unavailable visual migration cannot block existing email/CRM or legacy analytics cleanup.

## Admin responses and rollout

Existing owner verification protects all detail and overview reads and deletion. A detail may add `visual: {format,events,bytes,eventCount,durationMs,baseTimestamp,incomplete}`. `baseTimestamp` is zero; event times are relative to admission. Session summaries expose only visual availability and bounded counters. Credentials and network identity are never exported. Incomplete, invalid or truncated recordings must be labelled rather than treated as a complete visit.

Deploy through the existing migration-before-Worker script. A local migration/build does not establish a remote migration or live recording. Validate the deployed admission, upload, protected playback, rejection and withdrawal with synthetic content only; do not submit real waitlist/contact forms or publish private visitor material as incidental QA.
