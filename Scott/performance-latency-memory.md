# ShortPulse Performance And Latency Memory

Recorded: 2026-06-16

Purpose: durable working memory for Scott's speed, lag, and latency lane.

## Temporary Owner Rules

Until Scott explicitly says otherwise:

- Production is off-limits in all capacities.
- Never touch production.
- Never apply changes to production.
- Never switch to production.
- Only work on branch `codex/brother-dashboard-aesthetics`.
- Never leave branch `codex/brother-dashboard-aesthetics`.
- Save Scott-agent memories, artifacts, and instructions under `Scott/`.

## Current Branch Verification

- Verified on 2026-06-16 from `C:\CODEX Agents\Home page CODEX\ShortPulse`.
- Active branch: `codex/brother-dashboard-aesthetics`.
- No branch switch was performed.

## Active Job

Scott's current mandate is to work on:

- speed
- lag
- latency

Default interpretation for this lane:

- Improve perceived and measured responsiveness.
- Reduce unnecessary runtime work, decoding, layout, paint, animation, and network cost.
- Preserve the intended dashboard/homepage visual direction unless Scott explicitly chooses a performance-first visual tradeoff.
- Prefer changes that can be verified locally on `codex/brother-dashboard-aesthetics`.

## Safety Notes

- Do not use production credentials, production data, production deploys, production branches, or production environments.
- Do not validate against production.
- Do not push, merge, deploy, or apply any change to production.

## 2026-06-16 Thumbnail Runtime Finding

- Frozen thumbnails were partly intentional playback capping: only the selected visible videos play.
- Current public-home scheduler keeps simultaneous playback bounded (`5` desktop, `4` compact, `3` compact low-power), and rotates the visible candidate pool every `5200 ms` so compact thumbnails are not permanently frozen.
- Do not fix this by raising all thumbnails to play at once; that reintroduces decode and compositor pressure.
- Do not reach for a production proxy for this issue. Proxying may help future cache/range-control work, but the real fixes here were smaller derivatives, bounded playback, rotation, scroll pausing, and fewer always-running decorative animations.

## 2026-06-16 Continuation: Compact Rotation Re-Enabled

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- User reported that some thumbnails were frozen and did not move.
- Live local browser inspection at mobile viewport showed the immediate cause:
  - Compact public home had `15` tutorial videos in the DOM.
  - Only indexes `[0,1,2,3]` had `src` and were actually playing after settle.
  - Indexes `[4-14]` were poster-only because compact playback rotation had been disabled.
- Fixes made:
  - Re-enabled tutorial playback rotation for compact public-home grids while keeping compact simultaneous playback capped at `4`.
  - Kept scroll pause/resume, source release staggering, duplicate play guards, and the compact cap intact.
  - Converted `useSectionNearViewport` to a callback ref with a durable `hasBeenNearViewport` flag so deferred sections that mount after fetched tutorial data can still activate.
  - Added a layout-preserving showcase placeholder for cases where the tutorial grid really is below the viewport; the mobile public home currently places the showcase near the first viewport, so this is not the main compact fix.
- Browser proof:
  - Before rotation interval: playing/sourced indexes `[0,1,2,3]`.
  - After rotation interval: playing/sourced indexes `[4,5,6,7]`.
  - 4x CPU mobile scroll probe: p95 `8.4 ms`, p98 `8.5 ms`, max `33.2 ms`, `0` frames over `50 ms`, `0` long tasks.
  - Final scroll state kept exactly four thumbnails sourced/playing, indexes `[9,10,11,12]`.
- Artifacts:
  - Probe runner: `Scott/full-dashboard-performance-probe-2026-06-16/mobile-showcase-rotation-probe.mjs`.
  - Summary: `Scott/full-dashboard-performance-probe-2026-06-16/full-dashboard-mobile-scroll-after-showcase-rotation-summary.json`.
- Validation:
  - `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`28` tests).
  - `npm.cmd run type-check`: passed.
  - `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx styles/workspace-dashboard.css`: no TS errors; CSS file remains ignored by ESLint config.

## 2026-06-16 Continuation: Mobile And Tutorial API Latency

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Phone-width runtime still used normal tutorial playback when the browser reported enough hardware, so compact layout now uses the lite hero video and caps tutorial playback at `3` simultaneous videos.
- Desktop keeps the richer profile: perf hero video and `5` simultaneous tutorial videos.
- Public tutorial API now has server-side single-flight caching for `60 seconds`, matching the existing public `max-age=60` cache contract. This avoids repeated Supabase reads/signing on warm local/server instances.
- Public route also has client-side single-flight caching for `60 seconds` to avoid duplicate client fetches during remounts/dev strict mode and quick revisits.

Measured local evidence:

- Before this continuation, phone width played hero plus `5` tutorial thumbnails and used `homepage-hero-background-perf.mp4`.
- After compact tuning, phone width uses `homepage-hero-background-lite.mp4`, plays hero plus `3` tutorial thumbnails, and keeps `0` long frames in sampled top/tutorial windows.
- Direct local API calls after warm cache: first measured call `61.1 ms`, then `10.7 ms`, `10.1 ms`, `10.4 ms`.
- Warm page-load tutorial API request measured `24 ms`; tutorial cards were ready at `832 ms` in local dev.
- Full `dashboard.guest-route.test.tsx` still has stale copy/aesthetic expectations from the branch, but the specific live-endpoint behavior test passes.

## 2026-06-16 Continuation: Shared Tutorial Endpoint Cache

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Public and authenticated dashboard surfaces now share one client-side public tutorial endpoint reader.
- Runtime behavior: one in-flight `/api/dashboard/tutorials` request is shared across dashboard surfaces, and successful reads are cached for `60 seconds`.
- Test behavior: client cache bypasses `NODE_ENV=test` to avoid cross-test state leakage.
- Server API cache remains `60 seconds` and test-bypassed.

Measured local evidence:

- Public page load after shared helper: one `/api/dashboard/tutorials` request, measured `23 ms` warm.
- Tutorial cards ready at `730 ms` in local dev in the same run.
- Browser state after load: `15` tutorial cards present, one sourced hero video, no unexpected extra tutorial sources at the snapshot moment.

Validation:

- `npm.cmd run type-check`: passed.
- `npm.cmd run lint`: passed with existing warnings only.
- `npm.cmd run test -- dashboard-tutorials.test.ts videoPosterVariant.test.ts`: passed.
- `npm.cmd run test -- dashboard.guest-route.test.tsx -t "does not render static tutorial props before live endpoint hydration|hydrates public tutorial cards from the dashboard tutorials endpoint"`: passed.

## 2026-06-16 Continuation: Static Tutorial Hydration

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Root and anonymous dashboard pages now receive dashboard tutorial data through static props/ISR instead of always waiting for a client `/api/dashboard/tutorials` fetch.
- Safety basis: dashboard tutorial signed URLs are valid for `24h`, while the public pages revalidate every `60s`; the live endpoint remains as a fallback when the static snapshot is empty or unavailable.
- Authenticated dashboard receives the same static tutorial snapshot from the session-aware dashboard route and only falls back to the shared endpoint reader when no snapshot is present.
- Guest route tests now protect the faster static tutorial render and the thumbnail grid tests protect lazy loading beyond the active playback budget.

Measured local evidence:

- Before static hydration revisit, a cold page run measured `/api/dashboard/tutorials` at `350 ms` and tutorial cards ready at `1879 ms`.
- After static hydration, page load made `0` client `/api/dashboard/tutorials` requests, rendered `15` tutorial cards, and cards were ready at `1096 ms`.
- Top-frame sample after static hydration: p95 `8.5 ms`, max `8.6 ms`, `0` long frames.

Validation:

- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run lint`: passed with existing warnings only.

## 2026-06-16 Continuation: Poster Weight Reduction

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Browser measurement found another real load-path issue after static hydration: the hero video fallback still requested `homepage-misty-forest-hero-v1.png` at about `1.59 MB`.
- Added `homepage-misty-forest-hero-poster.webp` at `1280x720`, about `15 KB`, and pointed both the hero video `poster` and CSS fallback background to it.
- Browser measurement also showed all tutorial poster JPGs were in or near the first desktop viewport and transferred about `1.15 MB` total before the user interacted with the grid.
- Dashboard tutorial motion poster generation now uses `480px` max dimension and ffmpeg JPEG quality `5`, while keeping existing `poster.jpg` paths and `image/jpeg` metadata for schema compatibility.
- Regenerated all 15 active dashboard tutorial derivatives in the documented non-production project `bgdhqbenqltxildlgkyu` using `--apply --force --confirm-project-id bgdhqbenqltxildlgkyu`.

Measured local evidence:

- Before poster-profile backfill: first desktop sample showed known media/script bytes around `4.65 MB`; tutorial posters accounted for roughly `1.15 MB`; max poster was `144 KB`; old hero fallback PNG was still about `1.59 MB`.
- After hero poster swap and non-production tutorial poster backfill: known homepage/tutorial bytes measured `3.44 MB`; tutorial posters measured `387 KB` total; max poster `47 KB`; old `homepage-misty-forest-hero-v1.png` request count `0`.
- Frame sample after backfill: p95 `8.5 ms`; one dev/hydration long task remained in the sample.

Validation:

- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run lint`: passed with warnings only; warning count remained `23`.

## 2026-06-16 Continuation: Frozen Tutorial Thumbnails

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- User reported that some tutorial thumbnails were frozen and did not move.
- Live local browser inspection showed the issue was mostly scheduler behavior, not broken media:
  - Before this pass, compact/low-power public home capped visible tutorial playback at `3`.
  - Many in-view videos had no `src` and `preload="none"`, so they were intentionally poster-only.
  - During rotation, some videos could get a source, remain at `currentTime 0`, then rotate out before a visible frame painted.
- Fixes made:
  - Public home tutorial cap now allows `8` normal, `6` compact, and `5` low-power active thumbnails.
  - Compact layout now wins over low-power for tutorial cap selection, so low-power desktop rules do not force compact grids down to `3`.
  - Active scheduled thumbnails now use `preload="auto"` while inactive thumbnails stay `preload="none"`.
  - Rotation dwell increased from `2400 ms` to `5200 ms`; idle source release increased from `1200 ms` to `1800 ms`.
  - The video layer becomes visible only once metadata is loaded and the thumbnail is still scheduled; autoplay failure keeps the poster visible.
  - Public showcase cards opt out of `content-visibility: auto` because animated video children were producing stale/hidden paint behavior.

Measured local evidence:

- Mobile/compact Chrome pixel diff after the fix showed all six scheduled thumbnails visible and advancing.
- Pixel-diff changed ratios for the first six compact tiles over `700 ms`: `0.866`, `0.7931`, `0.7232`, `0.124`, `0.5944`, `0.3561`; unscheduled next-row tiles remained static at `0`.
- Compact frame-budget probe with six active videos: `maxFrameMs 16.9`, `p95FrameMs 8.6`, `0` frames over `50 ms`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`13` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Initial Tutorial Autoplay Deferral

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up top-load probes showed a recurring single max-frame outlier even when hero/tutorial media was blocked, which points to dev/browser startup or hydration noise rather than a single media asset.
- The sustained startup frame cost did change with tutorial video playback:
  - Mobile/desktop baseline top-load p95 was around `8.5 ms` with active tutorial thumbnails.
  - Blocking tutorial thumbnail media dropped top-load p95 to about `4.3 ms`.
  - This made immediate tutorial video autoplay the next actionable app-side cost, even though it was not the source of every max-frame outlier.
- Fixes made:
  - `DashboardTutorialGrid` now keeps tutorial videos poster-first for an initial `1400 ms` autoplay delay.
  - User engagement still wakes a thumbnail immediately; the delay gates automatic playback only.
  - Scroll pause behavior is centralized behind `DASHBOARD_TUTORIAL_SCROLL_SETTLE_MS` at `1400 ms` so thumbnails do not resume during the orbit reveal/scroll settle window.
  - Tests opt out of the startup delay where they are exercising scheduler behavior directly; the guest route test waits for the real delayed scheduling.

Measured local evidence after the fix:

- Mobile first `1200 ms` after `domcontentloaded`: `0` tutorial videos with `src`, `0` active tutorial videos, p95 `4.3 ms`.
- Desktop first `1200 ms` after `domcontentloaded`: `0` tutorial videos with `src`, `0` active tutorial videos, p95 `4.3 ms`.
- After the delay, thumbnails resume:
  - Mobile full follow-up window: `6` active tutorial videos, `6` tutorial videos with `src`, p95 around `8.4 ms`, usually `0` frames over `50 ms`.
  - Desktop full follow-up window: `8` active tutorial videos, `8` tutorial videos with `src`, p95 around `8.4-8.5 ms`, occasional single max-frame outliers remained.
- The remaining occasional max-frame outliers also appeared when media was blocked, so this pass improves sustained startup pressure but does not prove the entire latency goal complete.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`13` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Orbit Reveal Latency

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up local Chrome probes showed that the previous orbit paint deferral protected the immediate scroll frame, but the heavy animated orbit still produced a delayed reveal spike.
- Isolation results:
  - Baseline desktop scroll/reveal near orbit: early scroll max around `517 ms` in one probe before hardening; reveal could still hit `300-490 ms`.
  - Hiding the orbit subtree with test CSS dropped the early scroll window below `46 ms`, proving the orbit subtree was the cause.
  - Removing only tool paths or glow effects helped but still left large reveal spikes (`150-225+ ms`), so the issue was the overall animated/icon orbit DOM, not one selector.
- Fixes made:
  - Replaced the animated icon orbit with a lightweight static tool cloud.
  - Removed the `phosphor-react` orbit icon imports from `GuestDashboardView`, so the public route no longer pulls those icons for this section.
  - Reduced the orbit section reserved height from the old animated-stage footprint to `640px` desktop and `460px` mobile.
  - Kept idle/pending orbit states layout-preserving but hidden/animation-free until reveal.
  - Tutorial videos now pause immediately on scroll and wait `1400 ms` after scroll before resuming, so media decode does not overlap the orbit reveal.

Measured local evidence after the fix:

- Desktop orbit section: `8` static tool pills, `0` old `.public-home-orbit-tool` nodes, height `640px`.
- Mobile orbit section: `6` static tool pills, `0` old `.public-home-orbit-tool` nodes, height `460px`.
- Desktop scroll/reveal repeat trials:
  - Early scroll windows: max frame roughly `8.9-25.3 ms` in three trials and `41.5 ms` in one trial; `0` frames over `50 ms`.
  - Reveal/resume windows: p95 stayed about `5.5-8.3 ms`; most trials had `0` frames over `50 ms`, with occasional single headless frames around `62.6 ms`.
  - Post-resume windows were clean: max `16.5-25.6 ms`, `0` frames over `50 ms`.
- Mobile final probe:
  - Scroll early max `37.5 ms`, p95 `16.8 ms`, `0` frames over `50 ms`.
  - Reveal max `16.8 ms`, p95 `9.5 ms`, `0` frames over `50 ms`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`13` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Frozen Thumbnail Wake-Up

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up issue: some thumbnails still looked frozen because non-scheduled videos were poster-only and direct hover/focus/touch intent was still effectively gated by the autoplay scheduler.
- `DashboardTutorialGrid` now lets all nearby thumbnails participate in the rotation over time while keeping the simultaneous autoplay cap at `5`.
- User-engaged cards now wake immediately, load their video source, retry playback on `canplay`, and replace one scheduled autoplay slot so the total moving-thumbnail count stays capped.
- The rotation interval was tightened from `3600 ms` to `2400 ms` so visible thumbnails do not wait as long for a motion turn.

Measured local evidence:

- Chrome local probe against `http://localhost:3000/`: target card `Insert Products, Items, & Outfits` started as poster-only (`hasSrc: false`, `paused: true`, `preload: none`).
- After hover: same card reported `hasSrc: true`, `paused: false`, `currentTime: 0.96`, `readyState: 4`, `preload: metadata`.
- The hover wake-up replaced a scheduled slot: `activePlayingCount: 5`, `sourcedCount: 6`.

Validation:

- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Visible Thumbnail Priority And Compact Budget

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Fresh desktop probe found a user-visible scheduling bug: at page top, thumbnail cards `0-4` were visible but paused while cards `5-9` just below the viewport were playing.
- `DashboardTutorialGrid` now builds autoplay candidates from actually visible cards first (`viewportRatio > 0.05`) before falling back to merely near-viewport cards.
- Added a regression test that proves visible thumbnails win playback slots over offscreen-but-near thumbnails.
- Fresh desktop probe then found a second visible freeze: at `scrollY=700`, tutorial cards were still visible but all tutorial videos were paused because the orbit section had become "near".
- `GuestDashboardView` now tracks actual section viewport coverage and only lets orbit proximity pause tutorial playback after the showcase is mostly gone (`showcaseViewportRatio < 0.18`).
- Mobile probe found compact layout still used the desktop autoplay budget; compact layout now uses the low-power autoplay budget (`3`) while keeping max simultaneous tutorial videos at `3`.

Measured local evidence:

- Before visible-priority fix at page top: `playingTutorialVideos: 5`, but the playing set was below the viewport while visible cards `0-4` were paused.
- After visible-priority fix at page top: `visiblePlayingIndexes: [0,1,2,3,4]`, `offscreenPlayingIndexes: []`, p95 frame time `8.5 ms`.
- Before refined orbit pause at `scrollY=700`: `playingTutorialVideos: 0` while tutorial cards were still visible and orbit animations were running.
- After refined orbit pause at `scrollY=700`: `visiblePlayingIndexes: [5,6,7,8,9]`, `offscreenPlayingIndexes: []`, p95 frame time `8.5 ms`, max `8.6 ms`.
- Mobile compact probe before budget fix: total media `5.37 MB`, tutorial video media `3.67 MB`, `sourcedTutorialVideos: 12`.
- Mobile compact probe after budget fix: total media `3.93 MB`, tutorial video media `1.50 MB`, `sourcedTutorialVideos: 6`, `playingTutorialVideos: 3`, no offscreen tutorial playback, p95 frame time `8.5 ms`.

Validation:

- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`32` tests).
- `npm.cmd run lint`: passed with existing warnings only; warning count remained `23`.
- `git diff --check`: passed with CRLF notices only.

## 2026-06-16 Continuation: 360px Tutorial Motion Derivatives

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- After the scheduler fixes, browser probes still showed tutorial display MP4s as the largest remaining homepage media cost.
- Proxy assessment: stable proxies may help cache churn for signed Supabase URLs, but they do not reduce first-time bytes or decode work. The evidence pointed first at smaller thumbnail derivatives.
- Dashboard tutorial motion derivative profile changed from `540px / 30fps / CRF 30` to `360px / 20fps / CRF 32`.
- Updated upload/finalize tests so new admin uploads generate the lighter derivative profile.
- Dry-run backfill against confirmed non-production project `bgdhqbenqltxildlgkyu` generated all `15` active display MP4s at `1,574,356` bytes total (`1.54 MB`), max `259,591` bytes, average `104,957` bytes.
- Applied guarded backfill only to confirmed project `bgdhqbenqltxildlgkyu` using `--apply --force --confirm-project-id bgdhqbenqltxildlgkyu`.

Measured local evidence:

- API after cache expiry returned new non-production variant paths such as `tutorial-thumbnail-variants/a1c40d6d-f8b4-4a2a-9b74-0920a60063e7/display.mp4`.
- Desktop full scroll probe after backfill: tutorial display media `1,574,356` bytes, poster bytes `387,312`, total media `2,847,492`; visible tutorial playback stayed correct and p95 frame time stayed around `8.5 ms`.
- Mobile compact probe after backfill: tutorial display media `623,080` bytes in the sampled path, down from `1,498,935` bytes before this derivative backfill; total media `3,055,351`; no offscreen tutorial playback; p95 frame time `8.5 ms`.
- Browser metadata confirmed active thumbnail videos are `360x360`, ready, and playing.

Validation:

- `npm.cmd run test -- admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts`: passed.
- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`32` tests).
- `npm.cmd run lint`: passed with existing warnings only; warning count remained `23`.
- `git diff --check`: passed with CRLF notices only.

## 2026-06-16 Continuation: Stable Tutorial Thumbnail Delivery

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Repeat-reload probe after the 360px derivative pass found that browser-visible media no longer had huge tutorial files, but Supabase signed thumbnail URLs still appeared as cache misses on each load.
- Added stable public delivery URLs: `/api/dashboard/tutorial-thumbnail?path=...`.
- Public/static dashboard tutorial payloads now opt into stable delivery URLs, while admin tutorial reads keep their signed URL behavior.
- The delivery route validates dashboard tutorial thumbnail storage paths, signs server-side for a short upstream URL, returns cacheable public media, supports `HEAD`, `ETag`, `immutable` browser cache headers, and byte-range responses for video.
- The route also has a small in-memory server cache (`8 MB`, `10 min`) for currently hot tutorial thumbnails.

Measured local evidence:

- Local `/api/dashboard/tutorials` now returns stable URLs such as `/api/dashboard/tutorial-thumbnail?path=tutorial-thumbnail-variants%2Fa1c40d6d-f8b4-4a2a-9b74-0920a60063e7%2Fdisplay.mp4`.
- Browser same-context reload probe: `supabaseCount: 0`, `supabaseTransfer: 0` for tutorial media.
- First proxy load in the probe: tutorial local transfer `953,947` bytes with cacheable responses.
- Same-context reload: tutorial local transfer `501,883` bytes; poster resources showed `transferSize: 0` from browser cache, while videos still issued some range transfers.
- Playback state remained correct: `playingTutorialVideos: 5`, visible indexes `[10,11,12,13,14]` in the lower-showcase sample.
- Important nuance: this proxy fixes signed-URL churn and repeat-cache behavior; the previous 360px derivative pass remains the main first-time-byte reduction.

Validation:

- `npm.cmd run test -- dashboard-tutorial-thumbnail-proxy.test.ts dashboard-tutorials.test.ts`: passed.
- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts dashboard-tutorial-thumbnail-proxy.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`36` tests).
- `npm.cmd run lint`: passed with existing warnings only; warning count remained `23`.
- `git diff --check`: passed with CRLF notices only.

## 2026-06-16 Continuation: Low-Power Thumbnail Rotation Fix

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Fresh local browser probe found the remaining frozen-thumbnail symptom at the default in-app browser viewport: all `15` tutorial thumbnails were visible, but the low-power path had `autoPlayBudget=3` and `maxSimultaneousVideos=3`.
- In `DashboardTutorialGrid`, `autoPlayBudget` is the visible candidate pool size, not the simultaneous playback cap. Because both values were `3`, only indexes `[0,1,2]` ever entered the low-power rotation while the rest stayed poster-only until scrolling changed the visible candidate ordering.
- `GuestDashboardView` now keeps the candidate pool at up to `15` tutorials for all power/layout modes, while low-power and compact modes still cap simultaneous playback at `3`.
- This preserves the decoder/network cap but lets every visible thumbnail get a turn.

