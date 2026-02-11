# ADR 0005: AI Studio Modularization Boundaries

## Status
Accepted

## Context
`useAiStudioState.ts` and `ReferencePropertiesPanel.tsx` had grown into multi-responsibility files that mixed UI orchestration, provider submission branching, drag/drop interaction plumbing, and persistence side effects.

This slowed onboarding and increased regression risk because changing one concern required editing large monoliths.

## Decision
Adopt explicit modular boundaries for AI Studio feature code:

1. Keep `useAiStudioState.ts` as orchestration-focused state composition.
2. Move generation submission branching into `useAiStudioTaskSubmission.ts`.
3. Move reference panel interaction/drag-drop handlers into `useReferencePropertiesInteractions.ts`.
4. Keep provider-specific API behavior unchanged during modular splits; refactors are structure-first, behavior-preserving.

## Consequences
- Positive:
  - Smaller, more discoverable modules with clear ownership.
  - Lower-risk edits for provider-submission and UI interaction changes.
  - Easier targeted tests for extracted modules.
- Negative:
  - More files and imports to navigate.
  - Some modules are still large and need incremental follow-up decomposition.
- Follow-ups:
  - Split `useAiStudioTaskSubmission.ts` by provider family (`video`, `image`, `fallback/default`).
  - Split `ReferencePropertiesPanel.tsx` rendering into step-level components.

## Alternatives considered
- Option A: Leave files as-is and rely on comments/regions.
  - Rejected due to continued high cognitive load and change risk.
- Option B: Rewrite AI Studio flows in one large migration.
  - Rejected due to behavior risk; incremental extraction is safer.
