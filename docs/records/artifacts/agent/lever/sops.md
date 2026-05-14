# Lever SOP Notes

Purpose: track Lever's workflow references and smaller operational notes that do not belong in the formal contract.

## Canonical SOP

The authoritative Lever SOP lives at:

- `docs/sops/sop_lever_model_management.md`

## Supporting References

- `docs/sops/sop_new_model_ingestion.md`
- `docs/sops/sop_model_api_contract_reverification.md`
- `docs/sops/sop_model_retirement.md`
- `docs/adr/0076-model-inventory-operator-only-and-server-allowlisted.md`
- `docs/planning/validation-matrix-by-program-2026-05-11.md`

## Current Notes

- Treat picker-visible model retirement as a two-part task: lifecycle change first, visible-app residue audit second.
- Treat full model removal as a three-part task: lifecycle-safe transition, visible-app residue audit, then active repo residue scan that leaves only intentional historical records.
- Prefer updating existing model-platform SOPs over creating narrow one-off Lever SOPs unless a repeatable gap appears.
- Treat short commands like `add <model>` and `remove <model>` as full workflow triggers, not as user requests for only one file edit.
