# Home Page Responsive Deep Dive - 2026-06-17

## Safety Boundary

- Branch verified before work: `codex/brother-dashboard-aesthetics`.
- Production was not touched, targeted, deployed to, switched to, or used for verification.
- Verification used the existing local Next dev server at `http://localhost:3000`.

## Code Path Map

- `/` renders `frontend/pages/index.tsx`, which loads static public dashboard data and renders `PublicDashboardRoute`.
- Anonymous `/dashboard` renders `DashboardRouteSessionAware`, falls through to `PublicDashboardRoute`, and shares the same logged-out homepage surface.
- Authenticated `/dashboard` renders `AuthenticatedDashboardRoute`, then `AuthenticatedDashboardView`.
- Shared logged-in/logged-out sections:
  - `PublicHomeTutorialShowcase`
  - `DashboardTutorialGrid`
  - `PublicHomeCommunitySection`
  - `PublicHomeVideoGallery`
  - `PublicHomeFooter`
- Primary shared styling lives in `frontend/styles/workspace-dashboard.css`.

## Aesthetic And Function Notes

- Logged-out homepage: full-bleed dark cinematic hero, video-backed creator positioning, compact CTA pair, marquee model strip, dense tutorial thumbnail grid, large community CTA, video gallery, and branded footer.
- Logged-in homepage: authenticated app bar with account/status cards, darker dashboard hero, project action cards, then the same tutorial/community/gallery/footer system as the public home.
- Tutorial thumbnails are admin/API-backed, modal-opening cards. Video thumbnails use poster-first behavior, viewport scheduling, reduced-motion/save-data guards, modal pause behavior, and source release after idle.
- Gallery media is static curated local media with prompt modal behavior. Guests see locked prompt actions; signed-in users get account/studio destinations.

## Responsive Findings

- The tutorial showcase already resolves to 3 cards per row on mobile via `.public-home-showcase .dashboard-tutorial-grid`.
- Public visual proof showed no horizontal overflow at 320, 375, 430, 667 landscape, 768 tablet, 1024 tablet, and 1440 desktop.
- The video gallery had an actual mobile layout issue: its row wrappers preserved asymmetric desktop column weighting on phones, creating tiny columns and awkward wrapping.
- The authenticated page reuses public-home sections but has different page padding; mobile full-bleed offsets needed authenticated-specific normalization.

## Changes Made

- Updated `frontend/styles/workspace-dashboard.css`.
- Mobile gallery rows now use a clean two-column grid under 760px, with wide gallery cards spanning the full row.
- Authenticated mobile shared sections now use authenticated-page offsets for showcase, community, gallery, and footer sections.

## Visual Proof

- Before screenshots and metrics: `Scott/home-responsive-audit-2026-06-17/`.
- After screenshots and metrics: `Scott/home-responsive-audit-2026-06-17-after/`.
- Key after metrics:
  - 320x568: no overflow, tutorial first row count 3.
  - 375x812: no overflow, tutorial first row count 3.
  - 430x932: no overflow, tutorial first row count 3.
  - 667x375: no overflow, tutorial first row count 3.
  - 768x1024: no overflow, tutorial first row count 4.
  - 1440x900: no overflow, tutorial first row count 5.

## Verification

- `npm.cmd run type-check` passed.
- `npm.cmd run test -- tests/pages/dashboard-tutorial-grid.test.tsx tests/pages/dashboard.guest-route.test.tsx` passed: 31 tests.
- Vitest emitted expected jsdom media method not-implemented messages for video play/pause/load; the suite still passed.