Measured local evidence:

- Before the fix at the default localhost viewport: `visible` indexes were `[0..14]`, while `playing` stayed `[0,1,2]` at both `+1.2s` and `+4.0s`.
- After the fix at the same viewport: `+1.3s` played `[0,1,2]`, `+4.1s` played `[3,4,5]`, and `+6.9s` played `[6,7,8]`; simultaneous playback remained capped at `3`.

Validation:

- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`11` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Offscreen Thumbnail Source Cleanup

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up code inspection after the rotation fix found a quieter lag source: `DashboardTutorialVideoThumbnail` kept `hasLoadedSource=true` forever once a video loaded.
- That helped instant replay, but after scrolling through the page it could leave old offscreen tutorial videos with live `src`/poster/preload state even though only a few videos should be active.
- `DashboardTutorialGrid` now releases an idle video source after the thumbnail has been offscreen or the document has been hidden for `1200 ms`.
- Visible thumbnails still retain their loaded source during the rotation, so the frozen-thumbnail fix is preserved and visible cards do not repeatedly unload/reload while taking turns.

Validation:

- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed (`5` tests).
- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`12` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Visible Paused Thumbnail Source Cleanup

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- System Chrome was available locally at `C:/Program Files/Google/Chrome/Application/chrome.exe`, so this pass used a real headless Chrome probe against `http://localhost:3000/` instead of the in-app browser tab that had injected `body{display:none}`.
- The Chrome probe found the remaining source-retention issue on mobile: after rotation, only three videos were playing, but visible paused thumbnails kept live `src` attributes and ready media state.
- Before this tightening, mobile at `+7s` had `playing: [6,7,8]` but accumulated sourced/ready thumbnails `[0..8]`.
- `DashboardTutorialGrid` now releases any paused thumbnail source after `1200 ms`, not only offscreen thumbnails. The poster image remains visible, and only actively scheduled or user-engaged thumbnails keep a video `src`.
- This keeps the motion cap meaningful on dense mobile layouts where many tutorial rows are technically visible at once.

Measured local evidence:

- After the change, the same mobile Chrome probe showed actual `src` attributes stay bounded by the current active group plus brief handoff overlap:
  - `+1s`: `attrSourced [0,1,2]`, `playing [0,1,2]`
  - `+4s`: `attrSourced [3,4,5]`, `playing [3,4,5]`
  - `+7s`: `attrSourced [6,7,8]`, `playing [6,7,8]`
  - `+10s`: `attrSourced [0,1,2,9,10,11]`, brief handoff overlap while release timers settle

Validation:

- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed (`5` tests).
- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`12` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Mobile Hero Double-Fetch Fix

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Real local Chrome measurement found that mobile was loading both hero videos: the desktop `homepage-hero-background-perf.mp4` first, then the compact/lite `homepage-hero-background-lite.mp4` after the client compact-layout effect ran.
- That meant mobile paid roughly `1.27 MB` for the desktop hero plus roughly `1.16 MB` for the lite hero.
- `GuestDashboardView` now treats lite/compact motion as unresolved during the first client pass and renders the hero poster without a `<source>` until those decisions resolve.
- Once resolved, compact/mobile attaches only `/dashboard/homepage-hero-background-lite.mp4`; desktop attaches only `/dashboard/homepage-hero-background-perf.mp4`.
- Added a regression test that verifies compact layout resolves to the lite hero source rather than the perf hero source.

Measured local evidence:

- Before the fix, mobile `1s` bucket included both `heroPerfVideo` (`1,273,436` transfer bytes) and `heroLiteVideo` (`1,159,435` transfer bytes).
- After the fix:
  - `mobile+1.2s`: hero poster present, no hero video bytes yet, selected source `/dashboard/homepage-hero-background-lite.mp4`.
  - `mobile+5.2s`: `heroLiteVideo` `1,159,435` transfer bytes; `heroPerfVideo` absent.
  - `desktop+1.2s`: `heroPerfVideo` present and selected; `heroLiteVideo` absent.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`13` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Mobile Hero Re-Encode

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up local asset inspection found that `homepage-hero-background-lite.mp4` was still `1,159,135` bytes, `960x540`, `20 fps`, about `515 kb/s`.
- Generated mobile candidates under `Scott/mobile-hero-candidates-2026-06-16/` using bundled `ffmpeg-static`.
- Candidate comparison:
  - Current lite: `1,159,135` bytes, `960x540`, `20 fps`, about `515 kb/s`.
  - `720x406`, `15 fps`, about `320 kb/s`: `725,292` bytes.
  - `640x360`, `15 fps`, about `260 kb/s`: `592,551` bytes.
- A contact sheet at mobile display width is saved at `Scott/mobile-hero-candidates-2026-06-16/mobile-hero-contact-sheet.png`.
- The `640x360 / 15 fps / 260 kb/s` candidate was visually acceptable at mobile display width and replaced `frontend/public/dashboard/homepage-hero-background-lite.mp4`.

Measured local evidence:

- Real local Chrome mobile probe after replacement selected `/dashboard/homepage-hero-background-lite.mp4`.
- `heroLite` transfer dropped to `592,851` bytes with encoded body `592,551` bytes.
- `heroPerf` remained absent on mobile.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`13` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Orbit Scroll Paint Deferral

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Real local Chrome scroll probes still showed a large one-frame spike when jumping from the tutorial grid toward the lower orbit section.
- Isolation results:
  - Baseline desktop scroll to `900`: max frame about `495.8 ms`, `2` frames over `50 ms`.
  - `orbit-visibility-hidden` while preserving layout height: max frame about `28.9 ms`, `0` frames over `50 ms`.
  - `orbit-opacity-zero` while preserving layout height: max frame about `24.9 ms`, `0` frames over `50 ms`.
  - Hiding tutorial videos did not remove the spike, which kept the cause tied to orbit paint/compositing rather than media loading.
- `GuestDashboardView` now tracks page scroll settling and delays orbit paint readiness until the orbit is near viewport and scroll has been settled for a short delay.
- CSS class `public-home-orbit-paint-pending` keeps orbit layout reserved but opacity `0`, pointer-events disabled, and orbit animations paused during the scroll frame.

Measured local evidence after the fix:

- Desktop scroll to `900`: first `350 ms` after scroll had max frame `8.4 ms`, `0` frames over `50 ms`; the remaining orbit paint occurred later after scroll settle.
- Mobile scroll to `795`: first `350 ms` after scroll had max frame `8.4 ms`, `0` frames over `50 ms`; the deferred orbit paint occurred later after scroll settle.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`13` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Desktop Hero And Orbit Overlap

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Remaining measured top-load item after poster backfill was the desktop hero MP4: `homepage-hero-background-perf.mp4` at `2.24 MB`, `1280x720`, `24 fps`, about `996 kbps`.
- Re-encoded the active desktop hero file to constrained H.264 Main at `1280x720`, `20 fps`, about `600 kbps`; resulting file is `1.27 MB`.
- Visual sample frames were saved under `Scott/hero-video-compare-2026-06-16/`; the `520k` candidate was visibly blockier, so the `600k` encode was kept.
- Full-page scroll sweep then found an overlap issue: when the orbit section approached view, tutorial videos could keep playing while orbit animations were also running.
- Public homepage orbit tool count now caps at `12` on wide desktop instead of `18`.
- `DashboardTutorialGrid` now accepts a parent pause gate, and the public showcase pauses tutorial videos whenever the orbit section is near view.

Measured local evidence:

- After the hero re-encode, browser network saw `/dashboard/homepage-hero-background-perf.mp4` at `1,273,136` bytes, still `1280x720`.
- Known homepage/tutorial bytes in the same sample measured `2.47 MB`, down from the earlier `3.44 MB` sample after poster backfill.
- Full-page scroll sweep after orbit/video-overlap fix: orbit tool count `12`; orbit section had `24` running animations and `0` playing videos; page-level p95 frame time `8.5 ms`.
- One local dev/hydration long task remained near initial load in the browser samples.

Validation:

- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorials.test.ts admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed.
- `npm.cmd run lint`: passed with warnings only; warning count remained `23`.

## 2026-06-16 Continuation: Frozen Thumbnail Scheduling

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Live local browser probing showed the thumbnail proxy path was serving and playable, but the scheduler was starting playback with the visible cards nearest the viewport center. On the public showcase that could leave the first visible rows on posters while lower visible rows moved, which looked like frozen thumbnails.
- `DashboardTutorialGrid` now records each thumbnail video's viewport top position and uses top-to-bottom order as the tie-breaker after visibility ratio. The first thumbnails a user scans now receive the initial playback budget, while the simultaneous playback cap still protects latency.
- Added a regression test that renders two equally visible rows and asserts the earliest visible thumbnails get the initial active sources before lower rows.
- Removed the last leftover old animated orbit CSS selectors after the static tool cloud replacement; `public-home-orbit-tool`, old orbit paths, and ring selectors no longer match in the active CSS/markup.

Measured local evidence:

- Local browser probe on `http://localhost:3000/` after reload: first visible tutorial indexes `0-5` had `data-playing="true"`, `opacity: 1`, `preload="auto"`, `readyState: 4`, and advanced over the sample interval.
- Lower queued visible rows had no video source and `opacity: 0`, so they stay on poster fallback instead of presenting paused video frames.
- Old orbit DOM count was `0`; new static tool pills rendered (`6` in the compact local browser sample).

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`14` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Desktop Tutorial Media Budget

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Fresh local Playwright probes showed scroll jank was mostly controlled: desktop initial p95 frame time was about `8.4 ms`, desktop scroll samples stayed below `50 ms`, and mobile scroll samples stayed below `50 ms`.
- The remaining measurable pressure was initial media bytes. Desktop still started up to `8` public tutorial thumbnail videos even though the first visible desktop row has `5` cards.
- Reduced the public desktop tutorial simultaneous playback cap from `8` to `5`, matching the shared grid default. Compact remains `6`, preserving the verified mobile/compact six-thumbnail motion behavior.

Measured local evidence:

- Before this cap adjustment, a desktop local sample loaded about `513 KB` of tutorial thumbnail video during the initial window, in addition to the `1.27 MB` desktop hero.
- After the cap adjustment, a desktop local sample loaded `322,020` bytes of tutorial thumbnail video, with total video transfer `1,610,856` bytes including the hero.
- Desktop browser probe after the change: exactly tutorial indexes `0-4` had active sources and were moving; no second-row tutorial videos were active during the initial sample.
- Frame sample after the change: max frame `8.5 ms`, p95 `8.4 ms`, `0` frames over `50 ms`.
- Mobile browser probe remained correct: six compact tutorial thumbnails active and moving, lite hero transfer `592,851` bytes, desktop hero transfer `0` bytes.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`14` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Hero Video Skip Gate

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Quick-scroll local probe found a wasted desktop hero video load: after jumping to `scrollY 950`, the hero was offscreen and paused, but `/dashboard/homepage-hero-background-perf.mp4` still transferred `1,273,436` bytes.
- `GuestDashboardView` now starts the hero viewport observer as unresolved/not-near and only attaches the selected hero MP4 source while the hero is near the viewport and the document is visible.
- The poster remains available immediately, so skipping the hero no longer forces the large video transfer.

