# Phase 09 Slice C Evidence: Admin Event Stream Actionable Filter Reliability

Date: 2026-02-27  
Owner: Engineering  
Phase: 09 (Admin Hardening)  
Slice: C (operator reliability hardening)

## Scope Delivered
1. Patched actionable filter handling in:
   - `frontend/pages/api/admin/error-events.ts`
2. Added regression coverage:
   - `frontend/tests/api/admin-error-events.test.ts`
3. Updated phase/tracker docs:
   - `docs/planning/stages/unified-phase-09-admin-hardening.md`
   - `docs/planning/shortpulse-unified-buildout-tracker.md`
   - `docs/api/api-internal-routes.md`

## Problem
1. Admin Event Stream requests with `incident=actionable` could return `500` with:
   - `"failed to parse logic tree ((incident_id.is.null,app_error_logs.status.eq.open))"`
2. Root cause: relation-based OR expression composed for PostgREST parsing was invalid for this join/filter shape.

## Fix
1. Removed relation-OR logic tree construction for `incident=actionable`.
2. Applied base filters server-side, enriched incident status, then computed actionable rows in a bounded in-memory merge:
   - actionable = `incident_id is null` OR `incident_status === open`
3. Returned degraded-health guidance for actionable mode and truncation guidance when bounded prefetch ceiling is reached.

## Validation Run
1. `npm -C frontend run test -- admin-error-events`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`

## Rollback
1. Revert this slice commit only.
2. Re-run:
   - `npm -C frontend run test -- admin-error-events`
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
