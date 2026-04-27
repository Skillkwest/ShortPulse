# AI Studio Pulse Runtime Decision Log (2026-04-20)

Last updated: 2026-04-20
Status: complete

## Decision 001
- Topic: V1 Pulse product identity.
- Decision: V1 Pulse is a saved Create agent profile, not a prompt helper or preset text snippet.
- Effective phase: 0.

## Decision 002
- Topic: Runtime architecture scope.
- Decision: V1 is implemented as a profile-aware layer on top of the existing AI Studio prompt-compiler runtime, not as a full multi-agent platform rewrite.
- Effective phases: 0-7.

## Decision 003
- Topic: Activation semantics.
- Decision: Activating a Pulse changes hidden runtime behavior and must not append instructions into the visible composer.
- Effective phases: 0, 5, 6.

## Decision 004
- Topic: Runtime cardinality.
- Decision: Only one active Pulse at a time is supported in V1.
- Effective phases: 0-7.

## Decision 005
- Topic: Persistence separation.
- Decision: Saved Pulse definitions and active Pulse runtime state are separate contracts and must remain separate in persistence.
- Effective phases: 1-7.

## Decision 006
- Topic: Authoring workflow scope.
- Decision: The Pulse creation and management workflow is core program scope. V1 is not complete if runtime activation works but users still lack a coherent build/configure/save/manage flow.
- Effective phases: 1, 6, 7.

## Decision 007
- Topic: Surface authority.
- Decision: The Create rail and Pulse library must resolve from the same saved-definition source of truth once runtime work begins.
- Effective phases: 1, 6, 7.

## Decision 008
- Topic: Client composition seam.
- Decision: Page-level ownership in `frontend/pages/ai-studio.tsx` and composition through `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts` are part of the core implementation path, not optional cleanup work.
- Effective phases: 2, 6.

## Decision 009
- Topic: Session persistence posture.
- Decision: Pulse restore work must be schema-safe and hydrator-aware. No ad hoc snapshot field drift is allowed.
- Effective phases: 3, 7.

## Decision 010
- Topic: Transport scope.
- Decision: Pulse metadata must propagate through `AgentContext`, `useAiAgent`, the client transport, and the route envelope before server behavior changes.
- Effective phases: 4, 5.

## Decision 011
- Topic: Shell/layout risk.
- Decision: Pulse mode shell/layout behaviors are considered first-class regression surfaces during activation and restore work.
- Effective phases: 2, 3, 6, 7.

## Decision 012
- Topic: Reuse policy.
- Decision: Reuse the stronger Expert Edit preset persistence pattern where it reduces risk, instead of inventing a new Create-only preference path.
- Effective phases: 1, 6.

## Decision 013
- Topic: Rollout discipline.
- Decision: Docs and tests are required deliverables for the Pulse runtime program, and user-facing custom-GPT-equivalent claims remain gated until runtime behavior is real end to end.
- Effective phases: 7.

## Decision 014
- Topic: Submission-path parity.
- Decision: Pulse cannot ship as a real runtime if Create still exposes a second non-Pulse-aware submission path to Pulse users. The direct OpenAI bypass path must either become Pulse-aware or be disabled while Pulse is active.
- Effective phases: 0, 5, 7.

## Decision 015
- Topic: Pulse-mode shell semantics.
- Decision: Chat-mode force-on, Styles suppression, and any similar Pulse-mode shell behavior must be explicit product decisions in Phase 0 rather than accidental carryover from the current append-only implementation.
- Effective phases: 0, 2, 6.

## Decision 016
- Topic: Rail topology authority.
- Decision: The plan must explicitly decide whether the Create Pulse rail shows all saved Pulses or a curated subset such as pinned/favorited/recent Pulses, because the current repo has a separate selected-panel-id model.
- Effective phases: 0, 2, 6.

## Decision 017
- Topic: Session-persistence gate alignment.
- Decision: Pulse restore behavior must respect the broader AI Studio session-persistence policy and feature flags. Pulse-specific restore cannot be treated as unconditional behavior independent from the wider session system.
- Effective phases: 0, 3, 7.

## Decision 018
- Topic: Multimodal/runtime context posture.
- Decision: The plan must explicitly define what attachments, references, and workspace context an active Pulse can see, and keep runtime-only Pulse state out of model-visible history unless intentionally exposed.
- Effective phases: 0, 4, 5, 7.

## Decision 019
- Topic: Observability and eval posture.
- Decision: Pulse runtime closeout requires telemetry for activation, resolution, fallback, and failure behavior, plus an explicit eval/verification posture for authoring and runtime flows. This cannot be left as implicit testing only.
- Effective phases: 5, 7.

## Decision 020
- Topic: Program completion authority.
- Decision: Once the master-plan done state and Phase 7 exit criteria are satisfied, the Pulse runtime program is complete, implementation must stop, and later requests to "continue" this same program should be treated as accidental unless they introduce a new separately scoped problem statement.
- Effective phase: 7.
