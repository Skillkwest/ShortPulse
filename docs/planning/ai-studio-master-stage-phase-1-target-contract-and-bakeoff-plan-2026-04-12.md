# AI Studio Master Stage Phase 1: Target Contract And Bakeoff Plan (2026-04-12)

Status: Completed  
Owner: Engineering

## Goal
Lock the rebuild contract before implementation and choose the rendering substrate that best supports the target editor model.

## Scope
Phase 1 must produce:
1. the canonical `workspace -> artboard -> layer -> export` contract,
2. the initial stage data model,
3. the interaction contract for move/resize/rotate,
4. a small implementation bakeoff across the candidate substrates,
5. a recorded decision on which substrate the rebuild will use.

## Candidate Substrates
Evaluate only these options:
1. current DOM/CSS-transformed stage approach,
2. Konva,
3. Fabric.js.

The bakeoff is not a product build. It is only a decision tool.

## Required Bakeoff Behaviors
Each candidate must demonstrate:
1. bounded artboard inside a larger workspace,
2. zoom relative to pointer or equivalent ergonomic zoom behavior,
3. panning independent from document geometry,
4. one image layer that supports move, resize, and rotate,
5. one basic export path that can flatten the artboard.

## Deliverables
1. canonical transform chain and data-model notes added to implementation comments or follow-on issue packet,
2. chosen substrate recorded in implementation notes for Phase 2 entry,
3. list of rejected options with concise reasons,
4. risk list for the chosen substrate.

## Decision Outcome (2026-04-12)
Chosen substrate:
1. DOM/CSS-transformed stage using the repo's existing geometry and transform helpers as the canonical direction.

Bakeoff implementation:
1. dev-only lab route at `/dev/ai-studio-stage-bakeoff`,
2. isolated candidates for DOM/CSS, Konva, and Fabric.js,
3. shared artboard, layer, zoom, and export contract under `frontend/features/ai-studio/components/edit/bakeoff/`.

Rejected options:
1. Konva
   - strong built-in transform ergonomics,
   - rejected as the primary substrate because it introduces a second node/scene model that must be translated back into the repo's canonical artboard/document geometry.
2. Fabric.js
   - strong object-control primitives,
   - rejected because it is the heaviest dependency, the most imperative state model, and the least aligned with the existing Expert Edit geometry/export seams.

Recorded risks for the chosen substrate:
1. transform handles, selection overlays, and gesture ergonomics remain fully owned by repo code,
2. performance tuning must be watched as layer count and overlay complexity increase,
3. Phase 3 and Phase 4 must keep one coordinate system authoritative and avoid recreating hidden secondary transform ownership.

## Explicit Non-Goals
1. No production migration in this phase.
2. No deletion of current stage systems yet.
3. No provider submit changes.
4. No persistence changes.

## Entry Criteria
1. `docs/planning/ai-studio-master-stage-rebuild-spec-2026-04-12.md` is the accepted planning baseline.
2. Existing stage-related ADRs have been reconciled with the rebuild direction.

## Exit Criteria
1. one substrate is chosen,
2. the target contracts are explicit enough for Phase 2 deletions and Phase 3 extraction,
3. open risks are documented,
4. the phase does not leave unresolved ambiguity around workspace/artboard/document ownership.

## Validation
1. Verify the bakeoff covers the required behaviors above.
2. Record whether each candidate cleanly supports the target transform chain.
3. Confirm the chosen substrate does not force duplicate coordinate systems or duplicate transform ownership.

## Rollback Note
If the bakeoff does not produce a clear decision, do not begin Phase 2 or Phase 3. Stop and publish the unresolved constraints instead of drifting into implementation.
