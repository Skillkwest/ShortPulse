# Phase 11 Slice B Evidence: Kie Model-Catalog Contract Drift Lock

Date: 2026-03-01  
Owner: Engineering  
Status: Completed

## Objective
Reduce Phase 11 contract bloat/drift risk by removing duplicated Kie submit constraints from provider integration code and reading those constraints from the canonical model catalog.

## Changes
1. Updated `frontend/lib/server/providerIntegration/kieModelContracts.ts` to consume Kie contract bounds from `frontend/lib/model-runtime/modelCatalog.ts` rather than hardcoded duplicate aspect/duration/resolution arrays.
2. Added fail-closed catalog guards in the submit contract path:
   - missing Kie catalog entry,
   - missing allowed aspects,
   - missing allowed durations,
   - missing VEO 3.1 Fast I2V allowed resolutions.
3. Preserved public behavior:
   - Fal routes unchanged,
   - Kie remains dark/off by default,
   - unsupported/malformed Kie payload paths still fail closed.

## Validation
1. `npm -C frontend run test -- kieModelContracts`
2. `npm -C frontend run type-check`
3. `npm -C frontend run test:phase11:fal-regression`

All commands passed on 2026-03-01.

## Rollback
1. Revert only this slice commit if needed.
2. Prior behavior is restored by returning to hardcoded Kie submit constraints in `kieModelContracts`.
