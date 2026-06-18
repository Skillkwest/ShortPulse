# Modal Video Lag Deep Dive - 2026-06-17

Branch confirmed: `codex/brother-dashboard-aesthetics`.

Production guardrail: no production branch, deployment, or production environment was touched.

## Scope

Investigated why videos opened from homepage tutorial thumbnails and the `Watch Demo` button lag or pause inside `DashboardTutorialModal`.

## Relevant Code Paths

- `frontend/features/dashboard/components/GuestDashboardView.tsx`
  - `selectedHeroDemo` opens the `Watch Demo` modal.
  - The hero background video continues playing while the modal is open.
  - Tutorial playback only pauses when the showcase is away from viewport.
- `frontend/features/dashboard/components/DashboardTutorialGrid.tsx`
  - `selectedTutorial` opens the tutorial-card modal.
  - Thumbnail videos receive `isPlaybackPaused={pauseVideoPlayback}` only.
  - Modal-open state is not included in `pauseVideoPlayback`.
- `frontend/features/dashboard/components/DashboardTutorialModal.tsx`
  - Creates a YouTube iframe at click time via `resolveYoutubeEmbedUrl`.
- `frontend/styles/workspace-dashboard.css`
  - `.dashboard-tutorial-modal-backdrop` uses `backdrop-filter: blur(10px)`.
- `frontend/pages/api/dashboard/tutorial-thumbnail.ts`
  - Stable local thumbnail proxy already exists with cache headers and byte-range handling.

## Live Probe Evidence

Tested local page at `http://127.0.0.1:3000/` with Chrome through Playwright.

### Watch Demo Path

Before click:
- Total local videos in DOM: 16
- Playing videos: 11
- Playing tutorial thumbnails: 10
- Playing hero videos: 1

After modal opens:
- Modal iframe: `https://www.youtube-nocookie.com/embed/k1-J78JLsMs?rel=0&modestbranding=1&playsinline=1`
- Backdrop filter: `blur(10px)`
- Total local videos in DOM: 16
- Playing videos: 11
- Playing tutorial thumbnails: 10
- Playing hero videos: 1

Conclusion: opening `Watch Demo` does not pause the hero video or the visible thumbnail videos behind the modal.

### Tutorial Card Path

Before click:
- Total local videos in DOM: 16
- Playing videos: 16
- Playing tutorial thumbnails: 15
- Playing hero videos: 1

After modal opens:
- Modal iframe: `https://www.youtube-nocookie.com/embed/-65Vh2-4hoQ?rel=0&modestbranding=1&playsinline=1`
- Backdrop filter: `blur(10px)`
- Total local videos in DOM: 16
- Playing videos: 16
- Playing tutorial thumbnails: 15
- Playing hero videos: 1

Conclusion: opening a thumbnail tutorial leaves all thumbnail videos plus the hero video decoding under the modal.

## Root Cause

The YouTube modal is competing with the homepage media layer:

1. The iframe player is cold-created on click, which loads YouTube player resources and starts its own video pipeline.
2. The homepage keeps decoding up to 15 thumbnail MP4s behind the modal.
3. The public hero background MP4 keeps playing behind the modal.
4. The modal backdrop applies a full-viewport `backdrop-filter: blur(10px)` over animated/video content, increasing compositing pressure.

The thumbnail proxy is already present and useful, but it does not solve modal lag because the browser is still asked to decode and composite many local videos while the embedded YouTube player is active.

## Recommended Fix Path

1. Treat any tutorial modal as a global homepage media pause state.
2. In `DashboardTutorialGrid`, include `selectedTutorial !== null` in the internal pause condition so grid thumbnails pause immediately while its modal is open.
3. Expose an `onModalOpenChange` callback from `DashboardTutorialGrid` so `GuestDashboardView` knows when a card modal opens.
4. In `GuestDashboardView`, pause the hero video and pass `pauseVideoPlayback` when either the hero demo modal or a tutorial-card modal is open.
5. Optionally pause model marquee/orbit animation while modal is open if further profiling shows compositing pressure after video pause.
6. Add tests proving:
   - thumbnail video receives a pause state while grid modal is open.
   - public home passes pause state while hero demo modal is open.
   - public home receives grid modal-open callback and pauses background media.

## Proxy Note

Additional thumbnail proxies are not the primary fix because a stable local thumbnail proxy already exists. A proxy would only help if the YouTube demo itself were replaced by a first-party optimized MP4/HLS asset. For the current YouTube iframe modal, the high-impact fix is to stop background media while the modal player is active.
