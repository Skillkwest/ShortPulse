# Media Rendering Hardening v2 Surface Lane Execution Plan (2026-03-18)

Last updated: 2026-03-18  
Status: active  
Primary control docs:
- [Surface lane master plan](./media-rendering-hardening-v2-surface-lane-master-plan-2026-03-18.md)
- [Master execution tracker](./media-rendering-hardening-v2-execution-tracker-2026-03-16.md)
- [Decision log](./media-rendering-hardening-v2-decision-log-2026-03-16.md)
- [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
- [Image surface inventory lock](./media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md)
- [Test realignment matrix](./media-rendering-hardening-v2-test-realignment-matrix-2026-03-18.md)
- [Evidence root](../records/evidence/media-rendering-hardening-v2/README.md)

## Purpose
Convert the Surface lane strategy into concrete, no-bloat slices that apply accepted policy and hardened server truth to real renderers without introducing regressions.

## Scope Lock
Allowed in this lane:
1. Hot-path surface adoption for media-library, reference-grid, character, and detail surfaces.
2. Render-cost and anti-bloat changes for hot render loops.
3. Long-tail surface parity work.
4. Rollout and decommission coordination.

Not allowed in this lane:
1. Policy invention that bypasses Foundation decisions.
2. Server-contract changes owned by Pipeline.
3. New product feature scope unrelated to image/media rendering.

## Slice Backlog
### MRH2-P3-001: Hot-Path Surface Contract Unification
Acceptance:
1. Route, modal, panel, and reference-grid all consume accepted policy instead of divergent legacy assumptions.
2. Fallback order and preview/full behavior are explicit in the renderer path.
3. Protected adaptive/reference-grid tests and surface smoke are aligned to accepted policy.

Repo seams:
1. historical standalone Media Library page image-grid seam
2. `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx`
3. `frontend/features/ai-studio/components/MediaLibraryPanel.tsx`
4. `frontend/features/media-library/logic/mediaLibraryAdaptivePreview.ts`
5. `frontend/features/ai-studio/logic/referenceGridMedia.ts`

Required docs:
1. [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
2. [Test realignment matrix](./media-rendering-hardening-v2-test-realignment-matrix-2026-03-18.md)

### MRH2-P3-002: Character, Detail, And Modal Preview Surface Inclusion
Acceptance:
1. Character-grid and detail-modal are explicitly included in the unified surface contract.
2. Character-specific `unoptimized` usage is either justified by policy or removed intentionally in later implementation slices.
3. Detail-modal and media-library modal-preview full-quality behavior remains deliberate and evidenced, not accidental.

Repo seams:
1. `frontend/features/character-manager/components/CharacterManagerShell.tsx`
2. `frontend/features/character-manager/components/CharacterQuickSwapDeckSection.tsx`
3. `frontend/features/ai-studio/components/DetailModal.tsx`
4. `frontend/features/media-library/components/MediaFileModal.tsx`
5. `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPanelPreviewModal.tsx`

Required docs:
1. [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
2. [Image surface inventory lock](./media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md)

### MRH2-P7-001: Render Hot Loops
Acceptance:
1. Hot render loops no longer do avoidable full-list work on every update.
2. Visible-window render cost is favored over full-list recomputation.
3. Perf evidence is captured against approved baseline metrics only.

Repo seams:
1. `frontend/features/media-library/logic/mediaGridVirtualization.ts`
2. `frontend/features/media-library/hooks/useMediaMasonryVirtualization.ts`
3. route/modal grids that consume the virtualization output

Required docs:
1. [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)
2. [Telemetry baseline truth spec](./media-rendering-hardening-v2-telemetry-baseline-truth-spec-2026-03-18.md)

### MRH2-P7-002: Media Guardrails
Acceptance:
1. Media hotspot size and architecture boundaries are enforced for touched surfaces.
2. Guardrails are specific enough to block real regressions, not generate noisy false positives.
3. Warning-mode escape hatches have explicit sunset if they are needed at all.

Repo seams:
1. shared render logic touched by surface slices
2. media hotspot modules identified during `P3` and `P7`

Required docs:
1. [Surface lane master plan](./media-rendering-hardening-v2-surface-lane-master-plan-2026-03-18.md)
2. [Master plan](./media-rendering-hardening-v2-master-plan-2026-03-16.md)

### MRH2-P8-001: Long-Tail Surface Sweep
Acceptance:
1. Long-tail surfaces are treated per surface, not by one bucket.
2. Dashboard, landing, performance, saved-creators, prefabs, and other discovered long-tail surfaces have explicit parity or defer decisions.
3. Long-tail work does not regress hot-path surfaces or reopen policy drift.
4. Prompt-step attachment previews and canvas/editor image surfaces are not left outside the long-tail sweep.

Repo seams:
1. `frontend/pages/dashboard.tsx`
2. `frontend/pages/landing.tsx`
3. `frontend/features/performance/components/CompactVideoCard.tsx`
4. `frontend/features/performance/components/VideoDetailModal.tsx`
5. `frontend/features/saved-creators/components/SavedCreatorTable.tsx`
6. `frontend/prefabs/agent/panels/AgentChatPanel.tsx`
7. `frontend/features/ai-studio/components/promptStep/PromptStepChatSurface.tsx`
8. `frontend/features/ai-studio/components/canvas/CanvasPropertiesPanel.tsx`

Required docs:
1. [Image surface inventory lock](./media-rendering-hardening-v2-image-surface-inventory-lock-2026-03-16.md)
2. [Surface policy matrix](./media-rendering-hardening-v2-surface-policy-matrix-2026-03-18.md)

### MRH2-P9-001: Rollout And Decommission
Acceptance:
1. Ring rollout evidence is complete.
2. Legacy paths are not removed before parity proof and clean release windows.
3. Final closeout packet links rollout, rollback, and decommission outcomes.

Required docs:
1. [QA / release checklist](./media-rendering-hardening-v2-qa-release-checklist-2026-03-16.md)
2. [Legacy adapter sunset spec](./media-rendering-hardening-v2-legacy-adapter-sunset-spec-2026-03-16.md)

## Cross-Lane Dependency Note
Surface depends on both earlier lanes:
1. Foundation must finish policy selection and test realignment for touched surfaces.
2. Pipeline must leave Surface with stable metadata/list/upload/sign/resolve assumptions.

If a surface slice discovers that policy or server truth is still ambiguous, stop and update the owning lane docs before implementation continues.

## Slice Rules
1. One seam per PR.
2. Update tracker, docs, and evidence references in the same slice.
3. Keep rollback notes explicit for every user-visible surface change.
4. Use only the existing media-rendering evidence namespace.
5. Run protected-path gates whenever adaptive/reference-grid/media hot paths are touched.

## Validation Bundle
For Surface slices:
1. `cd frontend && npm run lint`
2. `cd frontend && npm run type-check`
3. `cd frontend && npm run build`
4. `cd frontend && npm run docs:check`

Required protected-surface gates when applicable:
1. `cd frontend && npm run test:adaptive-v2-gate`
2. `cd frontend && npm run perf:ai-studio:release-check`
3. `cd frontend && npm run check:architecture-boundary`
4. `cd frontend && npm run check:size-budget`

Targeted tests by seam:
1. surface parity and fallback tests
2. character/detail tests
3. long-tail smoke coverage
4. perf and render-stability evidence for hot-loop work

## Closeout Condition
The Surface lane execution plan is complete only when `MRH2-P3-001`, `MRH2-P3-002`, `MRH2-P7-001`, `MRH2-P7-002`, `MRH2-P8-001`, and `MRH2-P9-001` are all complete in the master tracker with linked evidence and no conflicting policy-matrix, contract-matrix, or QA-checklist state.
