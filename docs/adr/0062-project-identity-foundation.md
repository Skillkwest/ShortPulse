# ADR 0062: Project Identity Foundation

## Status
Accepted

## Date
2026-04-23

## Context
AI Studio currently uses `sid` as its primary page/session identity, while Media Library, generation projection, and preference systems remain mostly user-scoped.

The first product-facing Projects slice needs a durable top-level identity created before entering AI Studio, starting from the dashboard `New Project` action.

## Decision
1. Introduce a user-owned `projects` table in Supabase as the first durable project authority.
2. Create projects server-side through authenticated API routes, not through client-direct inserts from the dashboard.
3. The dashboard `New Project` action must:
   - create a `projects` row for the signed-in user,
   - then route into AI Studio with `?projectId=<uuid>`.
4. Existing `sid` session identity remains temporarily in place for runtime/session continuity.
5. During migration, `projectId` becomes the top-level durable identity and `sid` remains a lower-level workspace/session identity.

## Consequences
- Positive:
  - Project creation becomes a real user-owned database action instead of a link veneer.
  - AI Studio gets a stable future handoff boundary for project-scoped persistence.
  - The migration can proceed incrementally without reworking all session-era persistence in one slice.
- Negative:
  - `projectId` and `sid` coexist temporarily, which preserves some identity duplication until later cutover.
  - Most AI Studio persistence remains non-project-scoped until later phases adopt the new boundary.

## Follow-ups
1. Move project title reads/writes onto the new `projects` row.
2. Make Media Library, reference composition, and generation projection project-aware.
3. Replace dashboard session placeholders with real project listing/open behavior.
