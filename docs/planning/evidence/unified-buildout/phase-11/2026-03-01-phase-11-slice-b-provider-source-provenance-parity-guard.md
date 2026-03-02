# Phase 11 Slice B Evidence: Provider Source Provenance Parity Guard

Date: 2026-03-01  
Owner: Engineering  
Status: Complete

## Objective
Prevent provider-contract provenance drift by enforcing that each model catalog `sourceUrl` resolves to an expected trusted domain for its provider classification (`fal`, `kie`, `openai`).

## Implementation
1. Extended model parity governance checker:
   - `scripts/check_model_catalog_parity.js`
2. Added provider source-host allowlist enforcement:
   - `fal` -> `fal.ai` domain,
   - `kie` -> `docs.kie.ai`/`kie.ai` domain,
   - `openai` -> `platform.openai.com`/`openai.com` domain.
3. Added URL host parsing + allowlist matching checks in existing catalog parity pass/fail flow.

## Why This Is Safe
1. Script-only governance hardening; no production runtime request-path behavior changes.
2. Improves pre-enablement contract hygiene while keeping Fal routes intact and Kie cutover dark/off.

## Validation
1. `npm -C frontend run test:phase11:fal-regression` -> pass
2. `npm -C frontend run docs:check` -> pass

## Rollback
1. Revert this slice commit only.
2. No schema/data rollback required.
