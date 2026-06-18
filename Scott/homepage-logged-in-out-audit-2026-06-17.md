# Homepage Logged-In/Logged-Out Audit - 2026-06-17

## Guardrails

- Confirmed branch: `codex/brother-dashboard-aesthetics`.
- Production was not touched, switched to, deployed to, or modified.
- Work stayed in the local `ShortPulse` workspace.

## Scope Audited

- Public/logged-out dashboard home:
  - `frontend/pages/dashboard.tsx`
  - `frontend/features/dashboard/routes/PublicDashboardRoute.tsx`
  - `frontend/features/dashboard/components/GuestDashboardView.tsx`
  - Shared tutorial, community, gallery, app bar, and footer components.

- Authenticated/logged-in dashboard home:
  - `frontend/features/dashboard/routes/DashboardRouteSessionAware.tsx`
  - `frontend/features/dashboard/components/AuthenticatedDashboardRoute.tsx`
  - `frontend/features/dashboard/components/AuthenticatedDashboardView.tsx`
  - Shared tutorial, community, gallery, app bar, and footer components.

## Issues Fixed

1. Video gallery MP4s were too eager.
   - The shared `PublicHomeVideoGallery` mounted 10 local MP4 files with `preload="auto"`.
   - Those files range from about 3.5MB to 10.4MB each, so the gallery could compete with hero/tutorial media even before the user reached or interacted with the gallery.
   - Fix: gallery videos now attach source only near the viewport or after user intent, use `preload="metadata"` while idle, and switch to `preload="auto"` only during hover/focus preview.

2. Gallery preview videos could continue behind the prompt modal.
   - Opening a prompt modal while a preview was active could leave the hover/focus preview competing behind the modal.
   - Fix: the gallery passes modal-open state into cards and pauses preview playback while a prompt modal is open.

3. Signed-in display names were not normalized.
   - A blank `display_name` string could render as an empty first name instead of falling back to `full_name` or email.
   - Fix: authenticated dashboard display-name resolution now trims metadata and falls back through `display_name`, `full_name`, email, and `Guest`.

4. A signed-in app-bar test was too broad.
   - The test intended to assert that the app-bar logo is not a home link, but it also matched the footer's legitimate home link.
   - Fix: the assertion now targets `.app-bar .brand-mark-logo`.

## Verification

- `npm.cmd run type-check`
- `npm.cmd test -- tests/pages/public-home-video-gallery.test.tsx tests/pages/dashboard.actions.test.tsx tests/pages/dashboard.guest-route.test.tsx tests/pages/dashboard-tutorial-grid.test.tsx`
  - 4 test files passed.
  - 42 tests passed.
  - Existing JSDOM `HTMLMediaElement` not-implemented console noise remained, but tests were green.
- `git diff --check`
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" frontend Scott`
- Browser check on `http://127.0.0.1:3000/`:
  - At page top: 10 gallery videos present, 0 video sources attached, all `preload="none"`.
  - Near gallery: nearby clips attach as `metadata`; offscreen clips remain detached.

## Notes

- The visual layout and user-facing copy were not intentionally changed.
- Hover/focus preview behavior is covered by `public-home-video-gallery.test.tsx`; the in-app browser could verify lazy source attachment directly, but synthetic mouse movement did not activate CSS `:hover` in that environment.
