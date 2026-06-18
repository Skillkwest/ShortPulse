# Community section reset

Branch: `codex/brother-dashboard-aesthetics`

Scope: logged-out home page only. Production remains off-limits.

Final state: the animated use-case orbit was removed and the community section is back to a simple static `JOIN THE COMMUNITY` lockup.

Initial issues found:

- Letter abbreviations such as `IMG`, `CHR`, and `IP` were not self-explanatory.
- The badges were too small and too faint to read as intentional use-case symbols.
- The original circular rotation could bunch icons on one side and made the badges feel random.
- Some icons sat too far inside the headline zone instead of framing the community lockup.

Final approach:

- Removed the use-case data, coordinate math, SVG icon renderer, and animated orbit JSX from `GuestDashboardView.tsx`.
- Removed the use-case orbit/card/keyframe CSS and responsive leftovers from `workspace-dashboard.css`.
- Restored `modelLogos` after the broad cleanup accidentally removed it.
- Kept the `GALLERY` heading left-aligned.
- Removed the always-on gallery card overlay that was creating a horizontal stripe across image tiles.
- Softened the hover/focus prompt overlay so it does not introduce a hard band when active.
- Removed the remaining gallery pseudo-layer and moved the background fade onto the gallery section itself, behind the media.
- Changed hidden gallery captions to `visibility: hidden` plus `opacity: 0`, so they cannot faintly tint thumbnails until hover/focus.
- Collapsed the old community overhang layer from the orbit experiment and masked the community section to fade out within its own bounds.
- Nudged the static community lockup slightly left and down so it reads more centered in the section after the seam fix.

Verification:

- Desktop capture saved to `Scott/community-static-desktop-2026-06-17.png`.
- Mobile capture saved to `Scott/community-static-mobile-2026-06-17.png`.
- Search check: no `public-home-use-case`, `communityOrbit`, or `CommunityUseCaseIcon` references remain.
- Runtime check: no `modelLogos` reference error; `modelLogos` restored.
- Gallery card check: default card pseudo-overlay is `display: none`, captions are hidden at rest, gallery has no `::before` layer, and first-card hit testing lands on `.public-home-gallery-media`.
- Layout check: no horizontal overflow at 1860px desktop or 390px mobile.
- `npm.cmd run type-check` passed.