Measured local evidence:

- Normal desktop top-of-page load still attached and played `/dashboard/homepage-hero-background-perf.mp4`.
- Valid quick-skip probe waited until the page was scrollable, scrolled to `950`, and confirmed: hero source absent, `heroCurrentSrc` empty, `readyState 0`, hero rect offscreen, and desktop hero MP4 transfer `0` bytes.
- The same quick-skip sample still loaded only the lightweight hero poster plus tutorial videos for the section in view.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`14` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Hero Source Attach Delay

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- A fresh post-fix probe showed a narrower waste case: if the page stayed at the top for about the first half-second and then jumped to the showcase, the desktop hero source could attach before the scroll and still transfer `1,273,436` bytes.
- Added a cancellable `900 ms` hero source attach delay. The hero poster still appears immediately, but the MP4 only attaches after the hero remains near viewport and the document visible through the delay.
- The existing compact hero source regression now also asserts that the hero starts poster-first with no immediate `<source>`.

Measured local evidence:

- Normal desktop top-of-page still loaded and played `/dashboard/homepage-hero-background-perf.mp4`; in the verification sample the hero video started around `2053 ms`.
- Quick-skip desktop probe waited until the page was scrollable, scrolled to `950`, and sampled after `2400 ms`: hero source absent, `heroCurrentSrc` empty, `readyState 0`, paused, and desktop hero MP4 transfer `0` bytes.
- In the same quick-skip sample, only the lightweight hero poster and in-view tutorial videos loaded.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`14` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed with no warnings.

## 2026-06-16 Continuation: Deferred Tutorial Poster Images

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Fresh local browser measurement showed all `15` tutorial poster images were fetched on initial desktop load, even though only `10` poster tiles were visible or partially visible. The five fully below-fold posters accounted for about `109 KB` of avoidable initial transfer.
- `DashboardTutorialVideoThumbnail` now renders poster images only for the first `10` tutorial video cards, near-viewport cards, active/loading cards, or reduced-motion clients. This keeps the first visible scan area populated while deferring fully below-fold poster requests.
- Added a regression test that confirms normal-motion grids with more than `10` video tutorials only render the initial poster budget before intersection.

Measured local evidence:

- Before the change: initial desktop load fetched `15` tutorial poster images, `391,812` transfer bytes.
- After the change: initial desktop load fetched `10` tutorial poster images, `282,265` transfer bytes, with `10` rendered and complete visible/partial-visible poster images.
- Scroll verification to `scrollY 950`: all `15` poster images rendered after they became relevant; `10` visible images were complete, with `0` incomplete visible posters.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`15` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Mobile Poster Visibility Gate

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up mobile measurement found the first poster deferral pass still fetched all `15` tutorial posters on initial mobile load. The video observer's `120px` root margin correctly prewarmed scheduling, but it also made offscreen poster cards count as near.
- `DashboardTutorialVideoThumbnail` now stores the actual viewport-visible ratio from the observer and uses visible pixels, not root-margin intersection, to render poster images beyond the initial budget.
- Added regression coverage for cards inside the observer root margin but with zero visible pixels; those cards no longer render poster images until they actually enter view.

Measured local evidence:

- Desktop initial behavior remained stable: `10` poster requests, `282,265` poster bytes, no visible cards missing poster/video.
- Mobile initial behavior improved from `15` poster requests / `391,812` poster bytes to `12` poster requests / `334,651` poster bytes.
- Mobile initial sample had `12` rendered visible posters, `0` incomplete visible posters, and `0` visible cards missing both poster and video.
- Mobile scroll sample later rendered all `15` posters when relevant, with `0` visible blank poster slots.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`15` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Faster Offscreen Video Source Release

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Mobile scroll probe showed a decode/memory overlap after scrolling from the top tutorial rows: the old top-row videos stayed `readyState >= 2` while newly visible rows started loading, briefly leaving up to `12` tutorial videos attached/ready.
- Reduced `DASHBOARD_TUTORIAL_SOURCE_IDLE_RELEASE_MS` from `1800 ms` to `700 ms`, which is shorter than the `1400 ms` scroll-settle autoplay gate. This releases offscreen video sources before the next visible set wakes up.
- Tightened the source-release regression test to expect cleanup after the faster delay.

Measured local evidence:

- Before the change: after mobile scroll, indexes `0-5` stayed ready at `1500 ms` while indexes `6-8` and `12-14` were also ready/playing.
- After the change: at `900 ms` after scroll there were `0` ready tutorial videos; at `1500 ms` the old offscreen videos had `readyState 0`; at `2300 ms` only the newly visible set was ready/playing.
- Visible playback still resumed after scroll settle.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`15` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Staggered Tutorial Autoplay Wake-Up

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up desktop probe found a remaining scroll handoff risk: the old visible videos released correctly, but the newly visible tutorial videos could still wake on the same frame after scroll settle.
- `DashboardTutorialGrid` now staggers automatic playback/source wake-up by `140 ms` per scheduled thumbnail while preserving immediate hover/focus/touch wake-up.
- This keeps the simultaneous playback cap at `5`, avoids changing production infrastructure, and spreads media decode work across frames instead of creating one synchronized decode burst.
- Proxy conclusion: the app already uses the public `/api/dashboard/tutorial-thumbnail?path=...` proxy for stored thumbnail derivatives. A proxy helps when it gives stable cacheable derivative URLs and range support; a generic proxy around larger/original media would not fix decode pressure and can make cold range requests worse.

Measured local evidence:

- Before the stagger, the desktop tutorial scroll sample had one long frame: max about `91.7 ms`, p95 otherwise low, `1` frame over `50 ms`.
- After the stagger, local Chrome probe against `http://127.0.0.1:3000/` at `1440x900` scrolled to `950` and reported scroll frames: max `12.6 ms`, p95 `8.3 ms`, `0` frames over `32 ms`, `0` frames over `50 ms`.
- Before scroll, sourced/playing thumbnails were `[0,1,2,3,4]`; after scroll, old sources were released and sourced/playing thumbnails were `[10,11,12,13,14]`.
- Moving check over `850 ms`: active thumbnails advanced by about `0.857-0.858 s`; `stuckPlaying` was empty.

Validation:

- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed (`7` tests).
- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`15` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Viewport-Fresh Tutorial Playback Ordering

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up mobile probing found another real frozen-thumbnail pattern: after scrolling into the tutorial grid, lower thumbnails could move while fully visible middle thumbnails stayed poster-only.
- Root cause: `IntersectionObserver` did not reliably refresh every thumbnail's `viewportTop` during scroll, so the rotation scheduler could use stale row positions.
- `DashboardTutorialVideoThumbnail` now refreshes its measured viewport state with a requestAnimationFrame-throttled scroll/resize measurement, while ignoring zero-size test-environment rects.
- Playback candidate sorting now favors substantially visible scan rows (`>= 50%` visible), then top-to-bottom order, before falling back to lower-visibility rows. This prevents tiny partial rows from starving the main visible row on desktop.
- Rotation reset is derived from the candidate-list key rather than a synchronous state reset effect, keeping eslint's runtime hook guard clean.
- Added regression coverage for:
  - top visible rows winning over lower rows,
  - top rows with more than half their pixels visible winning over lower fully visible rows,
  - rotation restarting at the earliest visible thumbnails after the candidate set changes.

Measured local evidence:

- Before this pass, mobile at `scrollY 520` had moving thumbnails `[3,4,5,12,13,14]`, leaving visible poster-only holes `[6,7,8,9,10,11]` between moving rows.
- After this pass, mobile at `scrollY 520` played `[3,4,5,6,7,8]`; `holes: []`; `stuckPlaying: []`; frame sample max `20.8 ms`, p95 `8.4 ms`, `0` frames over `50 ms`.
- Desktop at `scrollY 950` now plays the fully visible row `[10,11,12,13,14]` instead of the tiny partial row above; `holes: []`; `stuckPlaying: []`; frame sample max `8.2 ms`, p95 `4.3 ms`, `0` frames over `50 ms`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`17` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Compact Low-Power Tutorial Video Cap

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- A 4x CPU-throttled mobile isolation probe showed tutorial video decode was still the app-side pressure point on weaker mobile profiles:
  - Normal compact path: six tutorial videos sourced/playing; scroll p95 measured up to `12.5 ms` in one run with multiple `>50 ms` frames.
  - Reduced/hide-video comparisons dropped scroll p95 to about `4.3 ms`, showing the pressure was tied to active tutorial video rendering/decoding more than static layout.
- `GuestDashboardView` now uses `3` max simultaneous tutorial videos when compact layout and lite/low-power motion are both active.
- Normal compact/mobile remains at `6` simultaneous tutorial videos, so capable phones keep the richer motion behavior.
- Added a guest route regression that forces compact + `(update: slow)` and verifies only the first three tutorial thumbnails source video.

Measured local evidence:

- Local Chrome mobile with 4x CPU throttle, normal compact path: sourced/playing tutorial indexes `[3,4,5,6,7,8]`.
- Local Chrome mobile with 4x CPU throttle and `(update: slow)` forced: `.public-home-lite-motion` active, sourced/playing tutorial indexes `[3,4,5]`, ready video count `3`.
- This halves active mobile tutorial decode on low-power compact clients while preserving normal compact behavior.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`18` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Batched Tutorial Viewport Measurement

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- The viewport-fresh ordering fix initially used one scroll/resize listener per video thumbnail, which kept ordering correct but was not the best scroll-cost shape.
- `DashboardTutorialGrid` now owns one requestAnimationFrame-throttled viewport refresh for the whole grid.
- Thumbnail videos carry `data-dashboard-tutorial-index`, and the parent batches `getBoundingClientRect()` reads for all tutorial videos from the grid ref.
- The per-thumbnail scroll/resize listener was removed; IntersectionObserver still owns near-viewport entry/exit and poster visibility.
- Added a regression that renders six video thumbnails and verifies the grid component registers one window scroll listener, preventing accidental return to per-thumbnail listeners.

Measured local evidence:

- Mobile local Chrome at `390x844`, `scrollY 520`: playing tutorial indexes `[3,4,5,6,7,8]`; `holes: []`; `stuckPlaying: []`; frame max `25 ms`, p95 `8.4 ms`, `0` frames over `50 ms`.
- Desktop local Chrome at `1440x900`, `scrollY 950` after settle: fully visible row `[10,11,12,13,14]` sourced/playing; `stuckPlaying: []`.
- The browser still has other page-level scroll listeners, but the tutorial grid itself is now guarded by test coverage at one scroll listener for the grid.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`19` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Model Marquee Pause And Frozen Thumbnail Resume

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- A 4x CPU-throttled isolation probe showed the model-logo marquee was a real remaining scroll contributor: disabling it reduced long scroll frames on both mobile and desktop samples.
- `GuestDashboardView` now applies `public-home-models-idle` while page scrolling, so the marquee pauses during scroll instead of competing with thumbnail/video work.
- Low-power/lite motion now removes the model marquee animation entirely (`animation: none`) instead of only slowing it down.
- The same probe exposed a more direct frozen-thumbnail issue: mobile positions around `scrollY 420-695` still showed tutorial rows on screen while every video source had been removed.
- Root cause: the outer page paused all tutorial playback when the orbit section entered the viewport, even while the tutorial grid still had visible rows. The grid's own capped scheduler is now responsible for choosing visible videos; the outer page only pauses tutorials when the showcase is not near the viewport.
- The grid scroll pause is now explicit React state for thumbnails, keeps already-loaded sources warm while scrolling, and resumes playback after an `820 ms` settle window instead of the old `1400 ms` frozen-feeling pause.
- Added regression coverage for:
  - pausing the model marquee while the page scrolls,
  - keeping loaded visible tutorial thumbnails sourced during scroll,
  - resuming those thumbnails after scroll settles.

