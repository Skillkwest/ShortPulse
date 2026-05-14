# SOP: Model Retirement

Purpose: retire or fully remove a ShortPulse model without giving inventory control to end users and without breaking restore, pricing, route, or visible app expectations.

## Scope

- Catalog-backed generation models in `frontend/lib/model-runtime/modelCatalog.ts`
- Runtime lifecycle changes (`active` -> `deprecated` / `disabled` / `retired`)
- Restore-time replacement handling through `replacementModelId`
- Final hard removal once compatibility support is intentionally no longer needed

## Preconditions

- The model inventory change is operator-owned and code-reviewed.
- A replacement model exists in the catalog when the retiring model still matters for picker/runtime restore compatibility.
- The replacement model is active and preserves the same media type.
- For hard removal, the operator/user has explicitly decided that compatibility support is no longer needed.

## Workflow

1. Classify the requested action.
   - If compatibility still matters, use retirement/lifecycle demotion.
   - If the model is no longer needed at all, execute retirement-safe cleanup first and then complete the hard-removal branch in this SOP.

2. Inspect the target and replacement pair.
   - Run:
     - `npm -C frontend run model:retire -- --model-id <old> --replacement-model-id <new>`
   - Review warnings before editing anything.

3. Update the catalog entry.
   - In `frontend/lib/model-runtime/modelCatalog.ts`, set:
     - `lifecycle` to `deprecated`, `disabled`, or `retired`
     - `replacementModelId` to the approved active replacement

4. Keep compatibility behavior intact during retirement.
   - Do not immediately remove docs, route files, or helper references if persisted state or external references may still point at the old model.
   - Let `frontend/features/ai-studio/logic/modelRestorePolicy.ts` normalize restore-time model ids through the replacement chain.

5. Validate retirement behavior.
   - Run:
     - `npm -C frontend run model:doctor`
     - `npm -C frontend exec vitest run features/ai-studio/logic/__tests__/modelRestorePolicy.test.ts features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
   - Add or update focused tests if this is the first retirement for a model family or picker-visible model.

6. Audit picker-visible residue after retirement.
   - Confirm visible app surfaces no longer expose the retired model as active.
   - Check at minimum:
     - `frontend/features/ai-studio/components/ModelModal.tsx`
     - `frontend/features/ai-studio/logic/modelModalPresentation.ts`
     - related picker/registry/task-polling tests and route inventory coverage

7. Hard-removal branch, only when compatibility is intentionally over.
   - Remove active support from:
     - catalog/runtime metadata
     - pricing metadata
     - provider normalizers and submit/status dispatch
     - route inventories and generated wrappers
     - visible app surfaces and compatibility-only controls
     - active tests and active docs
   - Replace any stale active-contract tests with the remaining canonical active model in that family when relevant.

8. Validate hard removal.
   - Run the relevant focused runtime/UI/provider tests for the removed family.
   - Run:
     - `npm -C frontend run model:doctor`
     - `node scripts/check_docs_links.js`
     - `npm -C frontend run fal:routes:check` when queued route inventory changed

9. Run a residue scan.
   - Search for the retired/removed model id, human label, route slugs, pricing keys, and old helper constants.
   - Only these residual references are acceptable by default:
     - change logs
     - historical planning snapshots
     - Lever memory, run logs, training history, and dated reports
   - Treat any remaining active code, route, pricing, or visible app reference as a bug and remove it before closeout.

## Rules

- Users do not add/remove models.
- Admin surfaces do not CRUD model inventory.
- Unsupported model ids must fail at the server boundary, not later in billing/provider execution.
- Hard removal is the final cleanup step, not the first lifecycle step.
- Full removal is not done until the visible app audit and residue scan both pass.

## Related docs

- `docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md`
- `docs/sops/sop_new_model_ingestion.md`
- `docs/api/api-elevenlabs-audio-models.md`
