# Lane B Evidence Packet: B4-02 Admin Fleet Persistence Split

date_utc: 2026-03-17  
slice_id: B4-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract fleet scan run lifecycle and persistence concerns out of `frontend/lib/server/adminUserHealth/fleet.ts`.
2. Move start/finish run handling, target-user loading, and snapshot/finding persistence into a dedicated module.
3. Add direct regression tests for the extracted persistence boundary.

## Commands Run

1. `npm -C frontend run test -- tests/lib/admin-user-health-fleet-persistence.test.ts tests/api/admin-user-health-fleet.test.ts tests/api/internal-admin-user-health-fleet-run.test.ts tests/lib/admin-user-health-policy.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results

1. All commands passed.
2. Lint stayed at the repo baseline warning set.
3. `fleet.ts` dropped materially but remained above budget after this first seam, which justified one additional strong boundary slice.

## LOC Or Coupling Delta

1. `frontend/lib/server/adminUserHealth/fleet.ts`: `1261` -> `1018` lines after the persistence seam.
2. Added `frontend/lib/server/adminUserHealth/fleetPersistence.ts`: `283` lines.
3. Added direct coverage in `frontend/tests/lib/admin-user-health-fleet-persistence.test.ts`.
4. `fleet.ts` no longer owns scan-run lifecycle mutations or snapshot/finding persistence mechanics.

## Net Complexity Note

1. This is a real persistence/lifecycle boundary, not helper churn.
2. The extracted module groups one cohesive concern family: run start/finish, target lookup, and durable write-side storage.
3. The seam reduced orchestration noise in `fleet.ts` and made the remaining read/report boundary clearer.

## Parity Assertions

1. `runAdminUserHealthFleetScan` public contract is unchanged.
2. `readAdminUserHealthFleetReport` remained untouched in this slice.
3. Internal route auth/control-flow tests remained green.
4. Policy behavior remained unchanged.

## Rollback Note

1. Revert this slice by moving lifecycle/persistence helpers back into `fleet.ts` and deleting `fleetPersistence.ts` plus its direct tests.
2. Trigger rollback if scan-run creation/finalization, snapshot persistence, or internal fleet-run route behavior regresses.