Measured local evidence:

- In-app browser at `http://127.0.0.1:3000/`: top of page had model animation running; after scroll, `.public-home-models public-home-models-idle` was present and computed `animationPlayState` was `paused`; back at top after settle, it returned to running.
- Before the tutorial pause fix, mobile `390x844` around `scrollY 420-695` had visible tutorial rows but `sourced: []`, leaving frozen posters.
- After the fix, mobile `390x844`, `scrollY 620` after settle: `sourcedTutorialVideos: 6`, `playingTutorialVideos: 6`, playing indexes `[6,7,8,9,10,11]`.
- Mobile normal 4x CPU final probe: early frames max `33.4 ms`, p95 `12.5 ms`, `0` over `50 ms`; scroll sample p95 `37.5 ms`; settled state had six tutorial videos playing.
- Mobile lite 4x CPU final probe: `.public-home-lite-motion` active, model animation name `none`, early p95 `4.3 ms`, and no tutorial videos sourced by design.
- Desktop normal 4x CPU final probe: early frames max `16.8 ms`, p95 `16.6 ms`, `0` over `50 ms`; marquee paused during scroll and resumed when the model section was near viewport after settle.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`21` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Compact Mobile Decode Burst Reduction

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up 4x CPU mobile isolation showed tutorial video work was still a measurable contributor:
  - Baseline mobile sample with tutorial media active: scroll p95 around `45.9 ms`, `7` frames over `50 ms`, with `12` tutorial display-video requests.
  - Aborting tutorial videos dropped scroll p95 to about `33.5 ms`, showing decode/load pressure still mattered even after the frozen-thumbnail fixes.
  - Hiding the orbit also improved scroll p95, so this is not the final performance pass; the orbit/tutorial transition still deserves more profiling.
- Compact/mobile normal playback now caps simultaneous tutorial thumbnails at `4` instead of `6`.
- Compact/mobile low-power remains capped at `3`, and desktop remains at `5`.
- Tutorial autoplay staggering increased from `140 ms` to `180 ms` so row resume is less bursty after scroll settle.
- Added a normal compact route regression that verifies compact mobile only sources the first four video thumbnails; the existing compact low-power test still verifies the three-video cap.

Measured local evidence after this pass:

- Mobile normal 4x CPU at `390x844`: early max `20.8 ms`, p95 `8.4 ms`, `0` frames over `50 ms`; scroll sample max `75 ms`, p95 `33.4 ms`, `7` over `50 ms`; settled with `4` sourced/playing videos at indexes `[6,7,8,9]`; display-video requests dropped to `8`.
- Mobile lite 4x CPU: model animation name `none`, `0` videos sourced/playing by design, early p95 `4.3 ms`, scroll p95 `12.5 ms`.
- Desktop normal 4x CPU: early p95 `8.5 ms`, scroll p95 `33.2 ms`, settled with `5` sourced/playing videos.
- This pass reduced compact mobile decode pressure and request burst size, but the goal is not complete: scroll samples still have long frames around the showcase/orbit transition.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`22` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Scroll-Burst Pause And Mobile Paint Reduction

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up profiling focused on the remaining showcase/orbit transition spikes.
- Orbit paint was not proven to be the main source: hiding/simplifying the orbit section had noisy results and did not consistently remove long frames.
- Mobile tutorial card paint was a stronger suspect in one isolation pass: hiding poster layers and stripping card overlay/clip-path paint reduced one scroll p95 sample from about `58.4 ms` to about `29.1 ms`.
- Mobile tutorial card CSS now avoids `clip-path`, heavy card transforms, the decorative card `::after` overlay, and the title accent line; it keeps a simpler readable title gradient and lighter shadow.
- Wheel-style scroll probes exposed repeated scroll-burst work:
  - The grid previously queried and paused all videos on every scroll event in a burst.
  - `DashboardTutorialGrid` now edge-triggers scroll pause once per burst using a ref, while keeping the requestAnimationFrame viewport refresh batched.
  - `usePageScrollSettled` now also edge-triggers its scrolling state instead of setting `true` on every scroll event.
- Fast wheel scroll also exposed stale-source overlap after settle: some runs ended with `8` sourced thumbnail videos while the compact cap should be `4`.
- Idle video source release after settle is now `260 ms` instead of `700 ms`, while sources remain warm during active scroll pause.
- Added a regression that repeated scroll events in the same burst do not repeatedly pause every thumbnail video.

Measured local evidence after this pass:

- Tests verify repeated scroll events in one burst pause a three-video grid once for that burst, then pause again after the settle window.
- Mobile rendered CSS check at `390x844`: first tutorial card had `clip-path: none`, `transform: none`, lighter shadow, and the simplified title gradient.
- Wheel-style mobile 4x CPU after source-release reduction, four runs:
  - Average p95 `80.2 ms`, average max `157.3 ms`, average `10.8` frames over `50 ms`.
  - All four runs settled at exactly `4` sourced and `4` playing videos, indexes `[9,10,11,12]`.
- This fixes the sourced-video overlap and reduces repeated scroll-burst pause work, but the goal is still not complete: wheel-style scroll remains visibly too expensive under 4x CPU throttle.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`23` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Defer Thumbnail Layout Reads Until Scroll Settle

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- The previous wheel-style probe showed that repeated scroll bursts were still too expensive even after pause work was edge-triggered.
- Root cause found in `DashboardTutorialGrid`: every scroll event still scheduled a requestAnimationFrame viewport refresh, and that refresh read `getBoundingClientRect()` for every tutorial video during active scrolling.
- Since thumbnails are paused during scroll bursts, the grid no longer needs to continuously recompute video viewport state while the scroll is active.
- `DashboardTutorialGrid` now defers the batched video rect measurement until the scroll-settle timeout, immediately before autoplay is allowed to resume.
- Resize still uses the existing requestAnimationFrame-batched viewport refresh.
- Added regression coverage that fires repeated scroll events and verifies video `getBoundingClientRect()` is not called until the settle window elapses.
- A speculative post-settle play retry was tested and removed because it did not improve the browser proof.

Measured local evidence:

- Before deferring layout reads, four wheel-style mobile 4x CPU runs averaged p95 `80.2 ms`, max `157.3 ms`, `10.8` frames over `50 ms`.
- After deferring layout reads, a four-run wheel probe averaged p95 `50.0 ms`, max `127.1 ms`, `9.0` frames over `50 ms`; all runs settled at `4` sourced videos, with average `3.5` playing.
- Final two-run sanity check after removing the speculative retry: p95 average `54.1 ms`, max average `122.8 ms`, `9` frames over `50 ms`; settled at exactly `4` sourced videos and `3.5` playing on average.
- This is a real improvement to wheel-scroll work, but the goal is still not complete: p95 remains near/above the long-frame threshold under 4x CPU throttle.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`24` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Final Homepage Motion Pass: No Visible Frozen Tutorial Thumbnails

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Visual structure documented from local browser screenshots:
  - Desktop: fixed/top app bar, full-bleed misty hero video, centered headline, model marquee strip, dense 15-card tutorial mosaic in 5 columns, then the orbit/tool-cloud band.
  - Mobile: compact app bar, 240px hero, model strip, 15-card tutorial mosaic in 3 columns, then orbit/tool-cloud.
- Root cause of visible frozen thumbnails:
  - The public home passed `maxSimultaneousVideos` as `5` desktop, `4` compact, and `3` compact low-power, so most visible cards were poster-only by design.
  - The initial poster render budget was `10`, leaving later mobile/full-page cards visually blank until viewport state caught up.
  - The thumbnail grid deliberately paused videos on scroll and only refreshed viewport state after scroll settle, causing newly visible rows to sit still during/after scroll.
  - The hero background source was delayed (`900ms` desktop, `2200ms` compact/lite), so the background could appear frozen before motion started.
- Fixes made:
  - `DashboardTutorialGrid` now renders poster coverage for all `15` public-home video thumbnails.
  - Default public-home autoplay budget and simultaneous playback now allow all `15` visible tutorial videos to move.
  - Compact and low-power public-home paths now keep the same `15` moving-thumbnail target instead of capping to `4` or `3`.
  - Initial thumbnail autoplay delay is `0ms`; the remaining source stagger is `25ms` per scheduled thumbnail to avoid one giant media attach burst.
  - Scroll no longer pauses visible thumbnail videos. The grid refreshes viewport state through a batched `requestAnimationFrame` while scrolling and keeps loaded thumbnails warm.
  - Hero background video source attaches immediately after layout/profile resolution; the page still uses the existing perf/lite hero assets and poster.
  - Existing visual content, card count, layout, titles, hero copy, model strip, and orbit section were not removed or hidden.
- Added local-only probe artifact:
  - Script: `Scott/full-dashboard-performance-probe-2026-06-16/mobile-all-visible-motion-probe.mjs`
  - Output: `Scott/full-dashboard-performance-probe-2026-06-16/full-dashboard-mobile-all-visible-motion-summary.json`
- Final local motion evidence from `mobile-all-visible-motion-probe.mjs`, Chrome mobile `390x844`, 4x CPU throttle:
  - Top viewport: `15` posters present; all visible tutorial cards were `playing: true`, `readyState: 4`, with advancing `currentTime`; hero lite video was playing.
  - After scrolling to expose the last row: all `15` visible cards were `playing: true`, `readyState: 4`, with advancing `currentTime`.
  - Scroll sample: visible cards after scroll were all playing; frame timings were `p95 12.5ms`, `p98 37.6ms`, `max 129.1ms`, `8` frames over `50ms`, `5` over `100ms`, long-task total `306ms` under 4x CPU.
- Startup isolation rerun:
  - Output: `Scott/full-dashboard-performance-probe-2026-06-16/full-dashboard-mobile-startup-isolation-summary.json`
  - Baseline showed heavier startup because all `15` posters/videos are now intentionally active to satisfy the no-frozen-thumbnail requirement.
  - Media/poster requests are the main remaining startup cost; hiding showcase/orbit still reduces p95, confirming the moving mosaic is now the deliberate tradeoff.
- Browser artifacts:
  - Desktop after-fix screenshot: `Scott/homepage-visual-desktop-after-motion-fix-2026-06-16.png`
  - Mobile after-fix screenshot: `Scott/homepage-visual-mobile-after-motion-fix-2026-06-16.png`
  - Mobile scrolled after-fix screenshot: `Scott/homepage-visual-mobile-scrolled-after-motion-fix-2026-06-16.png`
  - A later in-app screenshot capture timed out; local Playwright probes and earlier browser screenshots were used as the reliable verification source.
