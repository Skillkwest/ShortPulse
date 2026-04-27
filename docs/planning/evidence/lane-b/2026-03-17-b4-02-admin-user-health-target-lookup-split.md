# Lane B Evidence Packet: B4-02 Admin User Health Target Lookup Split

date_utc: 2026-03-17  
slice_id: B4-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract auth-user target lookup resolution out of `/api/admin/user-health`.
2. Move auth-admin pagination, email lookup, id lookup, and lookup-mode resolution into a server helper module.
3. Keep route behavior unchanged.

## Files Updated

1. `frontend/lib/server/adminUserHealth/targetLookup.ts`
2. `frontend/pages/api/admin/user-health.ts`
3. `docs/planning/evidence/lane-b/2026-03-17-b4-02-admin-user-health-target-lookup-split.md`
4. `docs/planning/evidence/lane-b/README.md`
5. `docs/planning/foundation-lanes-execution-tracker-2026-03-16.md`
6. `docs/archive/planning/lane-b-execution-plan-2026-03-16.md`

## Commands Run

1. `npm -C frontend run test -- tests/api/admin-user-health.test.ts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run lint`
4. `npm -C frontend run build`
5. `npm -C frontend run check:architecture-boundary`
6. `npm -C frontend run check:size-budget`
7. `npm -C frontend run docs:check`

## Results

| command | exit_code | result |
| --- | --- | --- |
| `test -- admin-user-health.test.ts` | 0 | pass (`3` tests) |
| `type-check` | 0 | pass |
| `lint` | 0 | pass with baseline warnings only |
| `build` | 0 | pass |
| `check:architecture-boundary` | 0 | pass |
| `check:size-budget` | 0 | pass |
| `docs:check` | 0 | pass |

## LOC Or Coupling Delta

1. `frontend/pages/api/admin/user-health.ts` dropped from `1172` lines to `1100` lines.
2. Route-local auth target lookup resolution now lives in `frontend/lib/server/adminUserHealth/targetLookup.ts`.
3. The route no longer owns auth-admin page scanning and lookup-mode branching directly.

## Net Complexity Note

1. This split creates a named server boundary with durable meaning instead of generic helper drift.
2. The analytical core remains in the route for now, so the seam stayed low blast radius.
3. This is an appropriate first `B4-02` slice because it reduces route coupling without changing response assembly.

## Parity Assertions

1. Non-POST requests still return `405`.
2. Missing lookup input still returns `400`.
3. Missing auth-user target still returns `404`.

## Rollback Note

1. Revert by moving target lookup helpers back into `frontend/pages/api/admin/user-health.ts` and deleting `frontend/lib/server/adminUserHealth/targetLookup.ts`.
2. Keep `frontend/tests/api/admin-user-health.test.ts` as the route smoke-test floor if rollback is needed.
