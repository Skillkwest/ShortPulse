# Lane B Evidence Packet: B4-02 Admin Health Hotspot Map

date_utc: 2026-03-17  
slice_id: B4-02  
track: B-Core  
owner: Engineering  
seam_type: local_consolidation  
linked_pr: n/a (local execution slice)

## Scope

1. Identify the next high-value Lane B hotspot after the admin route checkpoint.
2. Map server-side admin health boundaries before editing.
3. Choose the first `B4-02` slice using actual repo hotspots and existing tests.

## Hotspots

1. `frontend/pages/api/admin/user-health.ts` (`1172` lines)
   - Single route currently owns request parsing, lookup resolution, compatibility fallback handling, credit/drainage analysis, finding evaluation, and response assembly.
2. `frontend/lib/server/adminUserHealth/fleet.ts` (`1261` lines)
   - Single module currently owns scan-run lifecycle, target loading, metrics collection, snapshot persistence, escalation, and report reading.

## Existing Regression Floor

1. `frontend/tests/api/admin-user-health.test.ts`
2. `frontend/tests/api/admin-user-health-fleet.test.ts`
3. `frontend/tests/api/internal-admin-user-health-fleet-run.test.ts`
4. `frontend/tests/lib/admin-user-health-policy.test.ts`

## Proposed Extraction Order

1. `B4-02-1`: `frontend/pages/api/admin/user-health.ts`
   - first split: lookup/request parsing + response assembly boundary from analytical core.
2. `B4-02-2`: `frontend/lib/server/adminUserHealth/fleet.ts`
   - first split: run lifecycle + persistence boundary away from metrics/evaluation core.

## Why This Order

1. The route file is the smaller blast radius and has existing API-level tests.
2. The fleet service is broader and touches persistence + escalation + reporting in one module, so it benefits from a route-side checkpoint first.
3. Both files remain on the size-budget warn list, so `B4-02` is the correct next lane target.

## Do Not Do Yet

1. Do not mix `user-health` route and `fleet.ts` production extractions in the same slice.
2. Do not start by splitting tiny helper fragments.
3. Do not change API payload contracts while modularizing these server hotspots.
