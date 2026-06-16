# Thumbnail And Video Lag Deep Dive

Recorded: 2026-06-16

Branch verified before investigation: `codex/brother-dashboard-aesthetics`.

Production was not touched, checked out, queried, or used.

## Summary

The lag/glitchiness is coming from a combination of media derivative cost, playback-slot logic, hero-video overlap, heavy card paint effects, and a mobile layout bug.

## Findings

1. Live tutorial display variants are heavier than the current target profile.
   - Current target file: `frontend/lib/server/api/dashboardTutorialThumbnailProfile.json`
   - Target motion max dimension: `540`
   - Actual live working-development display videos inspected on 2026-06-16: all 15 are `720x720`, `60 fps`, H.264 High profile.
   - Display variants total about 10.5 MB across 15 cards.
   - The original source uploads total about 127 MB, but the public route uses display derivatives, not the originals.

2. Initial desktop playback is capped, but the videos are still expensive.
   - Initial desktop browser state showed 16 video elements: 1 hero video plus 15 tutorial video elements.
   - At first paint/top of page, only the hero and first two tutorial thumbnails were playing.
   - Those tutorial videos decode from 720x720 60 fps sources into about 248x248 visible boxes, which wastes decode/composite work.

3. Playback-slot selection favors low indexes, not the most visible cards.
   - `DashboardTutorialGrid.tsx` tracks near-viewport video indexes, sorts ascending, then slices to the simultaneous-video limit.
   - After scrolling, the first two cards were mostly above the viewport but still inside the `120px` observer margin, so they kept the two playback slots.
   - The fully visible next row stayed poster-only/no-src while less-visible earlier cards kept playing.
   - This can look like visible thumbnails freezing, popping, or not animating even though the page is "working as coded."

4. User activation can bypass the playback budget.
   - `hasUserActivated` is set permanently after pointer/focus/touch activation.
   - The `shouldPlay` condition includes `|| hasUserActivated`, so an activated thumbnail can keep playing regardless of `canAutoPlay`, viewport state, or simultaneous-video cap.
   - There is no pointer-leave reset.
   - This can become unbounded if a user moves through many thumbnails or taps several cards.

5. Hero video overlaps the tutorial decode window.
   - The hero section observer uses a `520px` root margin.
   - Browser inspection showed the hero video still playing while completely above the visible viewport and into the tutorial section.
   - That means hero decoding can compete with tutorial decoding during the first tutorial rows.

6. Mobile layout has a concrete title/thumbnail overlap bug.
   - At a 390x844 viewport, the first tutorial cards measured about `72x90`.
   - Their title boxes measured about `72x120` and began about `30px` above the card.
   - The title layer overlaps the thumbnail area, which can look like visual glitching independent of video decode.

7. Public-home card styling is expensive around video surfaces.
   - Each public tutorial card uses rounded clipping, a transformed video/image, large shadows, full-card gradient overlays, title gradients, and pseudo-elements.
   - These effects are visually premium, but they increase paint/composite cost when combined with looping videos in a dense grid.

## Likely Root Causes Ranked

1. Live thumbnail videos are 720x720 at 60 fps instead of smaller/lower-frame-rate display loops.
2. The playback scheduler chooses the lowest near-viewport indexes instead of the most visible/current cards.
3. Activated thumbnails can keep playing forever and bypass the simultaneous playback budget.
4. The hero video keeps decoding too deep into the tutorial section.
5. Mobile CSS causes title boxes to exceed and overlap small tutorial cards.
6. Card paint/composite styling is heavy for a grid of video surfaces.

## Recommended Fix Direction

1. Regenerate or backfill tutorial display videos to match a stricter public thumbnail profile:
   - 540px or lower square output.
   - 24 or 30 fps.
   - H.264 Baseline or Main where possible.
   - Short loop duration if acceptable.

2. Change playback-slot selection to prefer actual viewport visibility/center distance, not index order.

3. Make hover/touch activation temporary and still subject to the simultaneous playback cap, or stop activated videos on pointer leave and when offscreen.

4. Reduce hero observer root margin for playback pause, or pause the hero as soon as it is outside the viewport while keeping lazy-load prewarm separate.

5. Fix mobile public tutorial card rows so thumbnail and title dimensions fit inside the card without overlap.

6. Simplify card compositing where possible:
   - Avoid `clip-path` where border-radius clipping is enough.
   - Reduce heavy shadows/gradient overlays on video cards.
   - Avoid unnecessary `transform` promotion on every thumbnail.
