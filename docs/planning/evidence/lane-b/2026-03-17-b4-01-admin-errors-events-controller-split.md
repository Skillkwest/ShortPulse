# Lane B Evidence Packet: B4-01 Admin Errors And Events Controller Split

date_utc: 2026-03-17  
slice_id: B4-01  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract the `/admin` errors-and-events workflow out of the route hotspot.
2. Move filters, loaders, refresh policy, incident mutation, bulk mutation, and synthetic incident actions into a controller hook.
3. Keep page and API behavior unchanged.

## Files Updated

1. `frontend/features/admin/logic/useAdminErrorsEventsController.ts`
2. `frontend/pages/admin/index.tsx`
3. `frontend/tests/pages/admin.errors-events.test.tsx`
4. `docs/planning/evidence/lane-b/2026-03-17-b4-01-admin-errors-events-controller-split.md`
5. `docs/planning/evidence/lane-b/README.md`

## Commands Run

1. `npm -C frontend run test -- tests/pages/admin.errors-events.test.tsx tests/pages/admin.users-credits.test.tsx tests/pages/admin.announcements.test.tsx`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results

| command | exit_code | result |
| --- | --- | --- |
| `test -- admin.errors-events.test.tsx admin.users-credits.test.tsx admin.announcements.test.tsx` | 0 | pass (`6` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass with baseline warnings only |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta

1. `frontend/pages/admin/index.tsx` dropped from `1320` lines after the users/credits seam to `725` lines after the errors/events controller split.
2. The route no longer owns the errors/events operational state machine directly.
3. `frontend/features/admin/logic/useAdminErrorsEventsController.ts` now provides the route-local controller boundary for that domain.

## Net Complexity Note

1. Complexity moved into a named controller with a stable operational boundary, not into generic helpers.
2. The admin route is now primarily composition and rendering logic.
3. This closes the last strong `B4-01` controller seam without expanding route-only abstraction churn.

## Parity Assertions

1. Opening the `Errors` tab still loads incident summary, telemetry health, and incident rows.
2. Resolving an incident still posts the expected payload and refreshes both incident and telemetry datasets.
3. Users/credits and announcements page-level tests remained green after the route extraction.

## Rollback Note

1. Revert by moving the errors/events controller state back into `frontend/pages/admin/index.tsx` and deleting `frontend/features/admin/logic/useAdminErrorsEventsController.ts`.
2. Keep `frontend/tests/pages/admin.errors-events.test.tsx` as the regression floor if rollback is needed.