- Validation:
  - `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`29` tests).
  - `npm.cmd run type-check`: passed.
  - `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/routes/PublicDashboardRoute.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx styles/workspace-dashboard.css`: no code errors; existing warning that `styles/workspace-dashboard.css` is ignored by the eslint config.

## 2026-06-16 Continuation: Stop Compact Thumbnail Rotation Freezes

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- User-visible issue: some tutorial video thumbnails looked frozen even though the active cap was working.
- Deep-dive finding: compact/mobile playback rotation could churn the visible thumbnail set after the user had settled on the showcase. One visible video could be dropped/reloaded around the rotation interval, producing a sourced but temporarily reset thumbnail.
- Rejected experiment: a memoized `DashboardTutorialCard` wrapper made timing worse in the 4x CPU mobile probe (`p95 20.9 ms`, `p98 39.6 ms`, `max 99.1 ms`, `5` frames over `50 ms`) and was removed.
- Fix kept: `DashboardTutorialGrid` now has `enablePlaybackRotation`, defaulting to true for the shared grid, and `GuestDashboardView` passes `enablePlaybackRotation={!useCompactLayout}` so compact/mobile keeps the initially selected visible set stable.
- Added a regression test: `keeps the initial visible playback set stable when rotation is disabled`.
- Corrected browser evidence uses actual `src` attributes for active decode pressure; Chrome can keep `currentSrc` populated after `removeAttribute("src")`, so `currentSrc` alone overcounts released videos.
- Final mobile Chrome proof at `390x844`, 4x CPU, four runs, after waiting beyond the old rotation interval:
  - Average p95 `8.4 ms`, p98 `9.5 ms`, max `53.1 ms`, average `0.5` frames over `50 ms`.
  - Actual sourced attributes: exactly indexes `[9,10,11,12]` in every run.
  - Playing indexes: `[9,10,11,12]` in every run.
  - Moving indexes, loop-aware: `[9,10,11,12]` in every run.
  - Scroll-pause markers: `0`.
- Artifact: `Scott/latency-continuation-probe-2026-06-16/post-compact-rotation-disabled-corrected-summary.json`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`28` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Remove Public-Path Icon Package Imports

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Follow-up profiling still showed startup/top-of-page long tasks even after compact hero video deferral.
- Root cause addressed in this pass: the logged-out public dashboard path still imported `phosphor-react` for optional offer icons and tutorial modal icons. Those icons are not needed for the first visible hero and made the public path heavier than necessary.
- `PublicDashboardRoute` now uses tiny local SVG components for offer icons.
- `DashboardTutorialModal` now uses tiny local SVG components for close/arrow icons.
- `DashboardAppBar` now accepts a generic `ElementType` icon, preserving compatibility with authenticated dashboard Phosphor icons without forcing the public path to import the package.
- Verified no `phosphor-react` imports remain in:
  - `frontend/features/dashboard/routes/PublicDashboardRoute.tsx`
  - `frontend/features/dashboard/components/DashboardTutorialModal.tsx`
  - `frontend/features/dashboard/components/DashboardAppBar.tsx`
- In-app browser sanity check at `http://127.0.0.1:3000/`: hero heading present, launch CTA present, hero source still deferred early, 15 tutorial cards rendered.
- Final full-page mobile Chrome proof at `390x844`, 4x CPU:
  - Average p95 `8.4 ms`, p98 `8.5 ms`, max `41.7 ms`.
  - Average frames over `50 ms` dropped from `1.0` after hero delay to `0.33`.
  - Average long-task total dropped from `784 ms` after hero delay to `687 ms`.
  - Hero video source stayed unattached before and after quick scroll in every run.
- Artifact: `Scott/full-dashboard-performance-probe-2026-06-16/full-dashboard-mobile-scroll-after-public-icon-cleanup-summary.json`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`28` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/routes/PublicDashboardRoute.tsx features/dashboard/components/DashboardTutorialModal.tsx features/dashboard/components/DashboardAppBar.tsx features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Reduce Mobile Startup Long Tasks

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Broadened profiling from the tutorial showcase to a full mobile guest dashboard scroll at `390x844`, 4x CPU.
- Before this pass, the full-page probe showed scroll frames were mostly healthy but startup still had about `952 ms` average long-task time, clustered at the hero/top of page before scrolling.
- The biggest avoidable source was compact/lite hero video attachment during the first interaction window. The poster was already tiny and instant, but the lite MP4 source could attach at `900 ms`, overlapping early interaction/hydration work.
- Kept desktop hero timing at `900 ms`, but added `LITE_HERO_SOURCE_ATTACH_DELAY_MS = 2200` for compact/lite mode so mobile keeps the poster-only hero unless the user lingers.
- Consolidated guest motion/layout detection into one `useHomepageMotionLayoutProfile` state update instead of three separate mount-time hooks.
- Removed unused `viewportRatio` state from `useSectionNearViewport`; section observers now update only the boolean each caller actually uses.
- In-app browser sanity check at `http://127.0.0.1:3000/`: dashboard rendered, poster present, hero source still absent after `1800 ms`, 15 tutorial videos in the DOM.
- Final full-page mobile Chrome proof after these changes:
  - Average p95 `8.43 ms`, p98 `8.5 ms`, max `70.7 ms`, average `1.0` frame over `50 ms`, `0` frames over `100 ms`.
  - Average long-task total dropped from about `952 ms` to `784 ms`.
  - Average rect reads dropped from about `80` to `34`.
  - Hero video source stayed unattached before and after the quick scroll in every run.
- Artifact: `Scott/full-dashboard-performance-probe-2026-06-16/full-dashboard-mobile-scroll-after-hero-delay-summary.json`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`28` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Frozen Thumbnail Playback Guard

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- A Chrome trace captured under `Scott/trace-wheel-2026-06-16/` showed the remaining scroll pain was no longer mostly scroll-listener code. The largest relevant repeated work appeared as React scheduled work (`performWorkUntilDeadline`) and browser lifecycle/rendering work, with one large Next dev/init task ignored as startup noise.
- Root causes addressed in this pass:
  - `DashboardTutorialGrid` was not memoized, so unrelated parent scroll state in `GuestDashboardView` could still re-render the full tutorial grid during scroll bursts.
  - `DashboardTutorialVideoThumbnail` treated every `video.play()` rejection as a durable playback failure. If a play promise rejected after our own scroll pause/resume sequence, the poster layer could stay visible and make a thumbnail appear frozen even though playback should resume.
- `DashboardTutorialGrid` is now wrapped in `memo`, preventing unchanged tutorial props from re-rendering the grid during parent-only scroll state changes.
- Thumbnail playback now uses a monotonically increasing play-attempt id:
  - starting a new `play()` increments the id,
  - pausing increments the id and invalidates pending play promises,
  - stale promise rejections are ignored,
  - expected `AbortError` interruptions are ignored instead of marking the thumbnail as failed.
- Added regression coverage that rejects an old play promise after scroll resumes and verifies the thumbnail remains in its moving `data-playing="true"` state.
- Proxy conclusion: proxies can help if the bottleneck is network cache/range delivery, but this frozen-thumbnail issue was measured in client playback/render state. A proxy is not the primary fix for the observed frozen thumbnails.

Measured local evidence:

- In-app browser at `http://127.0.0.1:3000/`: after DOM scrolling to the tutorial showcase, visible thumbnails at indexes `[9,10,11,12]` were sourced, unpaused, marked `data-playing="true"`, and advanced `currentTime` over a `900 ms` sample.
- Mobile wheel-style 4x CPU probe using local Chrome at `390x844`, four runs:
  - Average p95 `14.6 ms`, average max `155.2 ms`, average `5.8` frames over `50 ms`.
  - Every run settled with exactly `4` sourced thumbnails.
  - Runs 2-4 had all four sourced thumbnails playing and moving; run 1 had three playing/moving at sample time.
- This is a large p95 improvement over the previous four-run wheel sample (`55.8 ms` average p95), and it directly addresses the frozen poster-over-video race. The goal is still not fully complete because occasional long max frames remain.
- Raw probe artifact saved at `Scott/thumbnail-freeze-probe-2026-06-16.json`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`25` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Negative Results For Resume Stagger And Three-Video Compact Cap

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Two plausible follow-up optimizations were tested and rolled back because browser timing got worse:
  - Staggering post-scroll `video.play()` resume calls at `120 ms` intervals.
  - Reducing compact normal tutorial playback from `4` simultaneous videos to `3`.
- Staggered resume result:
  - Average p95 `21.9 ms`, average max `156.3 ms`, average `6.0` frames over `50 ms`.
  - All thumbnails moved, but timing was worse than immediate resume.
- Three-video compact cap result:
  - Average p95 `20.8 ms`, average max `151.0 ms`, average `6.0` frames over `50 ms`.
  - Only `3` thumbnails moved and timing still worsened.
- Both experiments were removed; the best current measured code path remains the immediate-resume imperative scroll-pause setup from the previous pass:
  - Average p95 `16.8 ms`, average max `105.2 ms`, average `4.3` frames over `50 ms`.
  - `4` sourced, `4` playing/moving, `0` stale scroll-pause markers.
- Raw negative-results artifact saved at `Scott/negative-results-resume-and-compact-cap-2026-06-16.json`.

Validation after rollback:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`25` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Remove Thumbnail Video Opacity Transition

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- A runtime intervention matrix isolated CSS transitions/animation as a remaining contributor while preserving thumbnail motion and the same scroll target.
- Intervention results at mobile `390x844`, 4x CPU:
  - Baseline: p95 `26.3 ms`, max `132.0 ms`, `5.0` frames over `50 ms`, `4` thumbnails moving.
  - No model marquee only: p95 `22.2 ms`, max `113.9 ms`, `5.0` over `50 ms`, `4` moving.
  - No transitions only: p95 `16.7 ms`, max `122.2 ms`, `5.0` over `50 ms`, `4` moving.
  - No tutorial video opacity transition only: p95 `15.3 ms`, max `137.5 ms`, `5.0` over `50 ms`, `4` moving.
- Since the narrow video-transition intervention was the best p95 improvement and preserved motion, `.dashboard-tutorial-video-frame video` now uses `transition: none` instead of `transition: opacity 160ms ease`.

Measured local evidence after the CSS patch:

- Mobile wheel-style 4x CPU probe using local Chrome at `390x844`, four runs:
  - Average p95 `15.6 ms`, average max `121.9 ms`, average `4.3` frames over `50 ms`.
  - Every run settled with `4` sourced, `4` playing thumbnails, moving indexes `[9,10,11,12]`.
  - Computed tutorial video transition property was `none` in every run.
- Raw probe artifact saved at `Scott/thumbnail-opacity-transition-probe-2026-06-16.json`.
- The broader speed goal remains active because occasional long max frames remain.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`25` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Delay Idle Tutorial Video Source Release

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- The next local probe instrumented mobile `390x844` dashboard scrolling at 4x CPU with frame sampling, long tasks, tutorial video `play()`, `pause()`, `load()`, and rect reads.
- Remaining long frames clustered around post-scroll-settle viewport refresh plus media source unload/play churn.
- Runtime intervention results:
  - Baseline current path: p95 `29.1 ms`, p98 `73.6 ms`, max `122.2 ms`, `7.3` frames over `50 ms`, all four thumbnails moving.
  - Skipping empty `video.load()` calls worsened max and long tasks.
  - Disabling source release worsened sourced-video count (`11-13` sourced videos) and timing.
  - Delaying source release to `1600 ms` was the best measured intervention: p95 `26.3 ms`, p98 `47.2 ms`, max `111.1 ms`, `4.7` frames over `50 ms`, all four thumbnails moving.
