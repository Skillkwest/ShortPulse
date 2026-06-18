# Copperknot checkpoint scratchpad - generation lineage attempt identity preservation

Date: 2026-06-17

Lane:
- Launch queue priority 1: Recovery, settlement, and output integrity.
- Fix shape: bounded source seam reduction in the shared lineage resolver.

Touched:
- `frontend/lib/server/api/generationLineageResolver.ts`
- `frontend/lib/server/api/__tests__/generationLineageResolver.test.ts`
- `frontend/lib/server/api/__tests__/generationBilling.settlementService.test.ts`
- `frontend/lib/server/api/generationOutputs.ts`
- `frontend/lib/server/api/generationOutputConvergence.ts`
- `frontend/lib/server/api/__tests__/generationOutputs.test.ts`
- `frontend/lib/server/api/__tests__/generationOutputConvergence.test.ts`
- `frontend/lib/server/openaiImageGeneration.ts`
- `frontend/lib/server/elevenlabs.ts`
- This scratchpad.

Changed:
- Provider-request lineage now preserves request identity from `generation_attempts.provider_request_id` and source identity from `generation_attempts.metadata.source_ref` when attempt evidence is the canonical match.
- Projection-by-generation evidence still wins for projection-specific `sourceRef` / `requestId`, but now falls back to attempt identity when projection fields are absent.
- Provider/request projection evidence can no longer override canonical attempt lineage when projection-by-generation is absent.
- Source-ref lineage now checks caller-owned `ai_generations.metadata.source_ref` before falling back to derivative projection source-ref rows.
- Output convergence now passes its injected Supabase admin client into output attachment so attach/read/projection work uses the same authority context.
- Direct-provider image/audio/video output persistence now passes the existing Supabase admin client into `persistGenerationOutputRecords`.
- Added a focused resolver invariant for attempt request/source preservation without projection.
- Added a resolver invariant proving provider-request projection drift cannot replace the attempt-owned generation id.
- Added a resolver invariant proving source-ref projection drift cannot replace caller-owned generation metadata.
- Added a settlement-service invariant proving reservation linkage repair can use attempt-owned `metadata.source_ref` when projection is absent.
- Added output convergence/output helper invariants proving injected admin clients are passed and honored.
- Added an output helper invariant proving output persistence honors an injected admin client without calling the default admin factory.

Validated:
- `npm -C frontend run test -- --run lib/server/api/__tests__/generationOutputs.test.ts lib/server/api/__tests__/generationOutputConvergence.test.ts lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationBilling.settlementService.test.ts lib/server/api/generationBilling/__tests__/ownershipResolver.test.ts lib/server/api/__tests__/generationReconcile.test.ts lib/server/api/__tests__/generationAbandonment.test.ts tests/api/admin-generation-trace.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-fleet-scan.test.ts`
  - Passed: 10 files, 75 tests.
- `npm -C frontend run test -- --run tests/api/fal-submit-proxy.test.ts`
  - Passed: 1 file, 29 tests.
- `npm -C frontend run test -- --run lib/server/api/__tests__/generationOutputs.test.ts lib/server/api/__tests__/generationOutputConvergence.test.ts lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationBilling.settlementService.test.ts lib/server/api/generationBilling/__tests__/ownershipResolver.test.ts lib/server/api/__tests__/generationReconcile.test.ts lib/server/api/__tests__/generationAbandonment.test.ts tests/api/admin-generation-trace.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-fleet-scan.test.ts`
  - Passed: 10 files, 74 tests.
- `npm -C frontend run test -- --run lib/server/api/__tests__/generationLineageResolver.test.ts lib/server/api/__tests__/generationBilling.settlementService.test.ts lib/server/api/generationBilling/__tests__/ownershipResolver.test.ts lib/server/api/__tests__/generationReconcile.test.ts lib/server/api/__tests__/generationAbandonment.test.ts tests/api/admin-generation-trace.test.ts tests/lib/admin-user-health-deep-report.test.ts tests/lib/admin-user-health-fleet-scan.test.ts lib/server/api/__tests__/generationOutputConvergence.test.ts`
  - Passed: 9 files, 72 tests.
- `npm -C frontend run type-check:touched`
  - Passed.
- `git diff --check`
  - Passed.

Boundary:
- No UI/UX/behavior change, no billing policy change, no Supabase transform use, no commit/push/deploy.
- Fresh production route parity after deploy still resolved to `shortpulse-fug3hxhsc-kirk-artmans-projects.vercel.app` and remains deploy-gated for `/api/upload-video`, `/api/upload-audio`, and `/api/media/admit-image-asset`.
