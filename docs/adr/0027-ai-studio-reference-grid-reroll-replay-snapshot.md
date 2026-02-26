# ADR 0027: AI Studio Reference-Grid Re-roll Replay Snapshot

## Status
Accepted

## Context
AI Studio needed a new card-level "Re-roll" action in the Reference Grid for generated image outputs.
The reroll action must reuse the original generation settings (model, prompt, aspect, resolution, references, character-applied context) while keeping existing inline Generate behavior unchanged.

Existing regenerate flows are tied to current panel state, which can drift from what was used by a historical output card.
Without an output-scoped replay snapshot, rerolling from a card can produce mismatched settings and regress UX expectations.

## Decision
- Introduce an output-scoped replay contract on `StudioOutput`:
  - `generationReplay?: GenerationReplayConfig` (v1 currently includes image-only replay data).
- Capture replay snapshots at submit-time inside `useAiStudioTaskSubmission`, using resolved effective values used for provider submission.
- Add a dedicated reroll pathway (`rerollOutputFromReplay`) in `useAiStudioState` that:
  - validates replay payload,
  - submits using replay overrides,
  - does not mutate inline Generate wiring.
- Scope reroll UI to Reference Grid image cards only and gate visibility by:
  - generated media source,
  - valid replay payload,
  - all-refs surface (not curated action row).
- Hide reroll on legacy cards that do not have replay snapshots (no fallback to current panel state in v1).

## Consequences
- Positive:
  - Re-roll behavior is deterministic to card-captured settings instead of volatile current UI state.
  - New functionality is decoupled from existing inline Generate pipeline, reducing regression risk.
  - Replay logic is centralized and unit-testable via `generationReplay.ts`.
- Negative:
  - Legacy outputs created before replay capture do not show reroll in v1.
  - Replay data increases `StudioOutput` payload size slightly.
- Follow-ups:
  - Consider optional legacy hydration from persisted `ai_generations` metadata in a future phase.
  - Extend replay contract to video workflows when requirements are finalized.

## Alternatives considered
- Option A: Reuse existing regenerate path against current panel state.
  - Rejected: does not guarantee same settings as original card generation.
- Option B: Fetch replay config lazily from provider request logs on reroll click.
  - Rejected for v1: introduces runtime coupling/latency and cannot guarantee long-term provider payload availability.
