# ADR 0053: AI Studio Character Surface Ownership and Image Performance Contract

## Status
Accepted

## Context
The repo has two visible character-management surfaces:
1. The AI Studio Character panel.
2. The standalone `/character` route.

The AI Studio panel already embeds the shared Character Manager workflow, but the surrounding product model still leaves room for ambiguity about which surface is primary. That ambiguity makes it harder to design the character experience as the main place where users manage references, profiles, and QuickSwap assets.

The character surface also contains image-dense regions:
1. reference grids,
2. QuickSwap decks,
3. image-driven profile and character-sheet thumbnails.

The Media Library already solved several related performance problems in-repo with width-aware grid sizing, shared preview/runtime helpers, and adaptive pressure. The character surface should reuse those ideas where applicable instead of inventing a second set of image-loading heuristics.

## Decision
1. Treat the AI Studio Character panel as the primary management surface for character work.
2. Treat `/character` as a secondary entrypoint, fallback route, or deep link, not the product's primary home.
3. Keep Create/Edit character pickers separate and selection-only.
4. For image-dense character regions, prefer Media Library-style performance patterns:
   - width-aware column budgets,
   - readable thumbnail sizing,
   - adaptive load pressure or virtualization only when the density justifies it.
5. Preserve the character-specific media delivery policy already locked by ADR 0044:
   - durable preview variants first for character cards,
   - preserve direct signed URLs where the character resolver already requires them,
   - do not force Media Library sign-batch preview profiles into Character Manager in this lane,
   - keep character preview/detail overlays full-quality and non-adaptive.
6. Preserve a shared workflow substrate so AI Studio and `/character` do not fork into separate character-management implementations.

## Consequences
- Positive:
  - Makes the AI Studio panel the clear home for character work.
  - Reduces ambiguity about where character management lives.
  - Gives the character surface a known internal reference for image-heavy performance work without forcing runtime convergence where it is not warranted.
  - Preserves separate picker surfaces for lightweight selection flows.
- Negative:
  - `/character` is no longer the clearly primary user-facing home, so route docs and expectations must be explicit.
  - Image-performance decisions become more deliberate because the primary surface must stay readable and fast while preserving the existing delivery-policy split.
- Follow-ups:
  - Keep the implementation plan aligned with this ADR.
  - Update route and SOP docs after the implementation slice lands.
  - Add focused regression tests around image-density and surface ownership.

## Alternatives considered
- Option A: keep `/character` as the primary surface.
  - Rejected because it keeps the AI Studio panel in a secondary role even though that is where generation and character work already converge.
- Option B: fork separate character-management implementations for AI Studio and `/character`.
  - Rejected because it would duplicate persistence and workflow logic.
- Option C: make the AI Studio panel primary but invent new image-loading heuristics just for characters.
  - Rejected because the Media Library already established a good internal pattern for this class of problem.
- Option D: port the Media Library preview-runtime/sign-batch surface stack directly into Character Manager.
  - Rejected because Character Manager already has a lighter character-specific delivery contract and should not inherit Media Library runtime ownership by default.
