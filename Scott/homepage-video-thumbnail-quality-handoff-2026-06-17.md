# Homepage Video + Thumbnail Quality Handoff - 2026-06-17

## Guardrails

- Confirmed branch: `codex/brother-dashboard-aesthetics`.
- Production was not touched, switched to, deployed to, or modified.
- Work stayed in the local `ShortPulse` workspace.

## Root Causes Found

1. Modal lag was caused by homepage videos continuing to decode behind YouTube modal iframes.
   - Opening thumbnail tutorials or the hero Watch Demo modal now pauses the hero video, tutorial thumbnails, and model marquee work behind the modal.

2. Thumbnail video quality was constrained by an overly low derivative profile.
   - Previous motion thumbnails were capped at 360px, 20fps, CRF 31, and 600k maxrate.
   - The new profile uses 480px, 24fps, CRF 27, and 1100k maxrate with a 5MB ceiling.

3. Gallery image pixelation came from stretching low-height UI strip screenshots into tall masonry cards.
   - Replaced those with 10 square 1200px WebP gallery tiles derived from existing high-resolution local dashboard artwork.

4. Gallery optimizer quality was being capped by Next config.
   - The component requested high-quality output, but `next.config.js` only allowed quality values through 75 and image widths through 576.
   - The config now allows `q=85` and responsive widths up to 1200.

## Changes Made

- `frontend/features/dashboard/components/GuestDashboardView.tsx`
  - Pauses home media while either hero demo or tutorial modal is open.
  - Uses a stronger hero intersection threshold so the hero stops decoding once it is mostly offscreen.
  - Switches gallery cards to new `/dashboard/gallery/gallery-*.webp` assets through `next/image`.

- `frontend/features/dashboard/components/DashboardTutorialGrid.tsx`
  - Exposes modal open state so the homepage can stop background media while tutorial modals are active.

- `frontend/lib/server/api/dashboardTutorialThumbnailProfile.json`
  - Improved tutorial motion derivative quality while keeping the 5MB size ceiling.

- `frontend/next.config.js`
  - Added `85` to allowed image qualities.
  - Added larger responsive image widths: 640, 750, 828, 1080, and 1200.

- `frontend/public/dashboard/gallery/gallery-01.webp` through `gallery-10.webp`
  - New 1200x1200 WebP gallery tiles.

- `Scott/gallery-sharp-tiles-contact-sheet-2026-06-17.png`
  - Contact sheet used to visually inspect the generated gallery tile set.

## Runtime Verification

- Local server at `http://127.0.0.1:3000/` responded with HTTP 200.
- Browser top-page check:
  - Hero video played at the top.
  - Initial visible tutorial thumbnails played.
  - Gallery sources resolved to `/dashboard/gallery/gallery-*.webp`.

- Browser tutorial-grid check:
  - At the tutorial grid, hero playback count dropped to `0`.
  - Visible tutorial thumbnail videos stayed ready and playing.

- Browser thumbnail-modal check:
  - Opened a tutorial thumbnail modal.
  - Modal iframe source: `https://www.youtube-nocookie.com/embed/-65Vh2-4hoQ?...`
  - Hero playback count: `0`.
  - Tutorial thumbnail playback count: `0`.

- Browser Watch Demo modal check:
  - Opened the hero Watch Demo modal.
  - Modal iframe source: `https://www.youtube-nocookie.com/embed/k1-J78JLsMs?...`
  - Hero playback count: `0`.
  - Tutorial thumbnail playback count: `0`.

- Browser gallery check:
  - All 10 gallery images loaded.
  - Optimizer URLs used `q=85`.
  - Current 1x viewport selected 384px variants for roughly 312px rendered columns; higher-DPI screens now have larger widths available.

## Test Verification

- `npm.cmd run type-check`
- `npm.cmd test -- tests/api/admin-dashboard-tutorial-thumbnail.test.ts tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx`
  - 3 test files passed.
  - 36 tests passed.
  - JSDOM printed expected `HTMLMediaElement` not-implemented noise; tests were green.
- `git diff --check`
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" frontend Scott`

## Notes

- Existing unrelated working-tree edits were preserved.
- New thumbnail derivative settings affect newly generated/uploaded tutorial thumbnails. Existing stored derivatives may need regeneration to inherit the improved quality profile.
