# Thumbnail Video Lag Fix Handoff

Recorded: 2026-06-16

Branch verified before work: `codex/brother-dashboard-aesthetics`.

Production was not touched, checked out, queried, deployed to, or used.

## What Changed

- Updated tutorial thumbnail playback scheduling so the two active slots go to the most visible/current videos, not the lowest-index near-viewport videos.
- Removed the permanent hover/touch activation behavior that could let many thumbnails keep playing outside the cap.
- Paused inactive thumbnail videos while avoiding source teardown/reload churn after a video has loaded once.
- Tightened hero playback visibility so the hero video pauses once the hero is offscreen instead of continuing deep into the tutorial section.
- Fixed the mobile public tutorial card layout so the title sits inside the card and no longer overlaps the thumbnail.
- Updated dashboard tutorial derivative generation to produce smaller motion display variants:
  - `540x540`
  - `30 fps`
  - H.264 Main profile
  - CRF `30`

## Working-Development Asset Regeneration

Regenerated all 15 active dashboard tutorial display variants in the documented non-production working-development Supabase project:

- Project id: `bgdhqbenqltxildlgkyu`
- Command mode: `--apply --force`
- Confirmed with: `--confirm-project-id bgdhqbenqltxildlgkyu`
- Production was not used.

Before:

- Active display videos: 15
- Display total: about `10.5 MB`
- Actual media profile: `720x720`, `60 fps`, H.264 High profile

After:

- Active display videos: 15
- Display total: about `3.5 MB`
- Largest display variant: about `0.57 MB`
- Sampled final media profile: `540x540`, `30 fps`, H.264 Main profile

## Browser Verification

Desktop `http://localhost:3000/`:

- Top of page: hero plus two tutorial videos playing.
- Tutorial video elements loaded from `540x540` media.
- After scrolling into the tutorial grid:
  - hero video paused while offscreen.
  - two visible tutorial cards held the active video slots.
  - earlier offscreen cards no longer held the playback slots.

Mobile viewport `390x844`:

- First-row public tutorial cards measured about `72x90`.
- Thumbnail measured about `72x70`.
- Title measured about `72x20`.
- Title did not overlap above the card and did not exceed the card bounds.

## Validation

- `npm.cmd run test -- videoPosterVariant.test.ts`: passed.
- `npm.cmd run type-check`: passed.
- `npm.cmd run lint`: passed with existing warnings, no errors.
- `git diff --check`: passed; only existing CRLF normalization warnings were reported.

## Follow-Up Tuning

After Scott reported that some thumbnails appeared frozen, the public tutorial playback cap was raised:

- Normal mode: from `2` to `5` simultaneous tutorial videos.
- Lite mode: from `1` to `3` simultaneous tutorial videos.
- Default shared grid cap: from `2` to `5`.

Browser verification at desktop top-of-page showed the first visible row had 5 sourced and playing tutorial thumbnails, all loaded from `540x540` media.

## Final Frozen-Thumbnail Pass

Scott then reported that some thumbnails were still frozen. Root cause: after the lag fixes, the scheduler capped playback correctly, but it picked the same highest-priority visible cards every time. That made non-selected thumbnails look permanently frozen even though the cap was intentional.

Final behavior:

- Normal public homepage pool: up to `15` visible tutorial videos can get a turn.
- Simultaneous playback cap remains `5` videos.
- Lite/low-power cap remains `3` videos.
- The active visible set rotates every `3600 ms`.
- Loaded sources are retained after first load so rotation does not repeatedly tear down and re-fetch the same videos.
- During page scroll, thumbnail playback still pauses until scrolling settles.

Measured desktop local browser results at `http://localhost:3000/`:

- Initial top-of-page: `436` DOM nodes, `40` animations total, `4` running, `0` long frames.
- Tutorial grid sample: active cards rotated from `1-5` to `11-15` to `6-10`.
- Tutorial grid frames: p95 `8.5 ms`, max `16.7 ms`, `0` long frames.
- Orbit section after animation reduction: `40` animations total, `36` running, p95 `12.5 ms`, max `25 ms`, `0` long frames.
- In-app browser verification confirmed the active thumbnail group changed from cards `1-5` to `11-15`.

Proxy note:

- A proxy is not the main fix for this symptom. The lag/freeze was caused by media weight, too many concurrent decodes, deterministic playback selection, and compositor animation pressure.
- A proxy could help later for controlled caching/range headers or URL stability, but only if implemented against the documented non-production environment first. It was not needed for this pass.

## Continuation Pass: Smaller Mobile Runtime And Faster Tutorial API

- Compact homepage layout now uses `homepage-hero-background-lite.mp4`.
- Compact homepage tutorial playback now caps at `3` simultaneous videos instead of `5`.
- Desktop remains at `5` simultaneous tutorial videos.
- Public tutorial API has a `60s` server-side warm cache and single-flight request sharing.
- Public route has a matching `60s` client-side cache and in-flight request sharing.

Latest local measurements:

