# Known Issues

## Historical P0: AI Studio Reference Grid -> Styles drop reliability (resolved 2026-05-16)

- **Issue ID:** `KI-AI-RG-STYLES-001`
- **Severity at time of incident:** P0 major workflow blocker
- **Current status:** Resolved on `2026-05-16`
- **Program gate classification:** No longer an active ship blocker
- **Primary surface:** `AI Studio -> Shortcuts -> Styles` panel
- **Historical symptom:** Dragging an image from Reference Grid into Styles intermittently failed with:
  - `This image source blocks browser access. Download the image and drop the file directly.`
- **Resolved behavior:** Internal Reference Grid image drops now succeed in live runtime verification and create a new style without forcing manual file download.

### Current observed state

- Fresh protected-route browser verification on `2026-05-16` confirmed the internal `Reference Grid -> Styles` drag/drop path succeeds end to end.
- The intentionally external blocked-source path still fails deterministically with the expected user-facing message.
- The checked-in audit harness now enters `/ai-studio?perfAuditRuntime=1` automatically; fresh reruns should no longer require manual route edits to mount the perf-audit helpers.

### What changed before resolution

1. Drag contract hardening

- Internal drag payload parsing now accepts robust internal hints (`text/reference-output-id`, `text/reference-media-id`) even when origin metadata is stripped.
- Existing origin validation remains when origin exists.
- Reorder/non-image guards preserved.

2. Drag payload quality improvements

- Reference drag payload assembly prioritizes stronger render candidates:
  - snapshot data URL (when available)
  - card preview URL
  - rendered currentSrc
  - output-derived preview URL
- Existing transfer keys preserved for compatibility.

3. Styles intake candidate ordering changes

- Internal resolver and rendered-reference candidates are evaluated ahead of weaker generic text/url candidates.
- Same-origin `/_next/image` internal transfer URLs are preserved first to reduce unnecessary upstream CORS breakage.

4. Internal resolver hardening

- Canonical signed storage candidates remain priority where available.
- Added media-id lookup fallback (`media_id -> media_files.storage_path -> signed URL`).
- Added generation/task index lookup fallback when media-id/storage hints are missing.
- Resolver now returns provenance hints for downstream fallback operations.

5. Secondary fallback lane (server copy)

- Added blocked-source-only fallback using existing authenticated `POST /api/media/copy-from-url`.
- If fallback fails, UI still returns deterministic blocked-source (no generic error copy).
- Added emergency lane switch:
  - `NEXT_PUBLIC_AI_STUDIO_STYLE_DROP_SERVER_COPY_FALLBACK_ENABLED`

6. Error taxonomy + telemetry improvements

- Preview-source failures normalize to deterministic families (`missing`, `expired`, `blocked`).
- Extended telemetry metadata to include:
  - `classifier_reason`
  - `resolution_stage`
  - `resolution_reason`
  - `candidate_count`
  - `server_copy_attempted`

7. Resolution evidence

- Fresh browser runtime verification on `2026-05-16` authenticated successfully into `/ai-studio?perfAuditRuntime=1`.
- The internal Reference Grid -> Styles drag/drop flow created a new style tile in-browser.
- The intentionally external blocked-source scenario still failed deterministically as designed.
- Targeted style-intake and resolver suites remained green.

### Residual follow-up

- Keep future harness changes aligned with the perf-audit route contract.
- Do not reopen this as a product blocker unless fresh live-runtime evidence regresses the internal happy path.

## TikTok profile links fail in ChatGPT Atlas

- **Impact:** Opening a saved creator’s TikTok profile from the app in the ChatGPT Atlas environment shows the TikTok “Something went wrong” error, while the same links work in Chrome.
- **Expected URL format:** `https://www.tiktok.com/@<handle>?lang=en` (handle sanitized: trims whitespace/zero-width chars, strips leading `@`, URL-encodes).
- **Attempts made:**
  - Sanitized handles on insert/load and URL build (strip zero-width/nbsp, remove whitespace, drop leading `@`, encodeURIComponent).
  - Switched to normalized platform mapping with explicit TikTok prefix.
  - Tried trailing slash and without trailing slash; current format omits trailing slash and appends `?lang=en`.
  - Added `referrerPolicy="no-referrer"` on profile links to reduce referrer blocking.
  - Verified generated URLs match the working format and open in Chrome.
- **Status:** Still failing in ChatGPT Atlas; likely environment-level or TikTok user-agent/referrer gating. Needs further investigation (e.g., user-agent spoofing, additional query params, or in-app webview handling).
