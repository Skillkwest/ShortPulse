# AI Studio Expert Edit Evidence Index

## Purpose
Central index for evidence artifacts supporting the Expert Edit properties panel rollout.

## Artifacts
1. `2026-03-04-model-capability-notes.md`
   - Fal edit model prompt-capability evidence used to implement `editPromptPolicy`.
   - Source policy: official Fal model API docs.
2. `2026-03-12-markup-modal-parity-matrix.md`
   - Baseline-to-closure parity matrix for Expert Edit main stage vs Markup modal stage.
   - Includes architecture boundary notes, viewport-geometry closure (normalized offsets + aspect-fit modal stage), and strict validation command set.
3. `2026-03-12-aspect-framing-no-distortion-closure.md`
   - Aspect-switch closure artifact for no-distortion framing behavior across inline + modal stages.
   - Captures isotropic scene-space mapping contract and regression validation set.
4. `2026-03-13-expert-edit-session-persistence-markup-inpaint.md`
   - Closure artifact for unified Expert Edit page-session persistence (`layers` + `markup` + `inpaint`).
   - Captures hydration/remount behavior and strict validation command results.

## Maintenance
1. Add a dated artifact for any future provider-capability changes that affect Expert Edit guardrails.
2. Keep this index updated whenever a new evidence file is added.