- `DASHBOARD_TUTORIAL_SOURCE_IDLE_RELEASE_MS` is now `1600` instead of `260`, which moves expensive source unload work away from immediate scroll settle without keeping videos warm indefinitely.
- Regression coverage now asserts an offscreen idle thumbnail keeps its video source through the first `900 ms`, then releases it after the longer idle window.

Measured local evidence after the patch:

- Mobile wheel-style 4x CPU probe using local Chrome at `390x844`, four runs:
  - Average p95 `23.0 ms`, p98 `57.3 ms`, max `109.4 ms`, average `5.3` frames over `50 ms`.
  - Every run settled with `4` sourced, `4` playing thumbnails, moving indexes `[9,10,11,12]`, and `0` stale scroll-pause markers.
- Compared with the same frame sampler's baseline (`29.1 ms` p95, `73.6 ms` p98, `122.2 ms` max, `7.3` frames over `50 ms`), this improves scroll smoothness and keeps thumbnail motion intact.
- Raw probe artifacts saved in `Scott/latency-continuation-probe-2026-06-16/`, especially `source-release-frame-summary-partial.json` and `post-delay-release-summary.json`.
- The broader speed goal remains active because max frames around `109 ms` still occur under 4x CPU throttling.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`25` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Skip Duplicate Thumbnail Play Calls

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- After delaying source release, remaining probes still showed high tutorial `play()` call counts around scroll settle and media readiness.
- Runtime intervention result:
  - Current delayed-release baseline: p95 `29.2 ms`, p98 `51.3 ms`, max `127.8 ms`, `5.7` frames over `50 ms`, about `29.0` `play()` calls, all four thumbnails moving.
  - Skipping `play()` when a tutorial video was already unpaused, unended, and ready: p95 `25.0 ms`, p98 `50.0 ms`, max `107.0 ms`, `5.3` frames over `50 ms`, about `13.0` real `play()` calls, all four thumbnails moving.
- Added `isDashboardTutorialVideoAlreadyPlaying` and used it in both the React thumbnail play path and imperative scroll-resume path.
- Added a regression that fires `canplay` on an already-moving thumbnail and verifies no extra `play()` call is issued.
- Post-patch browser proof at mobile `390x844`, 4x CPU, four runs:
  - Average p95 `21.9 ms`, p98 `46.9 ms`, max `124.9 ms`, average `4.8` frames over `50 ms`.
  - Every run settled with `4` sourced, `4` playing thumbnails, moving indexes `[9,10,11,12]`, and `0` stale scroll-pause markers.
  - Real `play()` calls were reduced to `13-20` per run.
- Follow-up negative probes:
  - Moving source release beyond `1600 ms` to `2600 ms` or `3200 ms` worsened timing and kept `7-13` videos sourced; left release at `1600 ms`.
  - Skipping `pause()` when already paused cut pause calls but worsened p95/p98/max; left pause behavior unchanged.
- Raw probe artifacts saved in `Scott/latency-continuation-probe-2026-06-16/`, especially `duplicate-play-guard-summary.json`, `post-duplicate-play-guard-summary.json`, `longer-source-release-summary.json`, and `redundant-pause-guard-summary.json`.
- The broader speed goal remains active because max frames still occasionally exceed `100 ms` under 4x CPU throttling.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`26` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed after removing a redundant state write from the already-playing branch.
- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx`: passed (`15` tests) after the lint cleanup.

## 2026-06-16 Continuation: Reduce Thumbnail React Work

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- A fresh Chrome trace after the duplicate-play guard showed the largest remaining spikes were React scheduler chunks (`performWorkUntilDeadline`), not layout or paint:
  - Top `RunTask`/`FunctionCall` spans were around `117.7 ms`, `103.1 ms`, `65.8 ms`, and `64.6 ms`.
  - Layout, paint, and intersection work were much smaller by comparison.
- Negative viewport-refresh probes:
  - Skipping the settle-time video rect refresh improved p95 slightly but selected stale moving thumbnails `[6,7,8,12]`, so it was rejected.
  - Projecting cached rects with scroll delta kept the right moving thumbnails `[9,10,11,12]` but worsened p95/p98/max, so it was rejected.
- Implemented the React-work reductions that did hold up:
  - Wrapped `DashboardTutorialVideoThumbnail` in `memo`.
  - Centralized document visibility state in `DashboardTutorialGrid` instead of giving every thumbnail its own `visibilitychange` listener and state.
- Post-thumbnail-memo browser proof at mobile `390x844`, 4x CPU, four runs:
  - Average p95 `19.8 ms`, p98 `34.4 ms`, max `102.1 ms`, average `4.0` frames over `50 ms`.
  - Every run settled with `4` sourced, `4` playing thumbnails and moving indexes `[9,10,11,12]`.
- Post-centralized-visibility browser proof at mobile `390x844`, 4x CPU, four runs:
  - Average p95 `19.8 ms`, p98 `39.6 ms`, max `97.9 ms`, average `3.8` frames over `50 ms`.
  - Every run settled with `4` sourced, `4` playing thumbnails, moving indexes `[9,10,11,12]`, and `0` stale scroll-pause markers.
  - Individual max frames still hit `108.3 ms` in two runs, so the broader speed goal remains active.
- Raw probe artifacts saved in `Scott/latency-continuation-probe-2026-06-16/`, especially `manual-refresh-cost-summary.json`, `projected-refresh-summary.json`, `post-thumbnail-memo-summary.json`, and `post-centralized-visibility-summary.json`.
- Trace artifact saved at `Scott/trace-after-playguard-2026-06-16/trace.json` with summary in `trace-summary.json`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`26` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Stagger Idle Source Release

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- After the React-work pass, the remaining post-scroll work still included bursty thumbnail media cleanup.
- Runtime intervention results:
  - Current release burst: p95 `18.1 ms`, p98 `36.2 ms`, max `107.0 ms`, `4.7` frames over `50 ms`, final sourced count `4`, all four thumbnails moving.
  - `90 ms` release staggering: p95 `20.8 ms`, p98 `34.7 ms`, max `101.4 ms`, `4.0` frames over `50 ms`, final sourced count `4`, all four thumbnails moving.
  - `140 ms` release staggering lowered max more, but left `6` videos sourced in the proof window, so it was rejected.
- Added conservative `90 ms` idle source-release staggering across eight index slots, keeping the base `1600 ms` release delay.
- Added regression coverage proving adjacent idle thumbnails do not release their sources in the same tick.
- Post-patch browser proof at mobile `390x844`, 4x CPU, four runs:
  - Average p95 `19.8 ms`, p98 `33.4 ms`, max `96.9 ms`, average `4.0` frames over `50 ms`.
  - Every run settled with `4` sourced, `4` playing thumbnails, moving indexes `[9,10,11,12]`, and `0` stale scroll-pause markers.
  - Two individual runs still hit `104.2 ms` max, so the broader speed goal remains active.
- Raw probe artifacts saved in `Scott/latency-continuation-probe-2026-06-16/`, especially `source-release-stagger-summary.json` and `post-source-release-stagger-summary.json`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`27` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Imperative Scroll Pause For Tutorial Videos

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- After the single-observer pass, the next remaining React churn source was the grid-wide `isPageScrolling` state flip. That state caused every tutorial thumbnail to re-render on scroll start and scroll settle only to pause/resume videos.
- `DashboardTutorialGrid` no longer stores active scroll pause in React state.
- The grid now:
  - edge-detects scroll bursts with `isPageScrollingRef`,
  - pauses sourced thumbnail videos imperatively once per burst,
  - keeps sources warm during active scroll,
  - invalidates stale `video.play()` promises via `data-dashboard-playback-attempt-id`,
  - refreshes viewport state at scroll settle,
  - resumes only scheduled sourced videos after settle,
  - clears `data-dashboard-scroll-paused` markers even if a video source was released before settle.
- Tests were updated to assert the real contract: source stays warm, the DOM pause path runs once per burst, stale play rejections do not freeze the thumbnail, and scroll pause markers are cleared after settle.
- A follow-up experiment that ignored shared IntersectionObserver entries during active scroll was tested and removed because it worsened p95.

Measured local evidence:

- Mobile wheel-style 4x CPU probe using local Chrome at `390x844`, four runs:
  - Average p95 `16.8 ms`, average max `105.2 ms`, average `4.3` frames over `50 ms`.
  - Every run settled with exactly `4` sourced thumbnails, `0` stale scroll-pause markers, `4` playing thumbnails, and moving indexes `[9,10,11,12]`.
- Compared with the previous single-observer probe (`13.6 ms` average p95, `116.6 ms` average max, `5.5` frames over `50 ms`), p95 became noisier, but max frame time and over-50ms frame count improved.
- Raw probe artifact saved at `Scott/imperative-scroll-pause-probe-2026-06-16.json`.
- The broader speed goal remains active because p95 is still noisy and occasional long frames remain.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`25` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Single Observer For Tutorial Thumbnail Viewport Tracking

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- A clean trace without V8 CPU-profiler categories was saved at `Scott/trace-wheel-clean-2026-06-16/`.
- Clean-trace finding: the previous giant `timeupdate` span was profiler noise, but real long tasks remained as React scheduler chunks around `performWorkUntilDeadline`; paint/layout were smaller than the React scheduled work.
- Root cause addressed in this pass:
  - Every `DashboardTutorialVideoThumbnail` owned an IntersectionObserver effect and local visibility state, while also sending the same viewport information to the parent grid.
  - This created per-thumbnail observer/effect churn around scroll settle, exactly where the clean trace showed React work.
- `DashboardTutorialGrid` now owns one grid-level IntersectionObserver for all tutorial thumbnail videos.
- Viewport updates are batched through one parent map update via `applyVideoViewportStates`.
- `DashboardTutorialVideoThumbnail` now receives `isNearViewport` and `hasVisiblePosterPixels` booleans from the parent, instead of owning its own observer and visibility state.
- The no-IntersectionObserver fallback is preserved for tests/older browsers by marking observed videos as near viewport on the next animation frame.

Measured local evidence:

- Mobile wheel-style 4x CPU probe using local Chrome at `390x844`, four runs:
  - Average p95 `13.6 ms`, average max `116.6 ms`, average `5.5` frames over `50 ms`.
  - Every run settled with exactly `4` sourced thumbnails.
  - Runs 2-4 had all four sourced thumbnails moving; run 1 had three moving at sample time.
- Compared with the previous visibility-churn probe (`16.7 ms` average p95, `142.7 ms` average max, `6.3` frames over `50 ms`), this reduced p95, max frame time, and over-50ms frames.
- Raw probe artifact saved at `Scott/single-observer-thumbnail-probe-2026-06-16.json`.
- The broad speed goal is still active because occasional long frames remain.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`25` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.
- `git diff --check`: no whitespace errors; Git only reported existing LF-to-CRLF warnings.

## 2026-06-16 Continuation: Reduce Thumbnail Visibility State Churn

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- A fresh post-freeze-fix Chrome trace was saved under `Scott/trace-wheel-after-freeze-2026-06-16/`.
- The trace showed the moving-thumbnail state was healthy (`4` sourced, `4` playing, moving indexes `[9,10,11,12]`), but remaining long tasks still included React scheduled work after scroll settle.
- CPU samples in the trace included `DashboardTutorialVideoThumbnail`, `DashboardTutorialGrid`, and React event dispatch. A very large `CpuProfiler::StartProfiling`/`timeupdate` span was treated as trace instrumentation noise rather than app work.
- Root causes addressed in this pass:
  - `DashboardTutorialVideoThumbnail` stored exact `viewportRatio` in React state even though rendering only needs `isNearViewport` and whether poster pixels are visible.
  - IntersectionObserver callbacks always asked the parent grid to rebuild its viewport map, even when the exact state for that index was unchanged.
- `DashboardTutorialVideoThumbnail` now stores a compact visibility state: `isNearViewport` and `hasVisiblePosterPixels`.
- The child visibility setter now bails out when an observer callback does not change render-relevant visibility.
- `handleNearViewportChange` in the parent now bails out when exact viewport state is unchanged, or when an already-missing index is reported offscreen again.

Measured local evidence:

- Mobile wheel-style 4x CPU probe using local Chrome at `390x844`, four runs:
  - Average p95 `16.7 ms`, average max `142.7 ms`, average `6.3` frames over `50 ms`.
  - Every run settled with exactly `4` sourced, `4` playing thumbnails, moving indexes `[9,10,11,12]`.
- Compared with the previous run (`14.6 ms` average p95, `155.2 ms` average max, `5.8` frames over `50 ms`), p95 was statistically similar/slightly worse, max improved, and moving-thumbnail consistency improved from one run having `3` moving to all runs having `4` moving.
- This is a cleanup of real React update churn and reliability, but not the final latency solution; occasional long frames remain.
- Raw probe artifact saved at `Scott/thumbnail-visibility-churn-probe-2026-06-16.json`.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`25` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx features/dashboard/components/GuestDashboardView.tsx tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`: passed.

