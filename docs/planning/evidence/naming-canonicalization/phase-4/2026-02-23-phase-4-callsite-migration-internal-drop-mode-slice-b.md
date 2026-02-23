# Naming Canonicalization Phase 4 Callsite Migration (Internal Slice B)

## Metadata
- Date: 2026-02-23
- Phase: 4 (Callsite migration / migrate)
- Slice: Internal reference-grid drop-mode type canonicalization
- Owner: Frontend

## Scope
1. Canonicalized internal drop-mode type symbol:
- `ReferenceCanvasDropMode` -> `ReferenceGridDropMode`
2. Preserved compatibility alias export for legacy type references.
3. Migrated internal consumers in:
- `ReferenceCanvas.tsx`
- telemetry controller
- drop helper controller

## Changed Files
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCanvasDropController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts`
- `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropHelpersController.ts`
- `frontend/features/ai-studio/components/ReferenceCanvas.tsx`

## Validation
- `npm -C frontend run type-check` - Pass
- `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx ReferenceCanvas.paste.test.tsx ReferenceCanvas.selectorStore.test.tsx AiStudioPageContent.drop.test.tsx` - Pass

## Notes
- Naming-only slice; no behavior changes introduced.
