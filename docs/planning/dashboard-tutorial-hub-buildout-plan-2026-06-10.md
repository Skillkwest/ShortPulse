# Dashboard Tutorial Hub Buildout Plan

## Objective

Build a globally managed tutorial-card grid for the signed-in dashboard. Admins manage tutorial titles, uploaded animated thumbnail files or HTTPS thumbnail URLs, YouTube links, active state, and display order from the existing dashboard management surface; all signed-in users see the same active ordered grid on their homepage below the welcome/announcement and project action area.

## Owner And Lane

- Owner/lane: dashboard homepage and admin dashboard-management control plane.
- Source boundaries: `frontend/features/dashboard`, `frontend/pages/admin/announcements.tsx`, `frontend/features/admin/logic/useAdminAnnouncementsController.ts`, `frontend/lib/server/api`, `frontend/pages/api`, `sql/migrations`, and route/security/docs indexes.

## Approved Scope

- Add a dedicated `dashboard_tutorials` database authority with RLS/grants.
- Add a private app-owned dashboard tutorial thumbnail bucket plus signed-upload prepare/finalize routes so admins can drop local GIF/image/video thumbnails without manually hosting them.
- Add server helpers and authenticated/admin API routes for reading, saving, deleting, and reordering tutorials.
- Render active tutorials on the signed-in dashboard under the existing hero/project actions.
- Expand `/admin/announcements` into a dashboard management page that preserves announcement publishing and adds tutorial management.
- Update required docs and focused tests.

## Non-Goals

- No YouTube API integration.
- No Supabase image transformations.
- No per-user tutorial personalization.
- No route rename unless it becomes required by implementation; keep `/admin/announcements` as the stable route.
- No commit, push, deploy, or production migration application.

## Proof Requirements

- Focused API tests for active tutorial reads and admin tutorial mutations.
- Focused page/controller tests for dashboard rendering and admin tutorial management.
- Docs updated for routes, security, data dictionary, and root/admin behavior.
- Local validation with targeted tests, plus lint/build when feasible.

## Stop Condition

Stop when the canonical local implementation is complete: one global ordered tutorial table, private app-owned thumbnail upload/storage, authenticated active read, admin-only mutation, dashboard rendering under the hero/project actions, safe YouTube and thumbnail source validation, reorder persistence, docs/tests updated, and local validation reported. Defer hosted migration application, production deployment, and production URL proof unless explicitly requested.
