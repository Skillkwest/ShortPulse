# Phase 5 Evidence: Image Safety Payload Alignment

Date: 2026-02-25  
Scope: Workstream C (Safety-policy track), image submission paths only.

## Why this slice
1. Safety payload fields were hardcoded across handlers, creating drift risk.
2. Seedream text safety behavior was not fully aligned across runtime and docs.
3. Program goal requires minimum-restriction payload settings per supported model API.

## Runtime changes
1. Added centralized resolver:
   - `frontend/features/ai-studio/hooks/taskSubmission/safetyPolicy.ts`
2. Wired image submit handlers to policy:
   - `frontend/features/ai-studio/hooks/taskSubmission/defaultHandlers.ts`
   - `frontend/features/ai-studio/hooks/taskSubmission/imageHandlers.ts`

## Effective payload policy (image models)
1. `fal-ai/flux-2/klein/9b`: `enable_safety_checker: false`
2. `fal/flux-2`: `enable_safety_checker: false`
3. `fal/flux-2/edit`: `enable_safety_checker: false`
4. `fal/flux-2-pro`: `enable_safety_checker: false`, `safety_tolerance: "5"`
5. `fal/flux-2-pro/edit`: `enable_safety_checker: false`, `safety_tolerance: "5"`
6. `fal-ai/bytedance/seedream/v4.5/text-to-image`: `enable_safety_checker: false`
7. `fal-ai/bytedance/seedream/v4.5/edit`: `enable_safety_checker: false`

## Regression evidence
1. Added policy unit tests:
   - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/safetyPolicy.test.ts`
2. Extended submission matrix assertions:
   - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
3. Targeted test run (all green):
   - `safetyPolicy.test.ts`
   - `submissionPayloadMatrix.test.ts`
   - `seedreamSubmission.test.ts`

## Docs synchronized
1. `docs/sops/sop_ai_studio_index.md`
2. `docs/sops/sop_image_generation.md`
3. `docs/api/api-fal-flux-2.md`
4. `docs/api/api-fal-flux-2-klein-9b.md`
5. `docs/api/api-fal-seedream-4-5.md`

## Remaining C-track items
1. Complete formal model-by-model verification pass record and close full C-track gate run.
2. Keep user-lane behavior unchanged (transient fallback / safety refusal / auth-config explicit error).
