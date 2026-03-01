# Phase 12 Slice B Evidence: Concrete Decommission Inventory Map

Date: 2026-03-01  
Owner: Engineering  
Status: Prepared (execution deferred until post-canary/cutover signoff)

## Objective
Turn the Phase 12 pre-cleanup plan into a concrete, path-level inventory so post-cutover removals can run in small deterministic slices with low regression risk.

## Hard Guards (Unchanged)
1. No compatibility removals before Phase 04 and Phase 11 canary/cutover signoff.
2. No public `/api/fal/*` surface removals during pre-canary implementation.
3. Roll back by slice only.

## Concrete Inventory

### 1) Transition Flags And Runtime Controls
1. `frontend/lib/server/api/falRuntimeFlags.ts`
   - `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED`:
     - disposition: retire after Phase 04 canary/signoff completion.
   - `SHORTPULSE_FAL_INTEGRATION_MODE`, `SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST`:
     - disposition: keep through cutover; evaluate retirement only after two green release cycles.
2. `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`
   - `SHORTPULSE_KIE_INTEGRATION_ENABLED`, `SHORTPULSE_KIE_MODEL_ALLOWLIST`:
     - disposition: keep as kill-switch controls through initial post-cutover cycles.
   - `SHORTPULSE_KIE_TRUSTED_HOSTS`, `SHORTPULSE_KIE_SUBMIT_URLS`, `SHORTPULSE_KIE_STATUS_BASE_URLS`, `SHORTPULSE_KIE_STATUS_TIMEOUT_MS`:
     - disposition: likely keep as operational controls unless platform policy later centralizes these values.
   - `KIE_API_KEY` / `SHORTPULSE_KIE_API_KEY`:
     - disposition: keep (provider credential).

### 2) Compatibility Wrappers / Adapter Shims
1. `frontend/lib/server/falIntegration/statusProxyRuntime.ts`
   - legacy Fal wrapper exports over provider policy/probe seams.
   - disposition: remove wrappers only when callsites are migrated to provider-first helpers directly.
2. `frontend/lib/server/falIntegration/retrievalEngine.ts`
   - legacy Fal wrapper exports for candidate selection.
   - disposition: remove wrapper layer after direct provider-selection callsite migration.
3. `frontend/pages/api/internal/generation-recovery/run.ts`
   - `claimFallback(...)` path for legacy-safe claim behavior.
   - disposition: evaluate removal only after all target environments verify RPC/claim path parity and no fallback activation across two release cycles.

### 3) Deferred-Window / Temporary Decisioning Artifacts
1. `docs/planning/evidence/unified-buildout/phase-11/2026-03-01-phase-11-canary-window-1-live-log.md`
2. `docs/planning/evidence/unified-buildout/phase-11/2026-03-02-phase-11-canary-window-2-live-log.md`
3. `docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-shadow-window-1-live-log.md`
   - disposition: retain until final promotion decision is signed; then replace with final signoff packet summary references.

## Execution Order (Post-Signoff)
1. Remove Phase 04 rollout-only flag branches (`SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED`) with targeted queue-status verification.
2. Remove wrapper layers in `statusProxyRuntime.ts` and `retrievalEngine.ts` only after direct provider-seam callsite migration PRs pass parity tests.
3. Evaluate `claimFallback(...)` removal in recovery route after production evidence confirms no fallback reliance.
4. Remove/condense temporary live-log references and sequencing notes in tracker/docs once signoff packets are finalized.

## Validation Packet For Each Removal Slice
1. `npm -C frontend run test:phase11:fal-regression`
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run docs:check`
5. `npm -C frontend run build`

## Outcome
1. Phase 12 pre-cleanup prep now includes concrete flags/files and explicit post-signoff removal order.
2. Cleanup remains deferred safely until canary/cutover criteria are satisfied.
