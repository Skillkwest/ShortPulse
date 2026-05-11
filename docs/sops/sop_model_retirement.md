# SOP: Model Retirement

Purpose: retire a ShortPulse model without giving inventory control to end users and without breaking restore, pricing, or route expectations.

## Scope

- Catalog-backed generation models in `frontend/lib/model-runtime/modelCatalog.ts`
- Runtime lifecycle changes (`active` -> `deprecated` / `disabled` / `retired`)
- Restore-time replacement handling through `replacementModelId`

## Preconditions

- The model inventory change is operator-owned and code-reviewed.
- A replacement model exists in the catalog when the retiring model still matters for picker/runtime restore compatibility.
- The replacement model is active and preserves the same media type.

## Workflow

1. Inspect the target and replacement pair.
   - Run:
     - `npm -C frontend run model:retire -- --model-id <old> --replacement-model-id <new>`
   - Review warnings before editing anything.

2. Update the catalog entry.
   - In `frontend/lib/model-runtime/modelCatalog.ts`, set:
     - `lifecycle` to `deprecated`, `disabled`, or `retired`
     - `replacementModelId` to the approved active replacement

3. Keep compatibility behavior intact.
   - Do not immediately remove docs, route files, or helper references if persisted state or external references may still point at the old model.
   - Let `frontend/features/ai-studio/logic/modelRestorePolicy.ts` normalize restore-time model ids through the replacement chain.

4. Validate.
   - Run:
     - `npm -C frontend run model:doctor`
     - `npm -C frontend exec vitest run features/ai-studio/logic/__tests__/modelRestorePolicy.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
   - Add or update focused tests if this is the first retirement for a model family or picker-visible model.

5. Remove residue later.
   - After the compatibility window is complete, remove obsolete provider routes, docs, and runtime residue in a separate cleanup pass.

## Rules

- Users do not add/remove models.
- Admin surfaces do not CRUD model inventory.
- Unsupported model ids must fail at the server boundary, not later in billing/provider execution.
- Hard removal is the final cleanup step, not the first lifecycle step.

## Related docs

- `docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md`
- `docs/sops/sop_new_model_ingestion.md`
- `docs/api/api-elevenlabs-audio-models.md`
