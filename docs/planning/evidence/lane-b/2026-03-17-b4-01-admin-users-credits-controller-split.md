# Lane B Evidence Packet: B4-01 Admin Users And Credits Controller Split

date_utc: 2026-03-17  
slice_id: B4-01  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract the `/admin` overview users-and-credits workflow out of the route hotspot.
2. Move search, pagination, user selection, ledger loading, and manual adjustment state into a controller hook.
3. Keep the page contract and behavior unchanged.

## Files Updated

1. `frontend/features/admin/logic/useAdminUsersCreditsController.ts`
2. `frontend/pages/admin/index.tsx`
3. `frontend/tests/pages/admin.users-credits.test.tsx`
4. `docs/planning/evidence/lane-b/2026-03-17-b4-01-admin-users-credits-controller-split.md`
5. `docs/planning/evidence/lane-b/README.md`
6. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`

## Commands Run

1. `npm -C frontend run test -- tests/pages/admin.users-credits.test.tsx tests/pages/admin.announcements.test.tsx`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results

| command | exit_code | result |
| --- | --- | --- |
| `test -- admin.users-credits.test.tsx admin.announcements.test.tsx` | 0 | pass (`4` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass with baseline warnings only |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta

1. `frontend/pages/admin/index.tsx` dropped from `1523` lines after the announcements seam to `1320` lines after the users/credits controller split.
2. The page no longer owns overview-tab users, ledger, and manual-adjustment async orchestration directly.
3. `frontend/features/admin/logic/useAdminUsersCreditsController.ts` now provides the route-local controller boundary for that domain.

## Net Complexity Note

1. Complexity moved into a named controller boundary instead of generic helpers.
2. The extraction removed one full operational cluster from the route while keeping render concerns in the page.
3. This is a controller-first seam, which leaves presenter-only splitting deferred until another strong boundary is justified.

## Parity Assertions

1. Users still load and auto-select the first result.
2. Ledger rows still reload when the selected user changes.
3. Manual adjustment still posts normalized `changeCents` and refreshes users plus ledger after success.
4. Announcements tab behavior stayed green after the route-level extraction.

## Rollback Note

1. Revert this slice by moving the users/credits controller state back into `frontend/pages/admin/index.tsx` and deleting `frontend/features/admin/logic/useAdminUsersCreditsController.ts`.
2. Keep `frontend/tests/pages/admin.users-credits.test.tsx` as the characterization floor if rollback is needed.
