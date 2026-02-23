# Phase 0 Contract Freeze Baseline

Date: 2026-02-23
Phase: 0 (Contract Freeze)
Owner: Frontend
Status: Draft for signoff

Program doc:
- `docs/planning/ai-studio-reference-grid-modularization-program.md`

Tracker doc:
- `docs/planning/ai-studio-reference-grid-modularization-tracker.md`

## Scope
Freeze the behavioral contract before modular extraction begins.

In scope:
1. Reference grid render and interaction semantics.
2. Quick-slot add/reorder/remove semantics.
3. Ingestion parity for picker/drop/paste/library/agent.
4. Media runtime parity expectations for modal and route paths.

Out of scope:
1. Schema changes.
2. New product features.
3. Visual redesign.

## Baseline Hotspot Inventory
| File | Baseline lines (2026-02-23) |
| --- | --- |
| `frontend/features/ai-studio/components/ReferenceCanvas.tsx` | 3450 |
| `frontend/features/ai-studio/components/MediaLibraryModal.tsx` | 1466 |
| `frontend/features/ai-studio/hooks/useAiStudioState.ts` | 1206 |
| `frontend/pages/ai-studio.tsx` | 1559 |

## Behavior Contract Matrix
| Surface | Must Preserve |
| --- | --- |
| Add files (picker) | immediate visible insertion in reference grid |
| Add files (drop) | parity behavior with picker, including ingest metadata handling |
| Paste media/text | deterministic insertion path and stable rendering |
| Media-library select | correct preview/full semantics and insertion visibility |
| Quick-slot inventory | add/reorder/remove parity and deterministic state transitions |
| Archive/restore/delete | deterministic lifecycle semantics across all refs and quick slots |
| Save/download/generate actions | current behavior preserved during modularization |
| Modal/route preview runtime | signing/retry/fallback parity preserved |

## Required Test Baseline (Pre-Extraction)
- `ReferenceCanvas.curated.test.tsx`
- `ReferenceCanvas.paste.test.tsx`
- `ReferenceCanvas.selectorStore.test.tsx`
- `AiStudioPageContent.drop.test.tsx`
- `MediaLibraryModal.test.tsx`
- `useAiStudioWorkspaceActions.test.ts`
- `useAiStudioShellDndController.test.ts`
- `useAiStudioState.outputStoreBridge.test.tsx`
- `stateParsers.uploads.test.ts`
- `referenceGridMedia.test.ts`
- `referenceGridMedia.parity.test.ts`

## Perf Baseline Gates
1. `await window.__shortpulseAiStudioPerf?.runReferenceGridAudit()`
2. `await window.__shortpulseAiStudioPerf?.runStudioShellAudit()`

Gate targets remain those defined in:
- `docs/sops/sop_media_performance_operations.md`
- `docs/planning/ai-studio-reference-grid-stabilization-v4-plan.md`

## Signoff Checklist
- [ ] Behavior contract matrix approved.
- [ ] Baseline test list confirmed green on target branch.
- [ ] Perf baseline capture attached.
- [ ] Phase 0 closed in tracker before any extraction PR merges.
