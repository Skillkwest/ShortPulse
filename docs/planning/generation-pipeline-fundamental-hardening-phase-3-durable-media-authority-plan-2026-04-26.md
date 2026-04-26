# Generation Pipeline Fundamental Hardening Phase 3 Durable Media Authority Plan (2026-04-26)

Last updated: 2026-04-26  
Status: Not started  
Master plan: `docs/planning/generation-pipeline-fundamental-hardening-master-plan-2026-04-26.md`

## Goal
Make owned/generated media internally durable and storage-backed for current writes without changing what the user sees.

## Problem Statement
The repo still has current-write paths where:
1. provider URLs or signed URLs are persisted or treated like canonical durable authority
2. owned/generated outputs can remain readable only because transient delivery URLs are still fresh
3. Fal and ElevenLabs persistence do not fully converge on the same durable-authority standard

That creates a direct durability gap: a successful owned output can rot even though the repo considers it persisted.

## Durable-Authority Rule
For current writes in scope:
1. owned/generated media authority must be storage-backed internally
2. transient provider or signed URLs must be delivery surfaces only
3. read helpers must prefer the stronger owned-media authority for current writes

## In Scope
1. Fal terminal settlement and recovery paths that currently persist transient media URL authority
2. ElevenLabs generated audio and video persistence paths that currently allow transient signed URLs to behave like durable authority
3. read-side helpers that must prefer the stronger owned-media authority for current writes

## Primary Surfaces
1. `frontend/lib/server/api/directGenerationSettlement.ts`
2. `frontend/lib/server/falIntegration/recoveryExecution.ts`
3. `frontend/lib/server/elevenlabs.ts`
4. `frontend/features/ai-studio/logic/generatedMediaAuthority.ts`
5. `frontend/features/ai-studio/logic/referenceDownload.ts`

## Out Of Scope
1. delivery-UX redesign
2. generalized media-library cleanup
3. remote URL trust-boundary changes
4. historical fallback retirement unless directly required for current-write correctness
5. historical backfill work that is not required to keep current writes correct

## Entry Gate
1. Phase 2 complete
2. the direct durable-authority proof gaps from Phase 1 are closed

## Deliverables
1. a consistent current-write durable-authority rule across Fal and ElevenLabs
2. code changes that enforce that rule in the in-scope write paths
3. read-helper changes only where required to preserve current behavior on top of the stronger authority

## Exit Gate
1. current owned/generated writes no longer depend on transient provider or signed URLs as durable authority
2. owned-media reads prefer storage-backed authority for current writes
3. intended route behavior and UI-visible behavior stay unchanged
4. no historical cleanup or compatibility-retirement work was pulled in unless it was strictly required to keep current writes correct

## Validation
1. direct tests for the changed Fal and ElevenLabs authority paths pass
2. targeted client/persistence slices pass when read helpers change
3. targeted generation server/control-plane slices pass when settlement paths change

## Failure Conditions
Do not close this phase if:
1. a current-write success path still depends on transient URL freshness to remain durable
2. Fal and ElevenLabs still follow materially different durable-authority rules for owned/generated current writes
3. the phase drifts into generalized media cleanup or historical retirement work

## Stop Rule
Stop when durable current-write authority is normalized. Do not open a larger media cleanup lane under this phase.
