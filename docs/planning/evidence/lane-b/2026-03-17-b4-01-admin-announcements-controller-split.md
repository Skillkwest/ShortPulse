# Lane B Evidence Packet: B4-01 Admin Announcements Controller Split

date_utc: 2026-03-17  
slice_id: B4-01  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract the `/admin` announcements tab async state and mutations into a dedicated controller hook.
2. Preserve the `/admin` page contract while moving:
   - current announcement load,
   - publish validation and mutation,
   - clear mutation,
   - form state and result/error messaging.
3. Keep the remaining admin page domains (`errors/events`, `users/credits`, overview glue) inline for later `B4-01` slices.

## Files Updated

1. `frontend/pages/admin/index.tsx`
2. `frontend/features/admin/logic/useAdminAnnouncementsController.ts`
3. `docs/planning/evidence/lane-b/2026-03-17-b4-01-admin-announcements-controller-split.md`
4. `docs/planning/evidence/lane-b/README.md`
5. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
6. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## Commands Run

1. `npm -C frontend run test -- tests/pages/admin.announcements.test.tsx`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results

| command | exit_code | result |
| --- | --- | --- |
| `test -- admin.announcements.test.tsx` | 0 | pass (`2` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass (`7` warnings, baseline only) |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta

1. `frontend/pages/admin/index.tsx`: `1660` -> `1523` (`-137` lines, `wc -l`).
2. `frontend/features/admin/logic/useAdminAnnouncementsController.ts`: new file at `209` lines.
3. Coupling reduction:
   - announcement fetch/load state,
   - publish/clear mutations,
   - form validation and feedback
   no longer live inside the already oversized route component.

## Net Complexity Note

1. Net complexity improved because the extracted code is one bounded tab-local controller, not generic fetch helpers.
2. `frontend/pages/admin/index.tsx` now reads more clearly as route composition over:
   - announcements controller,
   - errors/events orchestration,
   - users/credits workflows,
   - access and tab routing.
3. The next admin boundary decision is clearer because the page no longer mixes the simplest tab-local async workflow with the heavier domains.

## Seam Selection Rationale

1. This follows the `B4-01` hotspot map exactly: announcements was the highest-readiness first seam due to direct page coverage and a bounded API surface.
2. It clears the Lane B rubric by creating a durable controller boundary with explicit page-size reduction and no route-behavior change.
3. It leaves the next two real candidates visible: `errors/events` or `users/credits`.

## Parity Assertions

1. `/admin` route behavior is unchanged.
2. Announcements tab still:
   - loads and pre-fills current announcement on tab open,
   - publishes with deterministic success feedback,
   - clears with deterministic success feedback.
3. No API/server/schema changes.

## Task Contract Checklist

1. Behavior/API parity: pass.
2. Required gates: pass.
3. Net complexity improved with a real announcements controller boundary: pass.
4. Docs/tracker/evidence parity: pass.
5. Seam-selection rubric cleared: pass.
6. Audit findings: `blocking=0`, `non-blocking=0`, `deferred=1`.

## Deferred

1. `LB-DEFER-018`: Reassess `B4-01` now that the announcements tab is isolated, then choose the next controller seam (`errors/events` vs `users/credits`) based on hotspot weight and test readiness instead of momentum.

## Rollback Note

1. Revert this slice commit to inline announcement controller state back into `frontend/pages/admin/index.tsx`.
2. No data migration or runtime rollback required.

## Linked Plan Artifacts

1. `docs/archive/planning/lane-b-master-plan-2026-03-16.md`
2. `docs/archive/planning/lane-b-tracker-spec-2026-03-16.md`
3. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`
4. `docs/planning/evidence/lane-b/2026-03-17-b4-01-admin-shell-hotspot-map.md`
