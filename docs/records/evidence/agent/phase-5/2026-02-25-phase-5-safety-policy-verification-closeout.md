# Phase 5 Evidence: Safety-Policy Verification + Closeout (2026-02-25)

## Scope
- Close Workstream C for Foundational Hardening Program v2.
- Verify image-model safety payload settings against official fal.ai model docs.
- Confirm runtime/tests/docs stay aligned and gates remain green.

## Model-by-model verification (official docs)
Verification date: 2026-02-25 (UTC)

1. `fal-ai/flux-2/klein/9b`
   - Source: https://fal.ai/models/fal-ai/flux-2/klein/9b/api
   - Supports: `enable_safety_checker`
   - No `safety_tolerance` field documented.
2. `fal/flux-2`
   - Source: https://fal.ai/models/fal-ai/flux-2/api
   - Supports: `enable_safety_checker`
   - No `safety_tolerance` field documented.
3. `fal/flux-2/edit`
   - Source: https://fal.ai/models/fal-ai/flux-2/edit/api
   - Supports: `enable_safety_checker`
   - No `safety_tolerance` field documented.
4. `fal/flux-2-pro`
   - Source: https://fal.ai/models/fal-ai/flux-2-pro/api
   - Supports: `enable_safety_checker` and `safety_tolerance` (`"1"`..`"5"`).
5. `fal/flux-2-pro/edit`
   - Source: https://fal.ai/models/fal-ai/flux-2-pro/edit/api
   - Supports: `enable_safety_checker` and `safety_tolerance` (`"1"`..`"5"`).
6. `fal-ai/bytedance/seedream/v4.5/text-to-image`
   - Source: https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image/api
   - Supports: `enable_safety_checker`
   - No `safety_tolerance` field documented.
7. `fal-ai/bytedance/seedream/v4.5/edit`
   - Source: https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit/api
   - Supports: `enable_safety_checker`
   - No `safety_tolerance` field documented.

## Runtime alignment
Policy source:
- `frontend/features/ai-studio/hooks/taskSubmission/safetyPolicy.ts`

Effective payload policy:
1. FLUX.2 Lite / FLUX.2 / FLUX.2 Edit / Seedream text / Seedream edit:
   - `enable_safety_checker: false`
2. FLUX.2 Pro / FLUX.2 Pro Edit:
   - `enable_safety_checker: false`
   - `safety_tolerance: "5"` (minimum-restriction supported tolerance)

## Catalog/doc fix included in closeout
1. Updated Seedream text model `sourceUrl` to canonical fal docs endpoint in:
   - `frontend/lib/model-runtime/modelCatalog.ts`
2. Validation check (2026-02-25 UTC):
   - `https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/api` -> HTTP `404`
   - `https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image/api` -> HTTP `200`

## Regression/gate results
1. `npm -C frontend run type-check` -> pass
2. `npm -C frontend run lint` -> pass
3. `npm -C frontend run test` -> pass (`200` files, `1006` tests)
4. `npm -C frontend run build` -> pass

## Closeout
1. Workstream C is complete.
2. Program v2 A/B/C status: complete with no contract/version changes.
