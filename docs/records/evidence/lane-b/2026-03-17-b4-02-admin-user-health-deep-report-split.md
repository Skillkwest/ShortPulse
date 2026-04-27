# Lane B Evidence Packet: B4-02 Admin User Health Deep Report Split

date_utc: 2026-03-17  
slice_id: B4-02  
track: B-Core  
owner: Engineering  
seam_type: shared_extraction  
linked_pr: n/a (local execution slice)

## Scope

1. Extract per-user admin health analytics, findings evaluation, and response assembly out of `frontend/pages/api/admin/user-health.ts`.
2. Keep the route focused on request validation, auth, lookup, and data-loading concerns.
3. Add direct regression coverage for the extracted report builder so the seam is not protected only by route smoke tests.

## Commands Run

1. `npm -C frontend run test -- tests/api/admin-user-health.test.ts tests/lib/admin-user-health-deep-report.test.ts`
2. `npm -C frontend run test -- tests/api/admin-user-health-fleet.test.ts tests/api/internal-admin-user-health-fleet-run.test.ts tests/lib/admin-user-health-policy.test.ts`
3. `npm -C frontend run type-check`
4. `npm -C frontend run lint`
5. `npm -C frontend run build`
6. `npm -C frontend run check:architecture-boundary`
7. `npm -C frontend run check:size-budget`
8. `npm -C frontend run docs:check`

## Results

1. All commands passed.
2. Lint remained at the existing baseline warning set (`7` warnings, `0` errors).
3. `frontend/pages/api/admin/user-health.ts` dropped below the Admin/Health warn budget.
4. The only remaining Admin/Health warn-mode hotspot is `frontend/lib/server/adminUserHealth/fleet.ts`.

## LOC Or Coupling Delta

1. `frontend/pages/api/admin/user-health.ts`: `1097` -> `337` lines.
2. Added `frontend/lib/server/adminUserHealth/deepReport.ts`: `801` lines.
3. Added direct regression test coverage in `frontend/tests/lib/admin-user-health-deep-report.test.ts`.
4. Route ownership now excludes analytics aggregation, finding evaluation, and response assembly.

## Net Complexity Note

1. This is a net complexity reduction, not line displacement theater.
2. The new module owns one durable boundary: per-user admin-health deep report construction.
3. The route is now a composition surface for auth, lookup, schema-compat loading, and error logging.
4. This seam also sets the stop condition for the route portion of `B4-02`; additional route-only cuts would be low-yield.

## Parity Assertions

1. Route request contract is unchanged.
2. Route success/error payload shapes are unchanged.
3. Finding thresholds, detail text, and next-step wording are preserved because the extraction copied route-specific logic rather than forcing convergence onto fleet policy.
4. Adjacent fleet report/run and policy tests remained green after the split.

## Rollback Note

1. Revert this slice by moving `buildAdminHealthResponse` logic back into `frontend/pages/api/admin/user-health.ts` and deleting `frontend/lib/server/adminUserHealth/deepReport.ts` plus its direct regression test.
2. Trigger rollback if route payloads drift, admin-health API tests regress, or fleet-adjacent tests begin failing after follow-up seams.