- Phone top-of-page: `4` videos playing total (`hero + 3 tutorials`), `0` long frames.
- Phone tutorial section: `3` tutorial videos playing, p95 `8.4 ms`, max `8.6 ms`, `0` long frames.
- Warm direct API calls: about `10 ms` after the first read.
- Warm page-load API request: `24 ms`.

## Continuation Pass: Shared Dashboard Tutorial Fetch

- Moved the client-side `/api/dashboard/tutorials` single-flight/cache logic into a shared dashboard helper.
- Public dashboard and authenticated dashboard now use the same endpoint reader.
- Cache TTL remains `60 seconds`, matching the public response cache contract.
- Tests bypass the client cache to avoid module-level state leakage.
- Local public page-load verification after the shared helper showed one tutorial API request at `23 ms` warm and tutorial cards ready at `730 ms`.

## Continuation Pass: Static Tutorial Hydration

- Public home/dashboard static props now include dashboard tutorials.
- Public and anonymous dashboard render tutorial cards immediately from the static snapshot when available.
- The client endpoint remains a fallback for empty/unavailable static tutorial snapshots.
- Authenticated dashboard receives the static tutorial snapshot through the session-aware route and falls back to the shared endpoint only when needed.
- Local browser verification after this change: `0` client tutorial API requests, `15` tutorial cards rendered, cards ready at `1096 ms`, p95 frame time `8.5 ms`, `0` long frames.

## Continuation Pass: Lightweight Posters

Root cause found after the static hydration pass:

- The hero video still used `homepage-misty-forest-hero-v1.png` as both the video poster and CSS fallback. That file was about `1.59 MB`, so it remained a large first-load request even after the hero MP4 was optimized.
- The tutorial grid was close enough to the first desktop viewport that all 15 video poster JPGs loaded during the initial sample. The old poster set transferred about `1.15 MB`.

Fix:

- Added `frontend/public/dashboard/homepage-misty-forest-hero-poster.webp`, a `1280x720` WebP fallback around `15 KB`.
- Updated the hero video poster and CSS fallback background to use that lightweight WebP.
- Changed dashboard tutorial motion poster generation to `480px` max dimension and ffmpeg JPEG quality `5`.
- Kept poster paths as `poster.jpg` and content type as `image/jpeg` for compatibility with the current dashboard tutorial schema.
- Backfilled all 15 active tutorial derivatives in non-production Supabase project `bgdhqbenqltxildlgkyu` only:
  `npm.cmd run dashboard:tutorials:backfill-thumbnails -- --apply --force --limit 15 --confirm-project-id bgdhqbenqltxildlgkyu`

Measured local browser result after backfill:

- Known homepage/tutorial bytes: `3.44 MB`.
- Tutorial poster total: `387 KB`.
- Largest tutorial poster: `47 KB`.
- Heavy hero PNG request count: `0`.
- Frame p95: `8.5 ms`; one local dev/hydration long task remained.

Validation:

- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run lint`: passed with warnings only; warning count remained `23`.

## Frozen Thumbnail Follow-Up

- Branch stayed on `codex/brother-dashboard-aesthetics`; production remained off-limits and was not used.
- Root cause found after the first lag fixes: poster-only thumbnails outside the active scheduler could remain visually frozen, and direct engagement was not enough to force playback.
- Fix in `frontend/features/dashboard/components/DashboardTutorialGrid.tsx`:
  - Default nearby motion budget is now `15`, while simultaneous playback remains capped at `5`.
  - Rotation now advances every `2400 ms`.
  - Hover/focus/touch engagement wakes the selected poster thumbnail immediately.
  - `onCanPlay` retries playback after the source is actually decodable.
  - An engaged thumbnail replaces one scheduled autoplay slot, so moving thumbnails remain capped at `5`.
- Test coverage updated in `frontend/tests/pages/dashboard-tutorial-grid.test.tsx`.

Measured local evidence:

- Chrome local probe against `http://localhost:3000/` found `Insert Products, Items, & Outfits` poster-only before hover.
- After hover: `hasSrc: true`, `paused: false`, `currentTime: 0.96`, `readyState: 4`, `preload: metadata`.
- Total active thumbnail videos remained `5`.

Validation:

- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed.

## Visible Playback Priority Follow-Up

- Branch stayed on `codex/brother-dashboard-aesthetics`; production remained off-limits and was not used.
- Desktop probe found the scheduler could play thumbnails just below the viewport while visible thumbnails were paused.
- `DashboardTutorialGrid` now prioritizes actually visible thumbnails (`viewportRatio > 0.05`) before falling back to near-viewport thumbnails.
- Added a regression test proving visible thumbnail cards keep playback slots over offscreen-but-near cards.
- Desktop probe also found orbit proximity paused the tutorial grid while the lower showcase was still visible.
- `GuestDashboardView` now tracks actual showcase viewport coverage and only pauses tutorial playback for orbit overlap once the showcase is mostly gone (`showcaseViewportRatio < 0.18`).
- Compact/mobile layout now uses the low-power tutorial autoplay budget (`3`) instead of the desktop budget, matching its simultaneous playback cap.

Measured local evidence:

