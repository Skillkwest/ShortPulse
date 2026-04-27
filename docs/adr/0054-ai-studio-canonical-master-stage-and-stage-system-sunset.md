# ADR 0054: AI Studio Canonical Master Stage And Stage-System Sunset

## Status
Accepted (implementation pending)

## Context
AI Studio currently carries multiple overlapping stage/editor systems:
1. the generic Canvas freeboard/editor system,
2. the Expert Edit stage,
3. legacy edit fallback paths,
4. right-rail canvas duplication,
5. inline versus modal stage interaction ownership.

This overlap makes the stage bulky, clunky, and expensive to evolve. It also obscures which system should own the future editing experience.

At the same time, product direction for the rebuilt editor is now clear:
1. one master workspace viewport,
2. one bounded aspect-ratio artboard,
3. layers positioned in artboard coordinates,
4. transform handles for move, resize, and rotate,
5. stage tools that reuse one canonical coordinate chain.

Existing ADRs remain useful but are insufficient as the final target:
1. ADR 0030 captured dual-canvas shared-scene behavior for the generic Canvas/right-rail system.
2. ADR 0034 captured inline/modal parity inside Expert Edit.
3. ADR 0045 captured canonical coordinate and interaction authority for Expert Edit.

The repo now needs one higher-level decision about which stage model is canonical and which stage systems are being sunset.

## Decision
1. Expert Edit becomes the canonical foundation for AI Studio's future editing stage.
2. The canonical editor model is `workspace -> artboard -> document/layers -> transform/tool overlays -> export`.
3. Generic Canvas is no longer the primary editor architecture for AI Studio stage work.
4. Right-rail canvas duplication is not part of the canonical editor future and must be removed or formally demoted out of the editor path.
5. The expanded modal must not remain a second interaction runtime. If it survives, it survives only as a presentation shell around the same canonical stage behavior.
6. Stage export and stage persistence must be explicit adapter boundaries, not mixed into provider submit orchestration.
7. New product work for the stage must target the canonical master-stage architecture, not the legacy overlap surfaces.

## Consequences
- Positive:
  - One editor model becomes the source of truth for future work.
  - Rebuild work can delete duplicate systems instead of preserving them indefinitely.
  - ADR 0045's coordinate-authority rules can remain valid inside a clearer stage architecture.
  - The repo gains a cleaner path to a Photoshop-like workspace/artboard/layer editor.
- Negative:
  - Existing generic Canvas and right-rail canvas work loses canonical status and may require migration or deletion.
  - The rebuild must carry explicit compatibility decisions rather than vague coexistence.
  - Some prior planning and tests will need to be updated or retired as the old systems are removed.
- Follow-ups:
  - Publish the master spec, tracker, and phase plans for the rebuild program.
  - Reconcile stage-related SOPs and tests during the cutover phases.
  - Record any narrowed exceptions explicitly if generic Canvas survives as a separate non-canonical product surface.

## Alternatives considered
- Option A: Keep generic Canvas and Expert Edit as co-equal stage systems.
  - Rejected because it preserves the same bulk, duplication, and unclear ownership that triggered the rebuild.
- Option B: Rebuild on the generic Canvas instead of Expert Edit.
  - Rejected because generic Canvas is closer to a freeboard scene than to the bounded artboard editor the product wants.
- Option C: Preserve modal and inline as separate interaction runtimes.
  - Rejected because duplicate interaction ownership reintroduces parity drift and maintenance overhead.

## Related
1. `docs/adr/0030-ai-studio-dual-canvas-right-rail-shared-scene.md`
2. `docs/adr/0034-ai-studio-expert-edit-shared-stage-interaction-parity.md`
3. `docs/adr/0045-ai-studio-expert-edit-canonical-coordinate-and-interaction-contract.md`
4. `docs/planning/ai-studio-master-stage-rebuild-spec-2026-04-12.md`
5. `docs/archive/planning/ai-studio-master-stage-rebuild-tracker-2026-04-12.md`
