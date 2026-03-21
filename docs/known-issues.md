# Known Issues

## P0: AI Studio Reference Grid -> Styles drop reliability remains broken (deferred)
- **Issue ID:** `KI-AI-RG-STYLES-001`
- **Severity:** P0 major workflow blocker
- **Status:** Deferred as of March 13, 2026 pending a new end-to-end investigation pass
- **Program gate classification:** Non-blocking for `P0/WG-1` under an explicit time-bounded waiver; blocking for final closeout until resolved or re-waived
- **Owner:** AI Studio Engineering
- **Waiver decision:** Approved (time-bounded implementation-entry waiver)
- **Waiver risk note:** Proceeding with `P0/WG-1` recovery correctness work while styles-drop lane remains deferred; this waiver does not remove the requirement to resolve or re-waive before final reliability closeout.
- **Waiver expiry date (UTC):** 2026-03-28
- **Next review date (UTC):** 2026-03-24
- **Linked tracker reference:** `RGR-B02`
- **Primary surface:** `AI Studio -> Shortcuts -> Styles` panel
- **Symptom:** Dragging an image from Reference Grid into Styles still intermittently fails with:
  - `This image source blocks browser access. Download the image and drop the file directly.`
- **Expected behavior:** Internal Reference Grid image drops should create a new style without forcing manual file download.

### User impact
- Blocks core style-creation workflow for internal references.
- Regresses confidence in reference-to-style pipeline reliability.
- Creates inconsistency: reference tile is visible and selectable, but style intake rejects source.

### Current observed state (latest)
- Styles panel still shows blocked-source error after drag/drop.
- Deterministic classification improved (`blocked-source` vs generic), but happy-path completion is still not reliable in live usage.
- This issue remains unresolved despite multiple hardening passes.

### Scope explicitly deferred
- Defer additional patching in this lane for now.
- Defer broader media delivery/runtime refactors as part of this incident.
- Resume only with a fresh characterization-first execution plan anchored to captured real payloads.

### What was implemented before deferral
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

7. Validation and tests run
- Added/updated tests for:
  - internal hint parsing without origin
  - resolver media-id fallback when output row is missing
  - server-copy fallback success/failure behavior
  - deterministic preview-source failure mapping
  - telemetry normalization contract
- Targeted suites passed (styles intake/resolver, dragDrop, styles panel, AI Studio drop routing, relevant persistence tests).
- Lint/build/docs checks passed (with unrelated pre-existing lint warnings).

### Operational checks already performed
- `sql/check_media_all_media_completeness_drift.sql` executed in affected environment.
- `sql/migrations/064_backfill_media_files_from_storage_objects.sql` executed.
- Result reported: no rows returned from drift/backfill path in this environment.
- Conclusion: obvious durable `media_files` drift was not confirmed as the active root cause for this repro.

### Why this is still unresolved
- We improved classification and fallback behavior, but real-world completion still fails in at least one active path.
- We likely still have an unresolved mismatch between:
  - real browser transfer payload shape in failing sessions, and
  - resolver/fallback assumptions about canonical internal source recovery.
- Incremental patching is now high-risk without a fresh, tightly captured characterization baseline.

### Defer decision and guardrails
- **Decision:** Stop incremental patching for this issue until a fresh investigation pass is scoped and approved.
- **Guardrail:** No broad refactors tied to this incident until one failing payload + one passing payload are captured and locked as tests first.
- **Entry criteria to resume work:**
  1. Capture one successful and one failing real drag payload packet (types/data + resolver decision trace + fallback call outcome).
  2. Add those payloads as characterization tests before behavior changes.
  3. Re-confirm golden happy-path test passes before enabling fallback hardening changes.

### Required references for next investigation pass
- `docs/troubleshooting.md` (Reference Grid -> Styles blocked-source section)
- `docs/sops/sop_ai_studio_style_creator.md`
- `frontend/features/ai-studio/components/style-creator/intake.ts`
- `frontend/features/ai-studio/components/style-creator/internalDropResolver.ts`
- `frontend/features/ai-studio/utils/dragDrop.ts`

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
