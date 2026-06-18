# Community To Gallery Fade Fix

Recorded: 2026-06-17

Branch rule observed: stayed on `codex/brother-dashboard-aesthetics`; production was not touched.

## Change

- Smoothed the transition between the logged-out homepage `JOIN THE COMMUNITY` section and the `Gallery` section.
- Updated `frontend/styles/workspace-dashboard.css` so `.public-home-gallery` overlaps upward into `.public-home-orbit`.
- Added a fixed-height transparent-to-solid top mask on `.public-home-gallery` so the gallery fades in instead of starting as a hard opaque band.
- Increased the bottom padding and softened the bottom background wash of `.public-home-orbit` so the community section fades underneath the gallery.
- Added responsive overlap/padding overrides for tablet and mobile breakpoints.

## Verification

- Re-rendered `http://localhost:3000/` locally.
- Desktop viewport evidence:
  - First pass was not sufficient; a faint shelf remained where the gallery mask finished.
  - Second pass deepened the overlap and added a bottom mask to `.public-home-orbit`, creating a true crossfade: community fades out while gallery fades in.
  - `.public-home-gallery` now begins about `230px` before `.public-home-orbit` ends.
  - The gallery top mask is now a longer ramp: `transparent 0`, `rgba(..., 0.12) 24px`, `rgba(..., 0.38) 82px`, `rgba(..., 0.72) 142px`, `rgba(..., 0.94) 202px`, `#000 244px`.
  - Browser crop showed no hard rectangular shelf between the community CTA and gallery.
- Mobile viewport evidence:
  - Temporary viewport: `390x844`.
  - `.public-home-gallery` now begins about `188px` before `.public-home-orbit` ends.
  - Browser crop showed the community section fading into the gallery with no visible hard divider.

## Test Note

- Ran `npm.cmd run test -- tests/pages/dashboard.guest-route.test.tsx`.
- Result: 12 passed, 1 failed.
- The failure is the existing unrelated assertion that `useSupabaseSessionStateMock` should not be called; this was already failing before the fade change.
