# AI Studio Master Stage Phase 5: Export And Submit Decoupling Plan (2026-04-12)

Status: In Progress  
Owner: Engineering

## Goal
Separate stage export responsibilities from provider submission responsibilities.

## Problem
Current inpaint/edit submit logic mixes:
1. layer flattening,
2. mask export,
3. prompt/reference preparation,
4. provider payload creation,
5. task submission dispatch.

That coupling makes stage changes expensive and brittle.

## Scope
Phase 5 should create:
1. a stage export adapter for flattening the artboard,
2. a stage export adapter for mask generation,
3. a submit adapter that consumes exported artifacts instead of stage internals,
4. a simplified prompt/reference contract aligned to what the active provider actually accepts.

## Primary Files To Unwind
1. `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`
2. `frontend/features/ai-studio/logic/expertEditStageFlatten.ts`
3. `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
4. `frontend/features/ai-studio/hooks/taskSubmission/imageHandlers.ts`
5. `frontend/features/ai-studio/logic/expertEditPromptReferences.ts`

## Explicit Non-Goals
1. No provider swap unless required by contract truth.
2. No persistence redesign yet.
3. No new editing behavior beyond what the stage already supports.

## Entry Criteria
1. stage geometry and transforms are stable enough to export deterministically,
2. canonical artboard and document contracts are already in place.

## Exit Criteria
1. stage math no longer lives in submit handlers,
2. export artifacts are produced by one stage export boundary,
3. prompt/reference fanout is reduced to what the active provider path truly consumes,
4. export correctness is testable independently from task submission.

## Validation
1. targeted export and submit-adapter tests,
2. parity checks for flatten/mask alignment,
3. confirm provider payloads no longer depend on stage internals other than exported artifacts.

## Current Focus
Phase 5 now starts from the stable Phase 4 stage behavior and should target the first export-decoupling lane:
1. extract a dedicated stage export adapter out of `frontend/features/ai-studio/components/edit/useExpertEditInlineGenerate.ts`,
2. keep flatten, markup-reference export, and inpaint-mask export grouped behind that export boundary,
3. leave provider submission and task-dispatch wiring intact until the new export boundary is stable,
4. avoid broad prompt/provider cleanup until exported artifact ownership is explicit.

## Current Progress
Completed on 2026-04-12:
1. Extracted a dedicated stage export adapter into `frontend/features/ai-studio/components/edit/expertEditStageExport.ts`, moving flatten export, markup-reference export, and inpaint-mask export orchestration out of `useExpertEditInlineGenerate.ts`.
2. Kept provider submission wiring, prompt/reference compilation, and object-url lifecycle ownership inside `useExpertEditInlineGenerate.ts` so the first Phase 5 slice changes export boundaries without widening into submit-adapter refactors.
3. Added focused export-boundary coverage in `frontend/features/ai-studio/components/edit/__tests__/expertEditStageExport.test.ts` for:
   - reusable primary-source bypass,
   - markup-reference export gating,
   - inpaint-mask export using flattened blob dimensions.
4. Re-ran focused app-level parity coverage for standard flatten submit, markup secondary-reference export, inpaint FLUX Fill submission, and export-under-zoom behavior to confirm the new export boundary preserved existing editor behavior.

## Rollback Note
If decoupling breaks submission parity, temporarily route the submit adapter back through the old export path while keeping the new export boundary intact. Do not recouple stage geometry directly into submit handlers.
