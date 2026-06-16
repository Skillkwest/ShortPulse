# Logged-In Homepage Pass - 2026-06-16

## Scope

- Branch: `codex/brother-dashboard-aesthetics`.
- Production remained off-limits and was not opened, edited, validated, pushed to, or otherwise touched.
- Work target: signed-in `/dashboard` only.
- Logged-out `/` and logged-out `/dashboard` are off-limits unless Scott explicitly changes that rule.

## Owner Direction Captured

- Keep the logged-in page aesthetically related to the logged-out home page.
- Do not copy unnecessary sales/acquisition elements into the logged-in page.
- Do not add the public hero background video, scrolling model strip, or acquisition header behavior.
- Keep tutorial thumbnails.
- Preserve existing tutorial thumbnail behavior: clicking a tutorial should use the current `DashboardTutorialGrid` and `DashboardTutorialModal` flow and keep the same launch behavior.

## Implementation Notes

- Added an `authenticated-dashboard-page` shell class only to `AuthenticatedDashboardRoute`.
- Updated `AuthenticatedDashboardView` hero markup only for the signed-in route:
  - authenticated-only scenic background layer using an existing poster asset, not a video;
  - practical welcome copy;
  - existing `New Project` and `Open Projects` quick actions retained;
  - existing tutorial grid retained unchanged.
- Added CSS scoped under `.authenticated-dashboard-page` and `.authenticated-home-*` so public-home rules are not required for the signed-in design.
- Added responsive signed-in rules for header cards, hero stacking, quick actions, and tutorial thumbnail grid density.
- Updated signed-in `/dashboard` tutorial thumbnails to visually match the logged-out homepage thumbnail style while keeping the existing `DashboardTutorialGrid` and `DashboardTutorialModal` behavior:
  - square cards;
  - large rounded clipping on desktop;
  - borderless media tiles;
  - image-overlaid titles with dark fade;
  - short accent line;
  - five/four/three-column responsive density matching the logged-out treatment.
- Replaced the signed-in hero's photographic background with a project-local generated dark abstract texture:
  - asset path: `frontend/public/dashboard/authenticated-home-dark-texture.webp`;
  - source generated with the built-in image generation tool, then compressed to WebP;
  - prompt intent: plain dark graphite/glass texture with subtle grid, teal accents, ember accents, no people, no objects, no text;
  - CSS reference is scoped to `.authenticated-home-hero-bg` only.
- Added a signed-in header block for `Community` in `AuthenticatedDashboardRoute`.
  - It is currently a non-link header card because no safe standalone community route was identified in this pass.
  - The logged-out community surfaces were not edited.

## Validation

- `npx.cmd eslint features/dashboard/components/AuthenticatedDashboardRoute.tsx features/dashboard/components/AuthenticatedDashboardView.tsx` passed.
- `npm.cmd run type-check` passed.
- `npm.cmd run type-check:touched` could not run on this Windows shell because the helper failed with `spawn EINVAL`; full TypeScript check passed as fallback.
- Local browser rendering of `http://localhost:3000/dashboard` was blocked by an existing compile error in the dashboard tutorial server import path: `lib/server/videoPosterVariant.ts` and `sharp`/`detect-libc` are being pulled into the browser bundle through `dashboardTutorialAssets` -> `dashboardTutorials` -> `publicDashboardData` -> `pages/dashboard.tsx`.
- That compile blocker was not fixed in this pass because it is outside the newly narrowed signed-in-only visual scope and touches the public/dashboard data path.
- After the signed-in thumbnail style follow-up, `npm.cmd run type-check` failed in the existing logged-out test file `tests/pages/dashboard.guest-route.test.tsx` with `TS7006: Parameter 'link' implicitly has an 'any' type`. This file is part of the logged-out route/test surface and was intentionally not edited under the current off-limits rule.