- After visible-priority fix at page top: `visiblePlayingIndexes: [0,1,2,3,4]`, `offscreenPlayingIndexes: []`, p95 `8.5 ms`.
- After refined orbit pause at `scrollY=700`: `visiblePlayingIndexes: [5,6,7,8,9]`, `offscreenPlayingIndexes: []`, p95 `8.5 ms`.
- Mobile compact tutorial video media dropped from `3.67 MB` before the compact-budget fix to `1.50 MB` after it; visible playback stayed at `3` videos with no offscreen tutorial playback.

Validation:

- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`32` tests).
- `npm.cmd run lint`: passed with existing warnings only; warning count remained `23`.
- `git diff --check`: passed with CRLF notices only.

## Lightweight Motion Derivative Follow-Up

- Branch stayed on `codex/brother-dashboard-aesthetics`; production remained off-limits and was not used.
- Remaining media probe showed tutorial display MP4 bytes were still the largest tutorial-specific cost.
- Proxy note: a stable proxy could help signed-URL cache churn later, but the better first fix was reducing the actual bytes and decode work.
- Changed dashboard tutorial motion derivatives from `540px / 30fps / CRF 30` to `360px / 20fps / CRF 32`.
- Dry-run backfill for confirmed non-production project `bgdhqbenqltxildlgkyu`: all `15` active display MP4s totaled `1,574,356` bytes (`1.54 MB`), max `259,591` bytes.
- Applied the guarded non-production backfill with `--apply --force --confirm-project-id bgdhqbenqltxildlgkyu`.

Measured local evidence:

- Desktop full scroll probe after backfill: tutorial display media `1,574,356` bytes, total media `2,847,492`, p95 frame time around `8.5 ms`.
- Mobile compact probe after backfill: tutorial display media `623,080` bytes, down from `1,498,935` bytes before this derivative pass; visible playback stayed at `3` videos with no offscreen tutorial playback.
- Browser metadata confirmed active thumbnail videos are `360x360`.

Validation:

- `npm.cmd run test -- admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts`: passed.
- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`32` tests).
- `npm.cmd run lint`: passed with existing warnings only; warning count remained `23`.
- `git diff --check`: passed with CRLF notices only.

## Stable Delivery Proxy Follow-Up

- Branch stayed on `codex/brother-dashboard-aesthetics`; production remained off-limits and was not used.
- Implemented the proxy-style improvement discussed earlier, but scoped it to the measured problem: signed Supabase thumbnail URLs were stable in content but unstable in URL/cache behavior.
- Public dashboard tutorial payloads now use `/api/dashboard/tutorial-thumbnail?path=...` for stored dashboard tutorial display and poster assets.
- Admin tutorial reads continue using signed Supabase URLs.
- New route `frontend/pages/api/dashboard/tutorial-thumbnail.ts` validates paths, signs server-side, caches hot thumbnail buffers in memory, sets long-lived public cache headers with `immutable`, emits ETags, supports `HEAD`, and supports byte ranges for videos.

Measured local evidence:

- `/api/dashboard/tutorials` now returns stable local thumbnail URLs.
- Same-context browser reload probe: Supabase tutorial media requests dropped to `0`; poster assets came from browser cache on reload with `transferSize: 0`.
- Video thumbnails still issue some range transfers on reload, which is expected media behavior; this proxy primarily fixes URL churn/cacheability, while the 360px derivative pass reduced first-load bytes.

Validation:

- `npm.cmd run test -- dashboard-tutorial-thumbnail-proxy.test.ts dashboard-tutorials.test.ts`: passed.
- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts dashboard-tutorial-thumbnail-proxy.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`36` tests).
- `npm.cmd run lint`: passed with existing warnings only; warning count remained `23`.
- `git diff --check`: passed with CRLF notices only.

## Continuation Pass: Desktop Hero And Orbit/Video Runtime

Root causes found after lightweight posters:

- The active desktop hero MP4 was still the largest top-load item at `2.24 MB`.
- A full-page scroll sweep showed tutorial videos could continue playing while the orbit section was active, causing video decode and orbit animations to overlap.
- The wide desktop orbit still rendered `18` tools, which means `36` path/counter-spin animations.

Fix:

- Re-encoded `frontend/public/dashboard/homepage-hero-background-perf.mp4` to `1280x720`, `20 fps`, constrained around `600 kbps`, reducing it to `1.27 MB`.
- Kept the `600k` encode after comparing sample frames in `Scott/hero-video-compare-2026-06-16/`; the `520k` candidate had visible blockiness.
- Reduced wide desktop orbit tools from `18` to `12`.
- Added a parent pause gate to `DashboardTutorialGrid`.
- The public homepage now pauses tutorial thumbnail playback when the orbit section is near view, preventing orbit animation and tutorial video playback from running together.

Measured browser result:

- Hero video transfer: `1,273,136` bytes, still `1280x720`.
- Known homepage/tutorial bytes: `2.47 MB`.
- Orbit section: `12` tools, `24` running orbit animations, `0` playing videos.
- Full-page sweep p95 frame time: `8.5 ms`.
- One local dev/hydration long task remained near initial load.

Validation:

- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run lint`: passed with warnings only; warning count remained `23`.
