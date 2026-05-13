# SOP: Lever Model Management

Purpose: define how Lever handles recurring ShortPulse model maintenance work without creating a second source of truth.

## Scope

- Model onboarding
- Model API contract reverification
- Model retirement and app-surface demotion
- Lever memory, training, and artifact upkeep

## Simple Trigger Language

Use these as full workflow triggers:

- `add <model> to the catalog`
- `add <model>`
- `remove <model>`
- `retire <model>`
- `reverify <model>`

Lever should infer the full workflow from those commands. The user may supply:

- the provider or model name
- links or locations for provider docs
- replacement intent for retirements

Lever owns the remaining repo workflow unless the user explicitly narrows scope.

## Canonical References

- `docs/sops/sop_new_model_ingestion.md`
- `docs/sops/sop_model_api_contract_reverification.md`
- `docs/sops/sop_model_retirement.md`
- `docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md`
- `docs/planning/validation-matrix-by-program-2026-05-11.md`

## Workflow

1. Load Lever operating context.
   - Read:
     - `docs/agents/lever/README.md`
     - `docs/agents/lever/memory.md`
   - Confirm whether the task is:
     - add model
     - reverify model contract
     - retire/deprecate model
     - audit app-visible residue after a lifecycle change

2. Route to the correct canonical SOP.
   - Add model:
     - use `docs/sops/sop_new_model_ingestion.md`
   - Reverify contract:
     - use `docs/sops/sop_model_api_contract_reverification.md`
   - Retire model:
     - use `docs/sops/sop_model_retirement.md`

3. Always keep the inventory boundary intact.
   - Model inventory remains code-owned.
   - Users do not add/remove models.
   - Admin surfaces do not CRUD executable model inventory.
   - Unsupported model ids must fail at the server boundary.

4. When retiring a picker-visible model, run the extra Lever audit.
   - Confirm the catalog lifecycle and `replacementModelId`.
   - Confirm visible app surfaces no longer expose the retired model as active.
   - Check at minimum:
     - `frontend/features/ai-studio/components/ModelModal.tsx`
     - `frontend/features/ai-studio/logic/modelModalPresentation.ts`
     - picker/registry tests and route inventory coverage
   - Keep compatibility-only runtime or route references only when the compatibility window still matters.

5. Record the run.
   - For every substantive add/reverify/retire/remove run:
     - append a row to `docs/records/artifacts/agent/lever/run-log.md`
     - create or update a dated report under `docs/records/artifacts/agent/lever/reports/` when the run is materially important, novel, or operationally instructive
   - Use `docs/records/artifacts/agent/lever/reports/run-report-template.md` as the default report skeleton.

6. Close the run with durable maintenance.
   - Add a training-history entry only when the run teaches a reusable lesson.
   - Promote concise durable lessons into `docs/agents/lever/memory.md`.
   - Keep larger notes, KPI baselines, and future reports under `docs/records/artifacts/agent/lever/`.

## Closeout Checklist

- Requested model change implemented or explicitly declined with reason.
- Runtime authority and route inventory remain aligned.
- Visible app surfaces match the intended lifecycle state.
- Relevant docs/indexes updated.
- Targeted validation run or gap explicitly reported.
- Retained run record written.
- Lever memory/artifacts updated only when operational value is real.

## Trigger

Use `run Lever` to execute this SOP.
