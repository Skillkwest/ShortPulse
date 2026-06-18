# Copperknot Checkpoint: Admin Kanban Auth Boundary

Date: 2026-06-17

Touched:
- `frontend/pages/api/admin/kanban/activity.ts`
- `frontend/pages/api/admin/kanban/items/index.ts`
- `frontend/pages/api/admin/kanban/items/[itemId]/index.ts`
- `frontend/pages/api/admin/kanban/items/[itemId]/move.ts`
- `frontend/pages/api/admin/kanban/items/[itemId]/archive.ts`
- `frontend/pages/api/admin/kanban/items/[itemId]/activity.ts`
- `frontend/tests/api/admin-kanban-items.test.ts`

What changed:
- Added route-owned `.auth` exception logging around `requireAdminUser` for admin Kanban/Ophestivus board APIs before any service-role or board persistence work runs.
- Added focused API coverage proving auth verifier failures do not touch Supabase admin or board service helpers.

Validation:
- `npm -C frontend exec vitest run tests/api/admin-kanban-items.test.ts`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run docs:check`
- `git diff --check -- <touched kanban files>`

Boundary:
- Production route parity still resolves to deployment `shortpulse-fug3hxhsc-kirk-artmans-projects.vercel.app` and still exposes retired forbidden routes. Treat as deploy/alias proof boundary, not a source patch target from this lane.
