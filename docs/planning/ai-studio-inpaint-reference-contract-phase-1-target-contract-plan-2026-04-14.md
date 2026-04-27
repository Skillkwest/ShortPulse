# AI Studio Inpaint Reference Contract Phase 1: Target Contract Plan (2026-04-14)

Status: draft  
Owner: Engineering

## Goal
Lock the supported inpaint behavior before any implementation changes land.

## Scope
Phase 1 must explicitly decide:
1. whether inpaint is:
   - single-image masked edit with `@main` only, or
   - multi-reference masked edit with `@main + @img1/@img2/@img3` as real provider inputs,
2. what each prompt token means in inpaint versus standard edit,
3. what authoring affordances are supported in inpaint:
   - manual typing,
   - `@` picker,
   - drag-to-insert from reference slots,
4. what the mask contract requires,
5. whether the current FLUX Fill lane remains the correct provider path,
6. whether a model change implies a debit/polling/status-path change.

## Required Decisions
1. Token semantics:
   - `@main`
   - `@img1`
   - `@img2`
   - `@img3`
2. Lane-specific authoring semantics:
   - which tokens appear in the `@` picker while inpaint is active,
   - whether reference-slot drag-to-insert remains enabled in inpaint,
   - whether unsupported tokens are hidden, blocked, or warned.
3. Scope of reference influence:
   - masked region only,
   - broader style influence,
   - or unsupported in the inpaint lane.
4. Mask semantics:
   - required polarity,
   - dimensions,
   - framing/alignment expectations,
   - selected-layer scope,
   - behavior for unmasked regions.
5. Provider-lane posture:
   - keep FLUX Fill and constrain tokens accordingly,
   - or move inpaint to a provider/model path that truly supports linked secondary references.
6. Model-authority posture:
   - whether any model change requires updated debit, polling-provider, and route documentation.

## Deliverables
1. a written inpaint contract decision,
2. an explicit supported-token matrix by lane,
3. an explicit authoring-affordance matrix by lane,
4. an explicit mask contract,
5. a go/no-go decision on whether FLUX Fill remains the inpaint submit lane,
6. an explicit note on whether debit/polling contracts change with the chosen lane.

## Non-Goals
1. No code edits in this phase.
2. No partial payload tweaks before the contract decision is written down.
3. No generic “we will figure it out in implementation” placeholders around tokens, mask polarity, or provider capabilities.

## Entry Criteria
1. The current audit findings are accepted as accurate.
2. The team agrees that prompt-only secondary references are not an acceptable end state if the product promise requires real linked-image conditioning.

## Exit Criteria
1. The supported inpaint contract is explicit.
2. The supported token set is explicit by lane.
3. The supported authoring affordances are explicit by lane.
4. The mask contract is explicit.
5. The chosen provider-lane direction is explicit.
6. There is no open ambiguity about whether `@img1/@img2/@img3` are supported in inpaint.
7. There is no open ambiguity about whether model changes require debit/polling updates.

## Validation
1. Confirm the chosen contract can be stated in one short user-facing explanation.
2. Confirm the chosen contract is implementable with the selected provider/model lane.
3. Confirm the chosen contract is strict enough to drive tests in later phases.
4. Confirm the chosen contract can replace the currently ambiguous inpaint authoring UX without hidden exceptions.

## Rollback Note
If Phase 1 cannot produce a clear contract, stop the program and keep current behavior documented as the baseline rather than drifting into implementation.
