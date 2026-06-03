# ShortPulse Backlog

Last audited: 2026-06-03
Status: active

How to use:

- Keep this list execution-focused and current.
- Start with `docs/planning/execution-authority.md` before opening a new lane.
- Open new work only from a catalog weakness, a known issue, a failing test/live repro, or a blocker discovered inside the current lane.
- For launch-readiness sequencing, keep this backlog aligned with the current Copperknot queue and systems catalog rather than treating it as an isolated planning surface.
- If a newer source of truth contradicts this file, update this backlog before using the stale item to justify work.
- In this file, "below launch-readiness target" means the current readiness docs still treat that workflow or system as not yet ready to ship with confidence.
- Move major outcomes into `docs/change_log.md`.
- Keep section structure locked (no urgency/priority sub-sections).

Structure (locked):

- `Program 0: Execution Authority`
- `Program 1: Runtime And Money`
- `Program 2: Media And Reference Integrity`
- `Program 3: Structural Decomposition`
- `Program 4: Workflows And Product Surfaces`
- `Program 5: Release Confidence And Research`

## Program 0: Execution Authority

## Program 1: Runtime And Money

- [ ] Execute the Bactuo generation architecture consolidation plan in staged slices, starting with a canonical lineage resolver and one universal settlement-before-visibility rule across async and direct provider families.
      Reference: `docs/agents/bactuo/generation-architecture-consolidation-plan-2026-06-03.md`
      Restart scope: begin with identity/lineage consolidation in recovery, billing, ownership, abandonment, and diagnostics before broader orchestrator splitting or cleanup.

## Program 2: Media And Reference Integrity

- [ ] Audit and resolve the AI Studio passive wheel runtime warning at the canonical gesture-plumbing seam, treating it as a separate lane from the signed-media preview failures.
      Reference: `docs/records/evidence/ux/2026-06-02-ai-studio-passive-wheel-warning-audit.md`
      Restart scope: production `https://www.shortpulse.ai`, compare fresh project open versus same-session project switching before editing gesture or restore code.

## Program 3: Structural Decomposition

- [ ] Split oversized AI Studio orchestration surfaces once the current runtime and media behavior is stable, focusing on `frontend/features/ai-studio/routes/AiStudioRouteApp.tsx` and `frontend/features/ai-studio/components/AiStudioPageContent.tsx` now that `frontend/pages/ai-studio.tsx` is only a thin dynamic entry.
- [ ] Split oversized AI Studio properties-panel surfaces once behavior is stable, starting with `frontend/features/ai-studio/components/VoicesPropertiesPanel.tsx` and `frontend/features/ai-studio/components/VideoPropertiesPanel.tsx`.
- [ ] Split oversized shared runtime modules into smaller ownership seams once convergence behavior is stable, starting with `frontend/lib/server/falIntegration/recoveryExecution.ts` and `frontend/lib/server/api/falStatusProxy.ts`.
- [ ] Revisit typography foundation cleanup after the low-risk Google Fonts import removal: decide whether system fonts should become the canonical primary stack, then normalize remaining hard-coded `Inter` / `Satoshi` references and refresh the related design inventory docs.
      Reference: `frontend/styles/foundation.css`, `frontend/features/character-manager/components/CharacterDescriptionEditorCard.tsx`, `frontend/features/elements-manager/components/ElementsDescriptionEditorCard.tsx`, `docs/design/ai-studio-style-inventory.md`

## Program 4: Workflows And Product Surfaces

- [ ] Build a complete, polished collection of small delete buttons.
- [ ] Build a complete, polished collection of small save buttons.
- [ ] Finish the Dashboard redesign pass by retiring the remaining staged/legacy posture and tightening the long-term styling structure.

## Program 5: Release Confidence And Research