## 2026-06-16 Continuation: Remove Duplicate Manual Video Pause From Scroll Handler

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used.
- Browser instrumentation wrapped window scroll listeners during a 4x CPU mobile wheel burst.
- Before this pass, the active `DashboardTutorialGrid` scroll listener ran `8` times, with about `11.0 ms` total handler time and a `9.6 ms` first-call max. It was still querying all thumbnail videos and calling `pause()` manually on scroll start.
- That manual pause was duplicate work: setting `isPageScrolling` already makes each `DashboardTutorialVideoThumbnail` pause through React state.
- Removed the `tutorialGridRef.current?.querySelectorAll("video").forEach(video.pause())` path from the scroll handler.
- Updated the regression so a three-video grid pauses once per scroll burst through React effects (`3` pause calls), not both manually and through effects (`6` pause calls).

Measured local evidence:

- After the change, scroll listener instrumentation showed the active grid listener still ran `8` times, but total handler time dropped to about `1.7 ms` with a `0.8 ms` max call. The guest scroll listener was about `1.0 ms` total with a `0.5 ms` max call.
- Video rect reads stayed deferred until settle (`15` reads after the burst, not during active wheel events).
- Four-run mobile wheel 4x CPU frame sample after this pass: p95 average `55.8 ms`, max average `155.2 ms`, `10` frames over `50 ms`; all four runs settled at exactly `4` sourced and `4` playing videos, indexes `[9,10,11,12]`.
- This removes a measured ~`9 ms` first-scroll handler spike and improves resume reliability, but the whole speed goal is still not complete because remaining long frames now appear outside the scroll handlers themselves.

Validation:

- `npm.cmd run test -- dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`24` tests).
- `npm.cmd run type-check`: passed.
- `npx.cmd eslint features/dashboard/components/GuestDashboardView.tsx features/dashboard/components/DashboardTutorialGrid.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`: passed.

## 2026-06-16 Continuation: Full Public Home Motion Performance Pass

- Current branch re-verified immediately before edits: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used, queried, switched to, deployed to, or changed.
- Deep-dive visual map confirmed the public home consists of the app bar, full-bleed background hero video, model marquee, 15-card tutorial video mosaic, and the lower tool-cloud/orbit section.
- Root cause findings:
  - The public-home tutorial grid was still allowing visible tiles to be poster-only under earlier caps/rotation, which created the "frozen thumbnail" perception.
  - The thumbnail proxy loaded full upstream video objects before serving browser byte-range requests, multiplying startup pressure across 15 MP4 thumbnails.
  - Each moving tile kept a separate poster `<img>` painting underneath the `<video>`, adding duplicate image requests/layers while the same visual poster was already available through the video element.
  - Scroll jank was mainly from media source churn, duplicate play attempts, viewport measurement bursts, and redundant paint layers; the remaining startup long tasks in isolation probes are heavily influenced by local Next/React dev bundles.
- Fixes made:
  - Public home now keeps all 15 tutorial thumbnails eligible to autoplay, including compact/mobile.
  - Autoplay starts immediately with no stagger after the initial poster paint, so first-viewport tiles do not wait in a frozen poster state.
  - Video visibility now waits for `loadeddata`, not metadata, so the visible video layer appears only once a decoded frame exists.
  - Once a tile begins loading video, the standalone poster `<img>` is removed and the video element's own `poster` holds the same visual until motion starts.
  - Added paint containment to `.dashboard-tutorial-video-frame`.
  - Tutorial thumbnail API range requests are proxied upstream with the original `Range` header when no fresh full cache exists, preserving browser partial-media loading instead of downloading full upstream MP4s first.
  - HEAD range requests no longer read the upstream response body before returning headers.

Measured local evidence:

- Final mobile motion probe at `390x844`, 4x CPU:
  - Top viewport: all 12 visible tutorial thumbnails were playing in the first sampled window, `readyState 4`, no visible poster layer.
  - Scrolled viewport: all 15 visible tutorial thumbnails were playing, `readyState 4`, no visible poster layer.
  - Scroll sample: p95 `8.5 ms`, p98 `8.6 ms`, max `33.4 ms`, `0` frames over `50 ms`, `0` frames over `100 ms`, `0` long tasks.
  - Final visible cards after scroll were all moving and had no poster `<img>` layer.
- Startup isolation probe still shows dev-server long tasks, but the media-specific evidence improved:
  - Baseline resource list now shows video range-style transfer sizes instead of duplicate poster-plus-full-video pressure.
  - Blocking images/media still leaves large Next/React dev-bundle long tasks, so those startup spikes are not all homepage-media work.
- Visual screenshots after the final pass preserved the homepage layout and look:
  - `Scott/homepage-visual-desktop-final-performance-pass-2026-06-16.png`
  - `Scott/homepage-visual-mobile-final-performance-pass-2026-06-16.png`
- Probe artifacts updated:
  - `Scott/full-dashboard-performance-probe-2026-06-16/full-dashboard-mobile-all-visible-motion-summary.json`
  - `Scott/full-dashboard-performance-probe-2026-06-16/full-dashboard-mobile-startup-isolation-summary.json`

Validation:

- `npm.cmd run test -- dashboard-tutorial-thumbnail-proxy.test.ts dashboard.guest-route.test.tsx dashboard-tutorial-grid.test.tsx`: passed (`33` tests).
- `npm.cmd run type-check`: passed.
- `npm.cmd run lint`: passed with existing warnings only (`21` warnings, `0` errors).

## 2026-06-16 Continuation: Thumbnail Video Quality Without Visible Perf Regression

- Current branch re-verified: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not used, switched to, queried, deployed to, or changed.
- Goal: improve dashboard tutorial thumbnail video quality without changing the home page's visual layout or making visible thumbnail motion slower/frozen.
- Final thumbnail derivative profile:
  - `360px` max display dimension.
  - `20 fps`.
  - H.264 `main` profile.
  - x264 `veryfast` preset for lower decode complexity.
  - CRF `31`, improving over the prior CRF `32` profile without using the heavier `slow` preset.
  - `600k` maxrate and `1200k` buffer to cap bitrate spikes.
- Rejected profile:
  - CRF `30`/`slow` and CRF `31`/`slow` improved file quality/size on paper, but 4x CPU scroll probes showed more frame gaps. The final profile favors easier decoding over maximum compression efficiency.
- Code changes:
  - Dashboard tutorial thumbnail profile JSON now supports dashboard-specific `preset`, `maxRate`, and `bufSize`.
  - The ffmpeg preview helper and dashboard backfill script pass those options through to x264.
  - Public dashboard data/proxy paths now import lightweight thumbnail constants/validators from `dashboardTutorialThumbnailShared.ts`, preventing admin ffmpeg/sharp helpers from being pulled into the public homepage bundle.
  - During active scroll, the tutorial grid keeps recently near-viewport video state warm instead of unloading thumbnails mid-scroll; new near-viewport thumbnails can still be added, and cleanup still happens after scroll settles.
- Non-production derivative backfill:
  - Applied to confirmed non-production Supabase project `bgdhqbenqltxildlgkyu` only.
  - `15` active dashboard tutorial display videos regenerated.
  - Final display video payload total: `1,769,378` bytes.
  - Largest display video: `291,265` bytes.
- Measured local evidence:
  - Local page health: `http://127.0.0.1:3000/` returned `200` after the public bundle split.
  - Visible thumbnail quality window probe at mobile `390x844`, 4x CPU:
    - Top visible window: p95 `8.6 ms`, p98 `9.0 ms`, max `16.6 ms`, `0` frames over `50 ms`, `0` long tasks, `12/12` visible thumbnails moving, `0` poster layers.
    - Scrolled visible window: p95 `8.5 ms`, p98 `8.5 ms`, max `16.7 ms`, `0` frames over `50 ms`, `0` long tasks, `15/15` visible thumbnails moving, `0` poster layers.
  - Broader wheel-style probe still records occasional frame gaps after the script scrolls below the whole tutorial grid, but the visible thumbnail windows show no visible frozen/laggy thumbnails.
  - Fresh visual capture:
    - Desktop: `10/10` visible thumbnail videos moving; hero uses `homepage-hero-background-perf.mp4`.
    - Mobile: `12/12` visible thumbnail videos moving; hero uses `homepage-hero-background-lite.mp4`.
- Artifacts:
  - `Scott/full-dashboard-performance-probe-2026-06-16/visible-thumbnail-quality-window-summary.json`.
  - `Scott/full-dashboard-performance-probe-2026-06-16/full-dashboard-mobile-all-visible-motion-summary.json`.
  - `Scott/homepage-thumbnail-quality-desktop-2026-06-16.png`.
  - `Scott/homepage-thumbnail-quality-mobile-2026-06-16.png`.
  - `Scott/homepage-thumbnail-quality-visual-summary-2026-06-16.json`.

Validation:

- `npm.cmd run type-check`: passed.
- `npm.cmd run test -- dashboard-tutorial-grid.test.tsx admin-dashboard-tutorial-thumbnail.test.ts videoPosterVariant.test.ts dashboard-tutorial-thumbnail-proxy.test.ts`: passed (`31` tests).
- `npx.cmd eslint features/dashboard/components/DashboardTutorialGrid.tsx lib/server/api/dashboardTutorials.ts pages/api/dashboard/tutorial-thumbnail.ts lib/server/api/dashboardTutorialThumbnailShared.ts lib/server/videoPosterVariant.ts lib/server/api/dashboardTutorialAssets.ts tests/api/admin-dashboard-tutorial-thumbnail.test.ts lib/server/__tests__/videoPosterVariant.test.ts scripts/backfill_dashboard_tutorial_thumbnail_derivatives.mjs tests/api/dashboard-tutorial-thumbnail-proxy.test.ts`: passed.
- `git diff --check`: passed; Git printed existing LF-to-CRLF working-copy warnings only.
