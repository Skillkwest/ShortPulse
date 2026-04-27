# Lane B Evidence Packet: B4-02 Admin Fleet Report Split

date_utc: 2026-03-17  
slice_id: B4-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract read-side fleet report loading, finding hydration, filtering, pagination, and degradation flags out of `frontend/lib/server/adminUserHealth/fleet.ts`.
2. Leave `fleet.ts` focused on scan execution/orchestration.
3. Add direct regression tests for the new read-side report module.

## Commands Run

1. `npm -C frontend run test -- tests/lib/admin-user-health-fleet-persistence.test.ts tests/lib/admin-user-health-fleet-report.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/internal-admin-user-health-fleet-run.test.ts tests/lib/admin-user-health-policy.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results

1. All commands passed.
2. Lint returned to the exact baseline warning count (`7`).
3. Admin/Health size-budget warn entries were fully cleared.

## LOC Or Coupling Delta

1. `frontend/lib/server/adminUserHealth/fleet.ts`: `1018` -> `766` lines after the report seam.
2. Added `frontend/lib/server/adminUserHealth/fleetReport.ts`: `310` lines.
3. Added direct coverage in `frontend/tests/lib/admin-user-health-fleet-report.test.ts`.
4. `fleet.ts` no longer owns report reading, finding hydration, summary aggregation, or pagination/filtering concerns.

## Net Complexity Note

1. This seam completed the intended split between execution-time orchestration and read-side report assembly.
2. The new module has durable domain meaning and improved testability.
3. `fleet.ts` is now below the Admin/Health warn budget and reads as a scan service instead of a mixed read/write megamodule.

## Parity Assertions

1. `readAdminUserHealthFleetReport` public contract is unchanged.
2. Existing `/api/admin/user-health-fleet` route tests remained green.
3. Report filtering, summary counts, and degradation handling are preserved via direct and route-level tests.

## Rollback Note

1. Revert this slice by moving the read/report assembly logic back into `fleet.ts` and deleting `fleetReport.ts` plus its direct tests.
2. Trigger rollback if report payload shape, filtering, pagination, or admin fleet route behavior regresses.
