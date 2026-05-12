# AI Studio audio companion art planning set

- Created: 2026-05-11
- Status: complete
- Scope: planning and retained-memory closeout
- Primary plan: `docs/planning/ai-studio-audio-companion-art-plan-2026-05-11.md`

## Summary

Created and then rewrote the implementation planning set for generated audio companion art: a hidden branded image derived from the same user prompt as the audio and rendered as the audio ref-card background.

The retained plan now uses a stricter execution posture:

- generated audio only for the first rollout
- async companion art after audio success
- explicit audio-owned companion-art fields instead of the video poster contract
- hidden/internal image-generation seam rather than the public visible image route
- static gradient fallback for pending or failed art states
- explicit Phase 0 decision freezing before persistence or route work
- explicit entry/exit gates and stop rules for each phase

## Audited repo findings captured in the plan

- `StudioOutput` has no companion-art field today.
- audio generation and persistence do not create companion visuals today.
- audio cards already share one reusable rendering shell, which is the best rollout seam.
- `previewPosterUrl` is effectively a video contract and should not be overloaded casually.
- session snapshot persistence must be updated explicitly if the art is meant to survive restore.
- the repo already has a strong hidden prompt-transformation precedent for prompt normalization and style application.
- the public image-generation route is the wrong seam for hidden companion art unless it is materially adapted.

## Rewrite audit summary

The rewritten plan tightens the earlier draft by making these items first-class:

- billing and ownership rules
- delete/reroll/restore lifecycle behavior
- historical backfill/replay posture
- exact implementation authority seams
- durable server-side trigger ownership for the companion-art job
- moderation and normalization behavior for audio-to-image prompt conversion
- async retry/idempotency behavior
- storage/privacy inheritance for the companion asset
- audio-card-only scope versus remuxed video surfaces
- a concrete validation matrix
- UI fallback and non-generated-audio parity decisions
- hidden-vs-visible media-surface leakage

## Retained memory note

This report is the local artifact pointer for the audio companion-art lane. The active execution source remains the planning doc above; this report exists so a later session can recover the lane quickly from the Ophestivus artifact namespace.
