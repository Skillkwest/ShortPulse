# AI Studio Inpaint Reference Contract Phase 3: Lane And Payload Alignment Plan (2026-04-14)

Status: Planned  
Owner: Engineering

## Goal
Make prompt authoring, prompt compilation, reference-input handling, preflight work, and provider payload transmission match the chosen inpaint contract.

## Scope
Phase 3 covers:
1. lane-aware token handling,
2. lane-aware `@` picker behavior,
3. lane-aware drag-to-insert behavior,
4. lane-aware reference-input construction and ordering,
5. lane-aware image preflight,
6. inpaint submit override construction,
7. final provider payload transmission.

## Implementation Paths
Phase 3 must follow exactly one of these paths:

### Path A: Single-image FLUX Fill
1. Keep FLUX Fill as the inpaint lane.
2. Keep `@main` as the only supported inpaint image token.
3. Hide, block, or explicitly warn on `@img1/@img2/@img3` in inpaint authoring.
4. Remove secondary-slot insertion affordances from inpaint if they are unsupported.
5. Stop preflighting secondary refs that will never be transmitted.
6. Ensure the prompt compiler cannot imply figures the provider never receives.

### Path B: Multi-reference masked edit
1. Replace or augment the current inpaint provider/model lane with one that truly accepts linked secondary references.
2. Map `@main/@img1/@img2/@img3` into real provider payload inputs.
3. Keep the `@` picker and drag insertion aligned with those real payload capabilities.
4. Keep prompt compilation aligned with the real transmitted payload.
5. Preserve standard edit behavior while isolating the new inpaint lane semantics.

## Required Invariants
1. The authoring surface must not offer tokens the lane cannot honor.
2. Reference-input ordering must be deterministic and testable.
3. Inpaint must not silently preflight and drop linked refs under the final contract.
4. Standard edit and markup behavior must not regress while token logic becomes lane-aware.

## Deliverables
1. prompt authoring behavior that matches the chosen contract,
2. provider payload behavior that matches the chosen contract,
3. token behavior that matches transmitted inputs,
4. lane-aware preflight behavior,
5. regression coverage for the chosen path.

## Non-Goals
1. No mask/UI hardening beyond what is necessary to keep payload work correct.
2. No unrelated provider migration work.

## Entry Criteria
1. Phase 1 contract is locked.
2. Phase 2 guardrails identify the touched seams and stop rules.

## Exit Criteria
1. Inpaint prompt authoring no longer advertises unsupported token behavior.
2. Inpaint prompt-link behavior no longer overpromises provider capabilities.
3. Unsupported secondary refs are not silently preflighted and dropped.
4. Supported refs, if any, are present in the real provider payload.
5. Standard non-inpaint edit lanes retain their expected linked-reference behavior.

## Validation
1. Add payload assertions for the inpaint lane.
2. Add lane-aware token tests.
3. Add lane-aware picker/drag affordance tests.
4. Confirm there is no remaining path where inpaint prompt text references an image the provider never receives.
5. Confirm there is no remaining path where inpaint authoring offers an insertion path for an unsupported token.

## Rollback Note
If payload alignment introduces instability, revert to the last known-good single-image payload path and disable unsupported inpaint secondary-link behavior in the authoring surface until the provider lane is corrected.
