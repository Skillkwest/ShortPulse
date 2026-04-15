# AI Studio Inpaint Reference Contract Master Plan (2026-04-14)

Status: Planned  
Owner: Engineering

## Goal
Resolve the full inpaint contract mismatch across prompt authoring, reference transport, mask export, Edit panel model authority, and durable docs so the shipped behavior matches the user promise and the actual provider payload.

## Audit Corrections Applied To This Rewrite
The first draft was directionally correct but incomplete. This rewrite explicitly adds the gaps that matter for implementation:
1. lane-specific prompt authoring UX must be part of the contract, not just submit-time blocking,
2. the current generic Fal submit/status path must be part of the implementation plan,
3. preflight URL normalization and upload/refresh behavior must be treated as contract-critical,
4. billing, hidden-model cost override, and polling-provider mapping must be included if the inpaint model changes,
5. existing durable docs already drift from runtime truth and must be treated as an explicit work item, not a generic closeout note.

## Why This Program Exists
The current repo-backed audit established five separate but related problems:
1. Inpaint submits `image_url + mask_url + prompt` to `fal-ai/flux-pro/v1/fill`, but linked secondary references (`@img1`, `@img2`, `@img3`) do not survive into the final provider payload.
2. Prompt authoring still allows `@main`, `@img1`, `@img2`, and `@img3` semantics that are only partially true in the inpaint lane.
3. The Edit panel can display `Pulse Fill v1` while still sourcing resolution options from the stale selected edit model, which allows misleading options like `2K`.
4. The mask export path appears structurally correct, but its contract is only implicit; polarity, framing, selected-layer scope, and base/mask pairing should be made explicit before behavior-changing implementation proceeds.
5. Durable docs are already partially stale:
   - the prompt-reference SOP describes secondary references as provider `image_urls` behavior without qualifying the inpaint exception,
   - the FLUX Fill API doc still centers the legacy direct submit/status routes instead of the active generic image submit/status path.

## Locked Current-State Facts
These are the baseline facts this program must respect until a phase formally changes them:
1. Inpaint submit dispatch targets `fal-ai/flux-pro/v1/fill`.
2. The active client submit path for FLUX Fill uses the generic Fal routes:
   - `/api/fal/image-submit`
   - `/api/fal/image-status`
3. The current inpaint provider payload includes only:
   - `prompt`
   - `image_url`
   - `mask_url`
   - `num_images`
   - `output_format`
4. The current inpaint payload does not include a resolution field.
5. `@main` is functionally wired because the flattened primary canvas is sent as `image_url`.
6. `@img1`, `@img2`, and `@img3` can affect prompt compilation and preflight work, but are not transmitted to the FLUX Fill provider payload as actual image inputs.
7. Preflight currently prepares both:
   - linked reference inputs,
   - and the inpaint base/mask pair via `prepareImageUrlForSubmission()` upload/refresh normalization.
8. `fal-ai/flux-pro/v1/fill` is registered as `allowedResolutions: ["model_default"]`.
9. The current Edit panel UI does not consistently derive resolution/aspect behavior from the effective inpaint submit model.
10. Inpaint debit/polling behavior currently depends on the effective hidden submit model override path, not just the visible panel label.

## Program Outcomes
This program is successful when all of the following are true:
1. The inpaint lane contract is explicit about whether it is:
   - single-image masked edit with `@main` only, or
   - multi-reference masked edit with `@main + @img1/@img2/@img3` as real provider inputs.
2. Prompt authoring UX only advertises tokens and insertion affordances that the lane actually supports.
3. Prompt-token behavior matches actual transmitted provider inputs.
4. Preflight upload/refresh work only prepares images that the lane actually needs.
5. The mask contract is explicit and validated.
6. The Edit panel derives model, aspect, resolution, pricing, and lock behavior from one authoritative effective model id.
7. Hidden-model debit and polling behavior stay aligned with the chosen provider lane.
8. Durable docs clearly describe the supported inpaint behavior and the active route contract.

## Stop Rule
Do not implement secondary-reference support for inpaint until Phase 1 locks the lane contract. If the product requirement is multi-reference masked editing and the current FLUX Fill lane cannot support it, stop and change the provider/model lane instead of shipping prompt-only reference behavior or UI-only fixes.

## Program Phases
1. `docs/planning/ai-studio-inpaint-reference-contract-phase-1-target-contract-plan-2026-04-14.md`
2. `docs/planning/ai-studio-inpaint-reference-contract-phase-2-current-state-audit-and-guardrails-plan-2026-04-14.md`
3. `docs/planning/ai-studio-inpaint-reference-contract-phase-3-lane-and-payload-alignment-plan-2026-04-14.md`
4. `docs/planning/ai-studio-inpaint-reference-contract-phase-4-mask-and-ui-contract-hardening-plan-2026-04-14.md`
5. `docs/planning/ai-studio-inpaint-reference-contract-phase-5-validation-and-doc-closeout-plan-2026-04-14.md`

## Non-Goals
1. This program does not redesign the Expert Edit stage, selection, or transform system.
2. This program does not change non-inpaint edit model behavior except where shared prompt-link orchestration or panel authority must be made lane-aware.
3. This program does not reopen unrelated AI Studio generation pipeline work.

## Entry Criteria
1. The current audit findings are accepted as the planning baseline.
2. The implementation team agrees that no payload-changing work will land before the contract decision is explicit.
3. The active plan set and tracker are indexed in repo docs.

## Program Done State
The program is done when:
1. all five phases are marked `Completed` in the tracker,
2. the chosen inpaint contract is reflected in code, tests, and docs,
3. the prompt authoring surface no longer advertises unsupported token behavior,
4. prompt-link compilation no longer promises references that the provider never receives,
5. preflight/upload work no longer prepares dropped images for inpaint,
6. the Edit panel no longer displays stale resolution/aspect behavior for inpaint,
7. mask export and submission invariants are covered by focused validation,
8. the active route and provider docs match the shipped runtime.

## Rollback Posture
If implementation destabilizes inpaint behavior, revert to the last known-good single-image masked-edit contract, disable unsupported secondary-link behavior in the authoring surface, and restore the last verified submit/polling path rather than leaving the UI and payload contract out of sync.
