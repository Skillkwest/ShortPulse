# Phase 09 Slice D Evidence: Bulk Listed Incident Status Operations

Date: 2026-02-27  
Owner: Engineering  
Phase: 09 (Admin Hardening)  
Slice: D (operator batch status controls)

## Scope Delivered
1. Added bulk incident status route:
   - `frontend/pages/api/admin/errors-status-bulk.ts`
2. Wired admin incidents UI to invoke listed-open batch actions:
   - `frontend/pages/admin/index.tsx`
   - `frontend/features/admin/components/ErrorIncidentsPanel.tsx`
3. Added focused coverage:
   - `frontend/tests/api/admin-errors-status-bulk.test.ts`
   - `frontend/features/admin/components/__tests__/ErrorIncidentsPanel.pagination.test.tsx`
4. Updated API inventory docs:
   - `README.md`
   - `docs/api/api-internal-routes.md`

## Problem
1. Operators could only update incident status one row at a time.
2. During incident spikes, repetitive manual updates increased operational latency and error risk.

## Fix
1. Introduced authenticated bulk route that accepts `errorIds[]` + target status and applies atomic RPC updates (`admin_update_app_error_status`) per incident with bounded concurrency.
2. Returned bounded failure payload with summary counters (`requestedCount`, `updatedCount`, `failedCount`) for deterministic operator feedback.
3. Added listed-open batch actions in admin UI:
   - `Resolve listed open (...)`
   - `Ignore listed open (...)`

## Validation Run
1. `npm -C frontend run test -- tests/api/admin-errors-status-bulk.test.ts tests/api/admin-error-events.test.ts features/admin/components/__tests__/ErrorIncidentsPanel.pagination.test.tsx features/admin/logic/__tests__/errorIncidentViewUtils.test.ts`
2. `npm -C frontend run test -- features/admin/components/__tests__/ErrorIncidentsPanel.pagination.test.tsx`
3. `npm -C frontend run lint`
4. `npm -C frontend run type-check`
5. `npm -C frontend run build`
6. `npm -C frontend run docs:check`

## Human Exit Checkpoint
1. Manual admin checkpoint completed on 2026-02-27.
2. Observed result:
   - No `500` errors during `/admin` errors workflow validation.
   - Incident status action buttons and listed bulk status buttons are functioning correctly.
3. Result: `PASS`.

## Rollback
1. Revert this slice only:
   - `frontend/pages/api/admin/errors-status-bulk.ts`
   - `frontend/pages/admin/index.tsx`
   - `frontend/features/admin/components/ErrorIncidentsPanel.tsx`
   - `frontend/tests/api/admin-errors-status-bulk.test.ts`
   - `frontend/features/admin/components/__tests__/ErrorIncidentsPanel.pagination.test.tsx`
2. Re-run:
   - `npm -C frontend run test -- tests/api/admin-errors-status-bulk.test.ts features/admin/components/__tests__/ErrorIncidentsPanel.pagination.test.tsx`
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
